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

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing proposal ID' });

  try {
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const rows = await fetchRes.json();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const p = rows[0];

    // Format for frontend
    const proposal = {
      id: p.id,
      status: p.status,
      client: {
        name: p.client_name,
        company: p.client_company,
        email: p.client_email,
        phone: p.client_phone
      },
      event: {
        name: p.event_name,
        type: p.event_type,
        date: p.event_date,
        guests: p.event_guests,
        location: p.event_location
      },
      category: p.category,
      concept: {
        title: p.concept_title,
        text: p.concept_text
      },
      heroSub: p.hero_sub,
      shows: typeof p.shows === 'string' ? JSON.parse(p.shows) : p.shows,
      globalMargin: p.global_margin,
      createdAt: p.created_at,
      approvedAt: p.approved_at
    };

    return res.status(200).json({ success: true, proposal });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
