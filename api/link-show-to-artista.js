export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { showId, artistaId } = req.body || {};
  if (!showId) return res.status(400).json({ error: 'Missing showId' });

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    if (artistaId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(artistaId)) {
        return res.status(400).json({ error: 'artistaId must be a UUID' });
      }
      const ar = await fetch(
        `${SUPABASE_URL}/rest/v1/artistas?id=eq.${encodeURIComponent(artistaId)}&select=id`,
        { headers }
      );
      if (!ar.ok) {
        return res.status(ar.status).json({ error: await ar.text() });
      }
      const arRows = await ar.json();
      if (!arRows.length) return res.status(400).json({ error: 'Artista not found', hint: artistaId });
    }

    const update = { artista_id: artistaId || null };

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/shows?id=eq.${encodeURIComponent(showId)}&select=*,artista:artista_id(id,nombre,nombre_artistico,compania,email,telefono,fotos_urls)`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(update)
      }
    );

    if (!r.ok) {
      return res.status(r.status).json({ error: await r.text() });
    }
    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ error: 'Show not found', hint: showId });

    return res.status(200).json({ success: true, show: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
