/**
 * import-ghl-artistas-to-supabase.js
 *
 * Importa los artistas reales desde el pipeline ARTISTAS de GHL a la tabla
 * Supabase `artistas`. La fuente confiable son las opportunities del pipeline
 * `GHL_PIPELINE_ARTISTAS` (~264). Cada opportunity tiene un `contact` embebido
 * con id/name/email/phone, y un `name` con formato "Nombre — Disciplina(extra)".
 *
 * Estrategia idempotente:
 *  1. Trae todas las opportunities paginando por meta.nextPageUrl.
 *  2. Deduplica por contact.id (cada artista = 1 fila).
 *  3. Intenta un dry-run de upsert con on_conflict=ghl_contact_id sobre 1 fila
 *     real para confirmar que el constraint existe. Si falla, ABORTA.
 *  4. Si el dry-run funciona, sube en lotes de 50 con retry simple.
 *  5. NO toca otras tablas. NO borra. Hace upsert (merge-duplicates).
 *
 * Diseñado para ser idempotente: ejecutarlo dos veces deja el mismo estado.
 */

require('dotenv').config();

const GHL_TOKEN = process.env.GHL_API_KEY;
const GHL_LOC = process.env.GHL_LOCATION_ID;
const GHL_PIPE = process.env.GHL_PIPELINE_ARTISTAS;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const GHL_HEADERS = {
  'Authorization': `Bearer ${GHL_TOKEN}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
};
const SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

function assertEnv() {
  const missing = [];
  if (!GHL_TOKEN) missing.push('GHL_API_KEY');
  if (!GHL_LOC) missing.push('GHL_LOCATION_ID');
  if (!GHL_PIPE) missing.push('GHL_PIPELINE_ARTISTAS');
  if (!SB_URL) missing.push('SUPABASE_URL');
  if (!SB_KEY) missing.push('SUPABASE_SERVICE_KEY');
  if (missing.length) {
    console.error('FALTAN env vars:', missing.join(', '));
    process.exit(1);
  }
}

async function fetchAllOpportunities() {
  const all = [];
  let url = `https://services.leadconnectorhq.com/opportunities/search?location_id=${GHL_LOC}&pipeline_id=${GHL_PIPE}&limit=100`;
  let pages = 0;
  while (url) {
    pages++;
    const res = await fetch(url, { headers: GHL_HEADERS });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL search ${res.status}: ${text.substring(0, 300)}`);
    }
    const data = await res.json();
    const opps = data.opportunities || [];
    all.push(...opps);
    const next = data?.meta?.nextPageUrl;
    if (next && opps.length > 0) {
      url = next;
    } else {
      url = null;
    }
  }
  console.log(`  Páginas GHL traídas: ${pages}`);
  return all;
}

/**
 * Parse "Nombre artistico — Disciplina (extra)" o variantes con guión simple.
 * Devuelve { artist, discipline } limpios. Si no hay separador, todo es artist.
 */
function parseOppName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return { artist: '', discipline: '' };
  }
  const name = rawName.trim();
  // Em-dash —, en-dash –, hyphen-minus rodeado de espacios
  const splitRe = /\s+[—–-]\s+/;
  const idx = name.search(splitRe);
  if (idx === -1) {
    return { artist: name, discipline: '' };
  }
  const artist = name.slice(0, idx).trim();
  const rest = name.slice(idx).replace(splitRe, '').trim();
  // Remove trailing parenthetical for discipline
  // "Música (acordeón / teclado)" -> "Música"
  const discipline = rest.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return { artist, discipline };
}

function buildRow(opp) {
  const contact = opp.contact || {};
  const ghlContactId = contact.id || opp.contactId;
  const contactName = (contact.name || '').trim();
  const { artist: oppArtistName, discipline } = parseOppName(opp.name);

  // nombre = lo que GHL tiene como "name" del contacto (firstName+lastName fusionados)
  const nombre = contactName || oppArtistName;
  // nombre_artistico solo si difiere de nombre y existe
  const nombre_artistico =
    oppArtistName && oppArtistName.toLowerCase() !== nombre.toLowerCase()
      ? oppArtistName
      : '';

  // email: si no hay, usar placeholder estable basado en ghl_contact_id para
  // satisfacer el UNIQUE NOT NULL del schema sin colisionar entre filas.
  const realEmail = (contact.email || '').trim().toLowerCase();
  const email = realEmail || `no-email-${ghlContactId}@placeholder.eventosbarcelona.local`;

  return {
    nombre,
    nombre_artistico,
    compania: '', // GHL embed no trae companyName en `contact`, viene en relations
    email,
    telefono: contact.phone || '',
    ciudad: '', // no viene en el embed; lo deja vacío
    disciplinas: discipline ? [discipline] : [],
    bio_show: opp.name || '',
    ghl_contact_id: ghlContactId,
    origen: 'ghl-import',
  };
}

async function sbCountArtistas() {
  const res = await fetch(`${SB_URL}/rest/v1/artistas?select=id`, {
    headers: { ...SB_HEADERS, Prefer: 'count=exact', Range: '0-0' },
  });
  const range = res.headers.get('content-range') || '';
  // formato "0-0/N" o "*/N"
  const m = range.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

async function sbUpsert(rows, onConflict) {
  const url = `${SB_URL}/rest/v1/artistas?on_conflict=${onConflict}`;
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...SB_HEADERS,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    if (res.status >= 500 && attempt < 3) {
      console.warn(`  reintento ${attempt} tras ${res.status}: ${text.substring(0, 200)}`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
      continue;
    }
    return { ok: false, status: res.status, error: text };
  }
}

async function main() {
  assertEnv();

  console.log('=== Import GHL Artistas → Supabase ===\n');

  // 1. Conteo before
  const beforeCount = await sbCountArtistas();
  console.log(`Filas en artistas ANTES: ${beforeCount}`);

  // 2. Trae opportunities
  console.log('\nTrayendo opportunities del pipeline ARTISTAS...');
  const opps = await fetchAllOpportunities();
  console.log(`  Opportunities totales: ${opps.length}`);

  if (opps.length === 0) {
    console.error('ABORT: 0 opportunities. Revisar GHL_API_KEY / GHL_PIPELINE_ARTISTAS.');
    process.exit(1);
  }
  if (opps.length > 500) {
    console.error(`ABORT: ${opps.length} opportunities, esperaba ~264. Algo cambió en GHL.`);
    process.exit(1);
  }

  // 3. Deduplica por contact.id (1 artista por fila)
  const byContact = new Map();
  for (const opp of opps) {
    const cid = opp.contact?.id || opp.contactId;
    if (!cid) continue;
    if (!byContact.has(cid)) byContact.set(cid, opp);
  }
  console.log(`  Contactos únicos: ${byContact.size}`);

  // 4. Construye rows
  const rows = [];
  let placeholderCount = 0;
  for (const opp of byContact.values()) {
    const row = buildRow(opp);
    if (row.email.endsWith('@placeholder.eventosbarcelona.local')) placeholderCount++;
    rows.push(row);
  }
  console.log(`  Filas construidas: ${rows.length} (con email placeholder: ${placeholderCount})`);

  // 5. Dry-run: probar 1 fila con on_conflict=ghl_contact_id
  console.log('\nDry-run de upsert con on_conflict=ghl_contact_id...');
  const dry = await sbUpsert([rows[0]], 'ghl_contact_id');
  if (!dry.ok) {
    console.error('\nABORT: el upsert con on_conflict=ghl_contact_id falló.');
    console.error(`  Status: ${dry.status}`);
    console.error(`  Body: ${dry.error.substring(0, 600)}`);
    console.error('\nProbablemente la tabla artistas NO tiene UNIQUE constraint sobre');
    console.error('ghl_contact_id. Para arreglarlo, en Supabase SQL Editor:');
    console.error('  CREATE UNIQUE INDEX IF NOT EXISTS artistas_ghl_contact_id_unique');
    console.error('    ON artistas (ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;');
    console.error('Luego volvé a correr este script.');
    process.exit(1);
  }
  console.log('  Dry-run OK.');

  // 6. Sube en lotes de 50
  const BATCH = 50;
  let upserted = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const r = await sbUpsert(slice, 'ghl_contact_id');
    if (r.ok) {
      upserted += slice.length;
      process.stdout.write(`  Lote ${i / BATCH + 1}: +${slice.length} (acum ${upserted}/${rows.length})\n`);
    } else {
      console.error(`  Lote ${i / BATCH + 1} ERROR ${r.status}: ${r.error.substring(0, 300)}`);
      errors.push({ batchStart: i, status: r.status, error: r.error.substring(0, 500) });
    }
  }

  // 7. Conteo after
  const afterCount = await sbCountArtistas();

  // 8. Sanity sample: 5 primeros del lote
  console.log('\n=== RESUMEN ===');
  console.log(`Opportunities GHL traídas: ${opps.length}`);
  console.log(`Contactos únicos:          ${byContact.size}`);
  console.log(`Filas construidas:         ${rows.length}`);
  console.log(`Filas upserteadas:         ${upserted}`);
  console.log(`Errores de lote:           ${errors.length}`);
  console.log(`Filas en artistas ANTES:   ${beforeCount}`);
  console.log(`Filas en artistas DESPUÉS: ${afterCount}`);

  if (errors.length) {
    console.log('\nERRORES:');
    errors.forEach(e => console.log(`  batch@${e.batchStart} status=${e.status}: ${e.error}`));
  }

  console.log('\n5 primeros artistas importados (orden = orden de GHL):');
  rows.slice(0, 5).forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.nombre.padEnd(30)} | ${r.email.padEnd(40)} | [${r.disciplinas.join(', ')}] | ${r.ghl_contact_id.slice(0, 8)}…`
    );
  });
}

main().catch(err => {
  console.error('ERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
