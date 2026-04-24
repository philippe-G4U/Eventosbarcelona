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

  const { id, action, patch } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });
  if (!['approve', 'archive', 'edit'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve | archive | edit' });
  }

  const now = new Date().toISOString();
  const update = { reviewed_at: now, reviewed_by: 'admin' };
  if (action === 'approve') update.status = 'active';
  if (action === 'archive') update.status = 'archived';
  if (action === 'edit' && patch && typeof patch === 'object') {
    // Whitelist de campos editables
    const allowed = ['name', 'category', 'subcategory', 'description', 'base_price', 'price_note', 'video_url', 'image_url'];
    for (const k of allowed) if (k in patch) update[k] = patch[k];
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/shows?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(update)
      }
    );
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    const rows = await r.json();
    return res.status(200).json({ success: true, show: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
