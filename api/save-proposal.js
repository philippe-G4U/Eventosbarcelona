const GHL_API = 'https://services.leadconnectorhq.com';
const URL_PROPUESTA_VALIDADA_FIELD_ID = 'R1XtZUYECtUKmvPeKoXD';

async function writeValidatedUrlToGHL(email, validatedUrl) {
  const TOKEN = process.env.GHL_API_KEY;
  const LOC = process.env.GHL_LOCATION_ID;
  if (!TOKEN || !LOC || !email) return { ok: false, reason: 'missing_config_or_email' };

  const HEADERS = {
    'Authorization': `Bearer ${TOKEN}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  };

  const searchRes = await fetch(
    `${GHL_API}/contacts/search/duplicate?locationId=${LOC}&email=${encodeURIComponent(email)}`,
    { headers: HEADERS }
  );
  const searchData = await searchRes.json();
  const contact = searchData.contact;
  if (!contact?.id) return { ok: false, reason: 'contact_not_found' };

  const updateRes = await fetch(`${GHL_API}/contacts/${contact.id}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({
      customFields: [{ id: URL_PROPUESTA_VALIDADA_FIELD_ID, field_value: validatedUrl }]
    })
  });
  return { ok: updateRes.ok, status: updateRes.status, contactId: contact.id };
}

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

  const baseUrl = process.env.PROPUESTA_BASE_URL
    || (req.headers.host ? `https://${req.headers.host}` : '');

  try {
    const data = req.body;

    const row = {
      status: data.status || 'revision',
      client_name: data.client?.name || '',
      client_company: data.client?.company || '',
      client_email: data.client?.email || '',
      client_phone: data.client?.phone || '',
      event_name: data.event?.name || '',
      event_type: data.event?.type || '',
      event_date: data.event?.date || '',
      event_guests: data.event?.guests || 0,
      event_location: data.event?.location || '',
      category: data.category || 'shows',
      concept_title: data.concept?.title || '',
      concept_text: data.concept?.text || '',
      hero_sub: data.heroSub || '',
      shows: JSON.stringify(data.shows || []),
      global_margin: data.globalMargin || 0,
      ghl_contact_id: data.ghlContactId || null,
      ghl_opportunity_id: data.ghlOpportunityId || null
    };

    // If updating existing proposal
    if (data.id) {
      row.updated_at = new Date().toISOString();
      if (data.status === 'approved') {
        row.approved_at = new Date().toISOString();
        row.approved_by = 'admin';
      }

      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/proposals?id=eq.${data.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(row)
        }
      );
      const updated = await updateRes.json();

      let ghlSync;
      if (data.status === 'approved' && data.client?.email && baseUrl) {
        const validatedUrl = `${baseUrl}/propuesta.html?id=${data.id}`;
        ghlSync = await writeValidatedUrlToGHL(data.client.email, validatedUrl);
      }

      return res.status(200).json({ success: true, id: data.id, proposal: updated[0], ghlSync });
    }

    // Create new proposal
    const createRes = await fetch(
      `${SUPABASE_URL}/rest/v1/proposals`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(row)
      }
    );
    const created = await createRes.json();

    if (!created[0]?.id) {
      return res.status(500).json({ error: 'Failed to create proposal', details: created });
    }

    let ghlSync;
    if (data.status === 'approved' && data.client?.email && baseUrl) {
      const validatedUrl = `${baseUrl}/propuesta.html?id=${created[0].id}`;
      ghlSync = await writeValidatedUrlToGHL(data.client.email, validatedUrl);
    }

    return res.status(200).json({
      success: true,
      id: created[0].id,
      url: `/propuesta.html?id=${created[0].id}`,
      ghlSync
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
