export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API = 'https://services.leadconnectorhq.com';
  const TOKEN = process.env.GHL_API_KEY;
  const LOC = process.env.GHL_LOCATION_ID;
  const PIPELINE = process.env.GHL_PIPELINE_ARTISTAS;
  const STAGE = process.env.GHL_STAGE_SOLICITUD_RECIBIDA;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const HEADERS = {
    'Authorization': `Bearer ${TOKEN}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  };

  try {
    const data = req.body;
    const isUpdate = !!data._token; // Form sends _token when pre-filled
    const lang = (data.lang === 'en') ? 'en' : 'es';

    // Determine contact type based on selected disciplines
    const disciplinas = data.disciplinas || [];
    const hasProveedor = disciplinas.includes('Proveedores');
    const tipoContacto = hasProveedor ? 'Proveedor' : 'Artista';

    // Build tags (Ramiro v2 2026-04-17)
    const tags = ['follow_up', 'origen_form', `lang:${lang}`];

    // Build resumen_ia from form data
    const resumenIa = [
      `Categoría: ${tipoContacto}`,
      disciplinas.length ? `Disciplinas: ${disciplinas.join(', ')}` : '',
      data.subcategorias?.length ? `Subcategorías: ${data.subcategorias.join(', ')}` : '',
      data.formatoShow ? `Formato: ${data.formatoShow}` : '',
      data.nombreArtistico ? `Nombre artístico: ${data.nombreArtistico}` : '',
      data.compania ? `Compañía: ${data.compania}` : '',
      data.rangoCache ? `Caché: ${data.rangoCache}` : '',
      data.numArtistas ? `Nº artistas: ${data.numArtistas}` : '',
      data.duracionShow ? `Duración: ${data.duracionShow}` : '',
      data.bioShow ? `Bio: ${data.bioShow}` : ''
    ].filter(Boolean).join(' | ');

    // Build Supabase URL for the artist
    const supabaseUrl = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/artistas?email=eq.${encodeURIComponent(data.email || '')}` : '';

    // 1. Create/update contact
    const contactBody = {
      locationId: LOC,
      firstName: data.nombre || '',
      email: data.email || '',
      phone: data.telefono || '',
      city: data.ciudad || '',
      tags: tags,
      customFields: [
        { key: 'tipo', field_value: tipoContacto },
        { key: 'origen', field_value: 'Form' },
        { key: 'idioma', field_value: lang },
        { key: 'resumen_ia', field_value: resumenIa },
        { key: 'url_supabase', field_value: supabaseUrl },
        { key: 'acepto_privacidad', field_value: data.aceptoPrivacidad ? 'Si' : 'No' },
        { key: 'acepto_visibilidad', field_value: data.aceptoVisibilidad ? 'Si' : 'No' }
      ]
    };

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

    // 2. Create opportunity in Artistas pipeline (only for NEW submissions, not updates)
    let oppId = null;
    if (!isUpdate) {
      const oppBody = {
        locationId: LOC,
        pipelineId: PIPELINE,
        pipelineStageId: STAGE,
        contactId: contactId,
        name: `${data.nombreArtistico || data.compania || data.nombre || tipoContacto} — ${disciplinas.join(', ')}`,
        status: 'open',
        monetaryValue: 0,
        customFields: [
          { key: 'resumen_ia', field_value: resumenIa }
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

    // 3. Create contact in Holded (as supplier/proveedor) — only for new submissions
    let holdedId = null;
    if (!isUpdate) {
      try {
        const holdedBody = {
          name: data.nombreArtistico || data.compania || data.nombre || '',
          email: data.email || '',
          phone: data.telefono || '',
          type: 'supplier',
          tags: tags,
          notes: [
            data.disciplinas?.length ? `Disciplinas: ${data.disciplinas.join(', ')}` : '',
            data.subcategorias?.length ? `Subcategorías: ${data.subcategorias.join(', ')}` : '',
            data.formatoShow ? `Formato: ${data.formatoShow}` : '',
            data.bioShow ? `Bio: ${data.bioShow}` : '',
            data.rangoCache ? `Caché: ${data.rangoCache}` : '',
            data.numArtistas ? `Nº artistas: ${data.numArtistas}` : '',
            data.duracionShow ? `Duración: ${data.duracionShow}` : '',
            data.video1 ? `Video 1: ${data.video1}` : '',
            data.video2 ? `Video 2: ${data.video2}` : '',
            data.webRrss ? `Web/RRSS: ${data.webRrss}` : ''
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
        console.error('Holded sync error:', holdedErr.message);
      }
    }

    // 4. Upsert to Supabase (always — creates or updates by email)
    let supabaseToken = data._token || null;
    let artistaId = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabaseRow = {
          nombre: data.nombre || '',
          nombre_artistico: data.nombreArtistico || '',
          compania: data.compania || '',
          email: data.email || '',
          telefono: data.telefono || '',
          ciudad: data.ciudad || '',
          disciplinas: data.disciplinas || [],
          subcategorias: data.subcategorias || [],
          formato_show: data.formatoShow || '',
          bio_show: data.bioShow || '',
          show_unico: data.showUnico || [],
          video1: data.video1 || '',
          video2: data.video2 || '',
          web_rrss: data.webRrss || '',
          rider_tecnico: data.riderTecnico || '',
          fotos_urls: data.fotosUrls || [],
          rango_cache: data.rangoCache || '',
          num_artistas: data.numArtistas || '',
          duracion_show: data.duracionShow || '',
          shows_adicionales: data.showsAdicionales ? JSON.parse(data.showsAdicionales || '[]') : [],
          acepto_privacidad: data.aceptoPrivacidad || false,
          acepto_visibilidad: data.aceptoVisibilidad || false,
          ghl_contact_id: contactId,
          holded_id: holdedId,
          origen: isUpdate ? 'actualizacion-formulario' : 'web-formulario'
        };

        // Upsert by email — on conflict update all fields
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/artistas`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(supabaseRow)
          }
        );
        const sbData = await sbRes.json();
        if (Array.isArray(sbData) && sbData[0]) {
          if (sbData[0].token) supabaseToken = sbData[0].token;
          if (sbData[0].id) artistaId = sbData[0].id;
        }
      } catch (sbErr) {
        console.error('Supabase sync error:', sbErr.message);
      }
    }

    // 5. If the form supplied one or more shows, register them as pending_review
    //    rows linked to the artist. Requires migration 20260424_shows_artista_fk
    //    to have run — otherwise the insert fails on the new columns and we
    //    just log it. The artist record is already saved, so this is non-fatal.
    const createdShows = [];
    if (SUPABASE_URL && SUPABASE_KEY && artistaId && Array.isArray(data.shows) && data.shows.length) {
      for (const show of data.shows) {
        if (!show || !show.name) continue;
        const slugBase = String(show.name).toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'show';
        const slug = `${slugBase}-${Math.random().toString(36).slice(2, 8)}`;

        const showRow = {
          id: slug,
          name: show.name || '',
          category: show.category || '',
          subcategory: show.subcategory || '',
          description: show.description || '',
          base_price: parseInt(show.price || show.basePrice) || 0,
          price_note: show.priceNote || '',
          video_url: show.videoUrl || '',
          image_url: show.imageUrl || '',
          source: 'artist-form',
          active: true,
          artista_id: artistaId,
          status: 'pending_review',
          submitted_at: new Date().toISOString()
        };

        try {
          const shRes = await fetch(`${SUPABASE_URL}/rest/v1/shows`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(showRow)
          });
          if (shRes.ok) {
            createdShows.push(slug);
            // Tag the GHL contact so Xavi can filter by the shows they submitted
            try {
              await fetch(`${API}/contacts/${contactId}/tags`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({ tags: [`show:${slug}`] })
              });
            } catch (tagErr) {
              console.error('GHL show tag error:', tagErr.message);
            }
          } else {
            console.warn(`Show ${slug} insert ${shRes.status}: ${await shRes.text()}`);
          }
        } catch (e) {
          console.error('Show create error:', e.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      contactId: contactId,
      opportunityId: oppId,
      holdedId: holdedId,
      supabaseToken: supabaseToken,
      artistaId: artistaId,
      createdShows: createdShows,
      updated: isUpdate
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
