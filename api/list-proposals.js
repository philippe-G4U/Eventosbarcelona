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

  const status = (req.query.status || '').trim();
  const q = (req.query.q || '').trim();
  const limitRaw = parseInt(req.query.limit, 10);
  const offsetRaw = parseInt(req.query.offset, 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  try {
    const params = [
      'select=id,status,client_name,client_company,client_email,client_phone,event_name,event_type,event_date,event_guests,event_location,category,concept_title,shows,global_margin,ghl_contact_id,ghl_opportunity_id,created_at,updated_at,approved_at',
      'order=created_at.desc'
    ];

    if (status && ['revision', 'approved'].includes(status)) {
      params.push(`status=eq.${encodeURIComponent(status)}`);
    }

    if (q) {
      const safe = q.replace(/[(),]/g, ' ').trim();
      const pat = `*${safe}*`;
      const enc = encodeURIComponent(pat);
      params.push(`or=(client_name.ilike.${enc},client_company.ilike.${enc},client_email.ilike.${enc},event_name.ilike.${enc})`);
    }

    const url = `${SUPABASE_URL}/rest/v1/proposals?${params.join('&')}`;

    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Range-Unit': 'items',
        'Range': `${offset}-${offset + limit - 1}`,
        'Prefer': 'count=exact'
      }
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: txt });
    }

    const rows = await r.json();
    let total = rows.length;
    const cr = r.headers.get('content-range');
    if (cr) {
      const m = /\/(\d+|\*)$/.exec(cr);
      if (m && m[1] !== '*') total = parseInt(m[1], 10);
    }

    return res.status(200).json({
      success: true,
      count: rows.length,
      total,
      limit,
      offset,
      proposals: rows
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
