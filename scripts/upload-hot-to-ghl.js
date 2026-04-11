/**
 * Clean GHL and upload HOT contacts
 * 1. Delete existing 100 Mailchimp contacts
 * 2. Upload HOT contacts to correct pipelines
 */

require('dotenv').config();
const fs = require('fs');

const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const PIPELINE_CLIENTES = process.env.GHL_PIPELINE_CLIENTES;
const PIPELINE_ARTISTAS = process.env.GHL_PIPELINE_ARTISTAS;
const STAGE_NEW_LEAD = process.env.GHL_STAGE_NEW_LEAD;
const STAGE_SOLICITUD = process.env.GHL_STAGE_SOLICITUD_RECIBIDA;

const BASE = 'https://services.leadconnectorhq.com';
const DELAY = 500; // ms between API calls

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// Parse CSV
function parseCSV(file) {
  const csv = fs.readFileSync(file, 'utf8');
  const lines = csv.split('\n');
  const headerLine = lines[0];
  const rows = lines.slice(1).filter(l => l.trim());

  function parse(line) {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
      else cur += line[i];
    }
    result.push(cur);
    return result;
  }

  const headers = parse(headerLine);
  const idx = {}; headers.forEach((h, i) => idx[h] = i);
  return { data: rows.map(parse), idx };
}

async function main() {
  // Step 1: Delete existing contacts
  console.log('=== PASO 1: Limpiar GHL ===');
  const existing = JSON.parse(fs.readFileSync('data/ghl-existing-contacts.json', 'utf8'));
  console.log(`Borrando ${existing.length} contactos existentes...`);

  let deleted = 0;
  for (const contact of existing) {
    try {
      await api('DELETE', `/contacts/${contact.id}`);
      deleted++;
      process.stdout.write(`\r  ${deleted}/${existing.length} borrados`);
      await sleep(DELAY);
    } catch (err) {
      console.log(`\n  Error borrando ${contact.email}: ${err.message}`);
    }
  }
  console.log(`\nBorrados: ${deleted}`);

  // Step 2: Load HOT contacts
  console.log('\n=== PASO 2: Subir HOT contacts ===');
  const { data, idx } = parseCSV('data/review-completo-xavi.csv');

  const hot = data.filter(r =>
    r[idx['Temperatura']] === 'HOT' &&
    r[idx['Categoría (auto)']] !== 'Admin'
  );

  console.log(`HOT contacts to upload: ${hot.length}`);

  // Split by pipeline
  const artistas = hot.filter(r => r[idx['Categoría (auto)']] === 'Artista');
  const clientes = hot.filter(r => ['Cliente', 'Venue', 'Sin clasificar', ''].includes(r[idx['Categoría (auto)']]));
  const proveedores = hot.filter(r => r[idx['Categoría (auto)']] === 'Proveedor');

  console.log(`  Artistas: ${artistas.length} → Pipeline Artistas`);
  console.log(`  Clientes/Venues/Sin clasificar: ${clientes.length} → Pipeline Clientes`);
  console.log(`  Proveedores: ${proveedores.length} → Pipeline Clientes (tag: proveedor)`);

  // Upload function
  async function uploadContact(row, pipeline, stage, extraTags = []) {
    const firstName = (row[idx['Nombre']] || '').split(/\s+/)[0] || '';
    const lastName = (row[idx['Nombre']] || '').split(/\s+/).slice(1).join(' ') || '';
    const email = row[idx['Email']] || '';
    const phone = row[idx['Teléfono']] || '';
    const category = row[idx['Categoría (auto)']] || 'sin-clasificar';
    const activity = row[idx['Actividad artista']] || '';
    const conversations = row[idx['Conversaciones']] || '';
    const lastYear = row[idx['Último año']] || '';

    const tags = [
      'HOT',
      `tipo:${category.toLowerCase()}`,
      'origen:gmail-import',
      ...extraTags
    ];
    if (activity) tags.push(`actividad:${activity.toLowerCase()}`);

    const body = {
      locationId: LOCATION_ID,
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
      tags,
      source: 'Gmail Import',
      country: 'ES'
    };

    // Remove undefined fields
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

    const result = await api('POST', '/contacts/', body);
    const contactId = result.contact?.id;

    // Add to pipeline
    if (contactId && pipeline) {
      try {
        await api('POST', `/contacts/${contactId}/opportunities`, {
          locationId: LOCATION_ID,
          pipelineId: pipeline,
          pipelineStageId: stage,
          name: `${firstName} ${lastName}`.trim() || email,
          status: 'open',
          contactId
        });
      } catch (e) {
        // Pipeline assignment might fail, contact is still created
      }
    }

    return contactId;
  }

  // Upload artistas
  let uploaded = 0;
  let errors = 0;
  const total = artistas.length + clientes.length + proveedores.length;

  console.log('\nSubiendo artistas...');
  for (const row of artistas) {
    try {
      await uploadContact(row, PIPELINE_ARTISTAS, STAGE_SOLICITUD);
      uploaded++;
      process.stdout.write(`\r  ${uploaded}/${total} subidos`);
      await sleep(DELAY);
    } catch (err) {
      errors++;
      if (err.message.includes('422') || err.message.includes('Duplicate')) {
        // Skip duplicates silently
      } else {
        console.log(`\n  Error: ${row[idx['Email']]} - ${err.message}`);
      }
      await sleep(DELAY);
    }
  }

  console.log('\nSubiendo clientes/venues/sin clasificar...');
  for (const row of clientes) {
    try {
      await uploadContact(row, PIPELINE_CLIENTES, STAGE_NEW_LEAD);
      uploaded++;
      process.stdout.write(`\r  ${uploaded}/${total} subidos`);
      await sleep(DELAY);
    } catch (err) {
      errors++;
      if (!err.message.includes('422')) {
        console.log(`\n  Error: ${row[idx['Email']]} - ${err.message}`);
      }
      await sleep(DELAY);
    }
  }

  console.log('\nSubiendo proveedores...');
  for (const row of proveedores) {
    try {
      await uploadContact(row, PIPELINE_CLIENTES, STAGE_NEW_LEAD, ['proveedor']);
      uploaded++;
      process.stdout.write(`\r  ${uploaded}/${total} subidos`);
      await sleep(DELAY);
    } catch (err) {
      errors++;
      if (!err.message.includes('422')) {
        console.log(`\n  Error: ${row[idx['Email']]} - ${err.message}`);
      }
      await sleep(DELAY);
    }
  }

  console.log(`\n\n=== RESULTADO ===`);
  console.log(`Subidos: ${uploaded}`);
  console.log(`Errores: ${errors}`);
  console.log(`Total: ${uploaded + errors}`);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
});
