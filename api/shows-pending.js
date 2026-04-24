export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const status = req.query.status || 'pending_review';

  try {
    // Join con artistas: Supabase lo expone via foreign-key alias
    const url = `${SUPABASE_URL}/rest/v1/shows?status=eq.${encodeURIComponent(status)}`
      + `&select=*,artista:artista_id(id,nombre,nombre_artistico,compania,email,telefono,fotos_urls)`
      + `&order=submitted_at.desc.nullslast`;

    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!r.ok) {
      const txt = await r.text();
      // Si la migración no se aplicó, el campo status no existe
      if (/column.*does not exist/i.test(txt)) {
        return res.status(409).json({
          error: 'Migración shows↔artista no aplicada',
          hint: 'Correr scripts/apply-shows-artista-migration.js y pegar el SQL en Supabase'
        });
      }
      return res.status(r.status).json({ error: txt });
    }
    const rows = await r.json();
    return res.status(200).json({ success: true, count: rows.length, shows: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
