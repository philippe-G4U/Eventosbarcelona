export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API = 'https://services.leadconnectorhq.com';
  const TOKEN = process.env.GHL_API_KEY;
  const LOC = process.env.GHL_LOCATION_ID;
  const PIPELINE = process.env.GHL_PIPELINE_CLIENTES;
  const STAGE = process.env.GHL_STAGE_NEW_LEAD;
  const STAGE_MISSING = process.env.GHL_STAGE_MISSING_INFO || STAGE;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SITE_URL = process.env.SITE_URL || 'https://eventos-barcelona.vercel.app';
  const HEADERS = {
    'Authorization': `Bearer ${TOKEN}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  };

  try {
    const data = req.body;
    const isPartial = data.partial === true;
    const lang = (data.lang === 'en') ? 'en' : 'es';

    // Partial submit: lead abandonó el form tras el paso 1 (datos de contacto)
    if (isPartial) {
      const partialTags = ['follow_up', 'origen_form', 'info_incompleta'];
      if (lang === 'en') partialTags.push('lang:en');

      const contactBody = {
        locationId: LOC,
        firstName: data.nombre || '',
        email: data.email || '',
        phone: data.telefono || '',
        companyName: data.empresa || '',
        tags: partialTags,
        customFields: [
          { key: 'tipo', field_value: 'Cliente' },
          { key: 'origen', field_value: 'Form' },
          { key: 'idioma', field_value: lang },
          { key: 'resumen_ia', field_value: 'Lead incompleto — solo completó datos de contacto' }
        ]
      };

      const contactRes = await fetch(`${API}/contacts/upsert`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(contactBody)
      });
      const contactData = await contactRes.json();

      if (!contactData.contact?.id) {
        return res.status(500).json({ error: 'Failed to create partial contact', details: contactData });
      }

      const contactId = contactData.contact.id;

      // Solo crear oportunidad si el contacto es nuevo (evita duplicar en reintentos)
      let oppId = null;
      if (contactData.new === true || contactData.isNew === true) {
        const oppBody = {
          locationId: LOC,
          pipelineId: PIPELINE,
          pipelineStageId: STAGE_MISSING,
          contactId: contactId,
          name: `${data.nombre || 'Lead'} — Info incompleta`,
          status: 'open',
          monetaryValue: 0,
          customFields: [
            { key: 'resumen_ia', field_value: 'Lead abandonó el formulario tras completar datos de contacto' }
          ]
        };

        const oppRes = await fetch(`${API}/opportunities/`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(oppBody)
        });
        const oppData = await oppRes.json();
        oppId = oppData.opportunity?.id || null;
      }

      return res.status(200).json({
        success: true,
        partial: true,
        contactId: contactId,
        opportunityId: oppId
      });
    }

    // Build tags (Ramiro v2 2026-04-17)
    const tags = ['follow_up', 'origen_form', 'info_completa'];
    if (lang === 'en') tags.push('lang:en');

    // Build resumen_ia from form data
    const resumenIa = [
      data.tipoEvento ? `Tipo evento: ${data.tipoEvento}` : '',
      data.formatoShow ? `Entretenimiento: ${data.formatoShow}` : '',
      data.categorias?.length ? `Categorías: ${data.categorias.join(', ')}` : '',
      data.subcategorias?.length ? `Subcategorías: ${data.subcategorias.join(', ')}` : '',
      data.fechaEvento ? `Fecha: ${data.fechaEvento}` : '',
      data.numAsistentes ? `Asistentes: ${data.numAsistentes}` : '',
      data.ubicacion ? `Ubicación: ${data.ubicacion}` : '',
      data.presupuesto ? `Presupuesto: ${data.presupuesto}` : '',
      `Producción técnica: ${data.necesitaProduccion ? 'Sí' : 'No'}`,
      data.comoNosConocio ? `Cómo nos conoció: ${data.comoNosConocio}` : '',
      data.comentarios ? `Comentarios: ${data.comentarios}` : ''
    ].filter(Boolean).join(' | ');

    // 1. Create/update contact
    const contactBody = {
      locationId: LOC,
      firstName: data.nombre || '',
      email: data.email || '',
      phone: data.telefono || '',
      companyName: data.empresa || '',
      tags: tags,
      customFields: [
        { key: 'tipo', field_value: 'Cliente' },
        { key: 'origen', field_value: 'Form' },
        { key: 'idioma', field_value: lang },
        { key: 'resumen_ia', field_value: resumenIa },
        { key: 'url_propuesta', field_value: '' }
      ]
    };

    // Save proposal to Supabase and get URL
    let proposalId = null;
    let proposalUrl = '';
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        // Build proposal data with auto-matched shows encoded
        const proposalData = btoa(encodeURIComponent(JSON.stringify(data)));
        const langParam = lang === 'en' ? '&lang=en' : '';
        const adminUrl = `${SITE_URL}/propuesta.html?mode=auto&data=${proposalData}${langParam}`;

        // Save to Supabase
        const proposalRow = {
          status: 'revision',
          client_name: data.nombre || '',
          client_company: data.empresa || '',
          client_email: data.email || '',
          client_phone: data.telefono || '',
          event_name: `${data.tipoEvento || 'Evento'} — ${data.empresa || data.nombre || 'Cliente'}`,
          event_type: data.tipoEvento || '',
          event_date: data.fechaEvento || '',
          event_guests: parseInt(data.numAsistentes) || 0,
          event_location: data.ubicacion || '',
          category: 'shows',
          concept_title: '',
          concept_text: '',
          shows: JSON.stringify([])
        };

        const spRes = await fetch(`${SUPABASE_URL}/rest/v1/proposals`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(proposalRow)
        });
        const spData = await spRes.json();
        if (spData[0]?.id) {
          proposalId = spData[0].id;
          proposalUrl = adminUrl;
        }
      } catch (e) {
        console.error('Proposal save error:', e.message);
      }
    }

    // Add proposal URL to contact custom fields
    contactBody.customFields.find(f => f.key === 'url_propuesta').field_value = proposalUrl;

    const contactRes = await fetch(`${API}/contacts/upsert`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(contactBody)
    });
    const contactData = await contactRes.json();

    if (!contactData.contact?.id) {
      return res.status(500).json({ error: 'Failed to create contact', details: contactData });
    }

    const contactId = contactData.contact.id;

    // Remove info_incompleta tag if it was set by a prior partial submit
    try {
      await fetch(`${API}/contacts/${contactId}/tags`, {
        method: 'DELETE',
        headers: HEADERS,
        body: JSON.stringify({ tags: ['info_incompleta'] })
      });
    } catch (tagErr) {
      console.error('Remove info_incompleta tag error:', tagErr.message);
    }

    // 2. Build opportunity summary
    const resumenOpo = [
      '📋 Solicitud de presupuesto',
      resumenIa,
      proposalUrl ? `Propuesta: ${proposalUrl}` : ''
    ].filter(Boolean).join('\n');

    // 3. Find existing opportunity for this contact (created by partial submit)
    let existingOppId = null;
    try {
      const searchRes = await fetch(
        `${API}/opportunities/search?location_id=${LOC}&contact_id=${contactId}&pipeline_id=${PIPELINE}`,
        { method: 'GET', headers: HEADERS }
      );
      const searchData = await searchRes.json();
      const opps = searchData.opportunities || [];
      const stub = opps.find(o => o.pipelineStageId === STAGE_MISSING && o.status === 'open');
      if (stub) existingOppId = stub.id;
    } catch (searchErr) {
      console.error('Opportunity search error:', searchErr.message);
    }

    const oppBody = {
      locationId: LOC,
      pipelineId: PIPELINE,
      pipelineStageId: STAGE,
      contactId: contactId,
      name: `${data.nombre || 'Lead'} — ${data.tipoEvento || 'Evento'}`,
      status: 'open',
      monetaryValue: 0,
      customFields: [
        { key: 'resumen_ia', field_value: resumenOpo }
      ]
    };

    const oppRes = await fetch(
      existingOppId ? `${API}/opportunities/${existingOppId}` : `${API}/opportunities/`,
      {
        method: existingOppId ? 'PUT' : 'POST',
        headers: HEADERS,
        body: JSON.stringify(oppBody)
      }
    );
    const oppData = await oppRes.json();

    // 5. Create contact in Holded
    let holdedId = null;
    try {
      const holdedBody = {
        name: data.empresa || data.nombre || '',
        email: data.email || '',
        phone: data.telefono || '',
        type: 'client',
        tags: tags,
        notes: [
          data.tipoEvento ? `Evento: ${data.tipoEvento}` : '',
          data.formatoShow ? `Formato: ${data.formatoShow}` : '',
          data.categorias?.length ? `Categorías: ${data.categorias.join(', ')}` : '',
          data.fechaEvento ? `Fecha: ${data.fechaEvento}` : '',
          data.numAsistentes ? `Asistentes: ${data.numAsistentes}` : '',
          data.ubicacion ? `Ubicación: ${data.ubicacion}` : '',
          data.presupuesto ? `Presupuesto: ${data.presupuesto}` : '',
          data.comentarios ? `Comentarios: ${data.comentarios}` : ''
        ].filter(Boolean).join('\n'),
        contactPersons: data.nombre ? [{
          name: data.nombre,
          email: data.email || '',
          phone: data.telefono || ''
        }] : []
      };

      const holdedRes = await fetch('https://api.holded.com/api/invoicing/v1/contacts', {
        method: 'POST',
        headers: { 'key': process.env.HOLDED_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(holdedBody)
      });
      const holdedData = await holdedRes.json();
      holdedId = holdedData.id || null;
    } catch (holdedErr) {
      // Holded sync is non-blocking — log but don't fail the request
      console.error('Holded sync error:', holdedErr.message);
    }

    return res.status(200).json({
      success: true,
      contactId: contactId,
      opportunityId: oppData.opportunity?.id || null,
      holdedId: holdedId,
      proposalId: proposalId,
      proposalUrl: proposalUrl
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
