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

  const id = (req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'id must be a UUID' });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/artistas?id=eq.${encodeURIComponent(id)}&select=*,shows(*)`;
    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: await r.text() });
    }
    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ error: 'Artista not found' });

    return res.status(200).json({ success: true, artista: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
