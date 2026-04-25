/**
 * Cross-match shows.name → artistas (nombre / nombre_artistico / compania)
 *
 * Estrategia conservadora: solo auto-link cuando el match es alto y único.
 * El resto queda con artista_id = NULL para asignación manual desde el admin.
 *
 * Uso:
 *   node scripts/match-shows-to-artistas.js              # dry-run, imprime sugerencias
 *   node scripts/match-shows-to-artistas.js --apply       # escribe shows.artista_id en Supabase
 */

require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const HEAD = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

const STOP = new Set([
  'show', 'shows', 'de', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'con',
  'del', 'al', 'para', 'por', 'un', 'una', 'unos', 'unas',
  'eventos', 'evento', 'corporativos', 'corporativo', 'fiesta', 'fiestas',
  'espectaculo', 'espectaculos', 'profesionales', 'artista', 'artistas',
  'banda', 'bandas', 'grupo', 'grupos', 'cantante', 'cantantes',
  'musica', 'danza', 'baile', 'circo'
]);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function tokens(s) {
  return norm(s).split(' ').filter(t => t.length >= 3 && !STOP.has(t));
}

function score(show, artist) {
  // candidate names del artista
  const names = [artist.nombre, artist.nombre_artistico, artist.compania, artist.bio_show]
    .filter(Boolean)
    .map(n => norm(n));
  const showName = norm(show.name);
  const showToks = new Set(tokens(show.name));

  let best = 0;
  let how = '';
  for (const n of names) {
    if (!n) continue;
    // 1) Match exacto del nombre del artista en el nombre del show
    if (n.length >= 4 && showName.includes(n)) {
      best = Math.max(best, 0.95);
      how = `nombre artista en show: "${n}"`;
    }
    // 2) Match exacto del nombre del show en el nombre del artista
    if (showName.length >= 4 && n.includes(showName)) {
      best = Math.max(best, 0.95);
      how = `nombre show en artista: "${showName}"`;
    }
    // 3) Token overlap ponderado
    const aToks = new Set(tokens(n));
    const inter = [...showToks].filter(t => aToks.has(t));
    if (inter.length) {
      const r = inter.length / Math.max(showToks.size, aToks.size);
      if (r > best) {
        best = r;
        how = `tokens compartidos: ${inter.join(',')} (${(r*100|0)}%)`;
      }
    }
  }
  return { score: best, how };
}

async function fetchAll(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEAD });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchShow(id, artista_id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/shows?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...HEAD, Prefer: 'return=minimal' },
    body: JSON.stringify({ artista_id })
  });
  if (!r.ok) throw new Error(`PATCH ${id} → ${r.status} ${await r.text()}`);
}

(async () => {
  console.log(`=== Match shows → artistas (${APPLY ? 'APPLY' : 'dry-run'}) ===\n`);

  const shows = await fetchAll('shows?select=id,name,artista_id&limit=500');
  const artistas = await fetchAll('artistas?select=id,nombre,nombre_artistico,compania,bio_show,disciplinas,ghl_contact_id&limit=500');
  console.log(`Shows totales: ${shows.length}  ·  Artistas totales: ${artistas.length}`);

  let alreadyLinked = 0;
  const decisions = [];

  for (const sh of shows) {
    if (sh.artista_id) { alreadyLinked++; continue; }
    const cands = artistas
      .map(a => ({ a, ...score(sh, a) }))
      .filter(c => c.score >= 0.6)
      .sort((x, y) => y.score - x.score);

    if (!cands.length) {
      decisions.push({ show: sh, decision: 'no-match' });
      continue;
    }

    const top = cands[0];
    const second = cands[1];
    const gap = top.score - (second?.score || 0);
    // Auto-link si top muy alto y único Y nombre del artista no es tan corto/genérico
    const topName = top.a.nombre_artistico || top.a.nombre || top.a.compania || '';
    const topTokens = topName.trim().split(/\s+/).filter(Boolean);
    const nameRobust = topName.length >= 8 && topTokens.length >= 2;
    const autoLink = top.score >= 0.85 && (gap >= 0.2 || cands.length === 1) && nameRobust;
    decisions.push({
      show: sh, decision: autoLink ? 'auto' : 'review',
      top, second, totalCands: cands.length
    });
  }

  const auto = decisions.filter(d => d.decision === 'auto');
  const review = decisions.filter(d => d.decision === 'review');
  const none = decisions.filter(d => d.decision === 'no-match');

  console.log(`\nResumen:`);
  console.log(`  ya linkeados:   ${alreadyLinked}`);
  console.log(`  auto-link:      ${auto.length}`);
  console.log(`  review (ambig): ${review.length}`);
  console.log(`  sin match:      ${none.length}\n`);

  if (auto.length) {
    console.log('AUTO-LINKS (los que se aplicarían):');
    for (const d of auto.slice(0, 30)) {
      console.log(`  ${d.show.id.padEnd(35)} → ${d.top.a.nombre || d.top.a.nombre_artistico} | ${d.how} | ${d.top.score.toFixed(2)}`);
    }
    if (auto.length > 30) console.log(`  ... y ${auto.length - 30} más`);
  }

  if (review.length) {
    console.log('\nREVIEW (ambiguos, no se auto-linkean):');
    for (const d of review.slice(0, 15)) {
      console.log(`  ${d.show.id.padEnd(35)} → top=${d.top.a.nombre} (${d.top.score.toFixed(2)})  vs  ${d.second?.a.nombre} (${(d.second?.score||0).toFixed(2)})`);
    }
    if (review.length > 15) console.log(`  ... y ${review.length - 15} más`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — para escribir, correr con --apply)');
    return;
  }

  console.log('\nAplicando auto-links a Supabase...');
  let ok = 0, err = 0;
  for (const d of auto) {
    try {
      await patchShow(d.show.id, d.top.a.id);
      ok++;
    } catch (e) {
      err++;
      console.error(`  FAIL ${d.show.id}: ${e.message}`);
    }
  }
  console.log(`\nApplied: ${ok}  ·  errors: ${err}`);
})().catch(e => { console.error(e); process.exit(1); });
