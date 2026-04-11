/**
 * Create opportunities for all HOT contacts in GHL
 * Uses correct pagination with startAfter + startAfterId
 */

require('dotenv').config();

const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const PIPELINE_CLIENTES = process.env.GHL_PIPELINE_CLIENTES;
const PIPELINE_ARTISTAS = process.env.GHL_PIPELINE_ARTISTAS;
const STAGE_NEW_LEAD = process.env.GHL_STAGE_NEW_LEAD;
const STAGE_SOLICITUD = process.env.GHL_STAGE_SOLICITUD_RECIBIDA;

const BASE = 'https://services.leadconnectorhq.com';
const DELAY = 350;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function getAllContacts() {
  let all = [];
  const seen = new Set();
  let nextUrl = `/contacts/?locationId=${LOCATION_ID}&limit=100`;

  while (nextUrl) {
    const data = await api('GET', nextUrl);
    const contacts = data.contacts || [];
    if (contacts.length === 0) break;

    let newCount = 0;
    for (const c of contacts) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        all.push(c);
        newCount++;
      }
    }
    if (newCount === 0) break;

    // Use nextPageUrl from meta
    const meta = data.meta || {};
    if (meta.nextPageUrl) {
      nextUrl = meta.nextPageUrl.replace(BASE, '');
    } else {
      break;
    }

    console.log(`  ${all.length} contacts...`);
    await sleep(DELAY);
  }

  return all;
}

async function main() {
  console.log('=== Descargando TODOS los contactos de GHL ===');
  const contacts = await getAllContacts();
  console.log(`Total contactos en GHL: ${contacts.length}`);

  // Filter only those from our import (have origen:gmail-import tag)
  const ourContacts = contacts.filter(c =>
    c.tags?.includes('origen:gmail-import')
  );
  console.log(`Contactos de nuestro import: ${ourContacts.length}`);

  // Classify by tags (case insensitive)
  const artistas = ourContacts.filter(c => c.tags?.some(t => t.toLowerCase() === 'tipo:artista'));
  const clientes = ourContacts.filter(c => !c.tags?.some(t => t.toLowerCase() === 'tipo:artista'));

  console.log(`  Artistas: ${artistas.length}`);
  console.log(`  Clientes/otros: ${clientes.length}`);

  // Get existing opportunities to skip duplicates
  console.log('\nChecking existing opportunities...');
  const existingContactIds = new Set();

  for (const pipelineId of [PIPELINE_ARTISTAS, PIPELINE_CLIENTES]) {
    let page = 1;
    while (true) {
      try {
        const data = await api('GET', `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100&page=${page}`);
        const opps = data.opportunities || [];
        if (opps.length === 0) break;
        opps.forEach(o => {
          if (o.contact?.id) existingContactIds.add(o.contact.id);
          if (o.contactId) existingContactIds.add(o.contactId);
        });
        if (opps.length < 100) break;
        page++;
        await sleep(DELAY);
      } catch(e) {
        break;
      }
    }
  }
  console.log(`Oportunidades existentes: ${existingContactIds.size}`);

  const artistasToCreate = artistas.filter(c => !existingContactIds.has(c.id));
  const clientesToCreate = clientes.filter(c => !existingContactIds.has(c.id));
  const total = artistasToCreate.length + clientesToCreate.length;
  console.log(`\nPor crear: ${artistasToCreate.length} artistas + ${clientesToCreate.length} clientes = ${total}`);

  if (total === 0) {
    console.log('Todas las oportunidades ya existen!');
    return;
  }

  let created = 0;
  let errors = 0;

  console.log('\n=== Creando oportunidades ===');

  // Artistas → Pipeline Artistas
  if (artistasToCreate.length > 0) {
    console.log('\nArtistas → Pipeline Artistas...');
    for (const c of artistasToCreate) {
      try {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Sin nombre';
        const activityTag = (c.tags || []).find(t => t.startsWith('actividad:'));
        const activity = activityTag ? activityTag.replace('actividad:', '') : '';
        const oppName = activity ? `${name} — ${activity}` : name;

        await api('POST', '/opportunities/', {
          pipelineId: PIPELINE_ARTISTAS,
          pipelineStageId: STAGE_SOLICITUD,
          locationId: LOCATION_ID,
          contactId: c.id,
          name: oppName,
          status: 'open'
        });
        created++;
        process.stdout.write(`\r  ${created}/${total} creadas`);
      } catch (err) {
        errors++;
        console.log(`\n  Error ${c.email}: ${err.message.substring(0, 120)}`);
      }
      await sleep(DELAY);
    }
  }

  // Clientes → Pipeline Clientes
  if (clientesToCreate.length > 0) {
    console.log('\n\nClientes → Pipeline Clientes...');
    for (const c of clientesToCreate) {
      try {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Sin nombre';
        await api('POST', '/opportunities/', {
          pipelineId: PIPELINE_CLIENTES,
          pipelineStageId: STAGE_NEW_LEAD,
          locationId: LOCATION_ID,
          contactId: c.id,
          name: name,
          status: 'open'
        });
        created++;
        process.stdout.write(`\r  ${created}/${total} creadas`);
      } catch (err) {
        errors++;
        console.log(`\n  Error ${c.email}: ${err.message.substring(0, 120)}`);
      }
      await sleep(DELAY);
    }
  }

  console.log(`\n\n=== RESULTADO ===`);
  console.log(`Oportunidades creadas: ${created}`);
  console.log(`Errores: ${errors}`);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
});
