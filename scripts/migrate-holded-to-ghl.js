/**
 * Migración Holded + Mailchimp → GHL
 * Pasa todos los contactos existentes a GoHighLevel
 *
 * Uso: node scripts/migrate-holded-to-ghl.js [--dry-run] [--holded-only] [--mailchimp-only]
 */

import { readFileSync } from 'fs';
import { parse } from 'path';

const HOLDED_API_KEY = process.env.HOLDED_API_KEY;
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_HEADERS = {
  'Authorization': `Bearer ${GHL_API_KEY}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json'
};

const DRY_RUN = process.argv.includes('--dry-run');
const HOLDED_ONLY = process.argv.includes('--holded-only');
const MAILCHIMP_ONLY = process.argv.includes('--mailchimp-only');
const DELAY_MS = 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// --- CSV Parser (simple, no dependencies) ---
function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

// --- Holded mapping ---
function mapHoldedToGHL(contact) {
  const person = contact.contactPersons?.[0];
  const personName = person?.name || '';
  const { firstName, lastName } = splitName(personName);

  const tipo = contact.type === 'client' ? 'Cliente'
    : contact.type === 'supplier' ? 'Proveedor/Artista'
    : 'Otro';

  const tags = ['origen:holded-import'];
  if (contact.type === 'client') tags.push('tipo:cliente');
  if (contact.type === 'supplier') tags.push('tipo:artista');
  if (contact.tags?.length) contact.tags.forEach(t => tags.push(t));

  const langMap = { es: 'Español', en: 'English', ca: 'Català', fr: 'Français', de: 'Deutsch' };
  const idioma = langMap[contact.defaults?.language] || '';

  const noteParts = [];
  if (contact.code) noteParts.push(`NIF/CIF: ${contact.code}`);
  if (contact.iban) noteParts.push(`IBAN: ${contact.iban}`);
  if (contact.notes?.length) {
    contact.notes.forEach(n => {
      if (n.note || n.description) noteParts.push(n.note || n.description);
    });
  }

  const ghlBody = {
    locationId: GHL_LOCATION_ID,
    firstName: firstName || contact.name || '',
    lastName: lastName || '',
    email: contact.email || person?.email || '',
    phone: contact.mobile || contact.phone || person?.phone || '',
    companyName: contact.name || '',
    address1: contact.billAddress?.address || '',
    city: contact.billAddress?.city || '',
    state: contact.billAddress?.province || '',
    postalCode: contact.billAddress?.postalCode || '',
    country: contact.billAddress?.countryCode || '',
    website: contact.socialNetworks?.website || '',
    tags: tags,
    customFields: [
      { key: 'contact.tipo_contacto', field_value: tipo },
      { key: 'contact.idioma_cliente', field_value: idioma },
      { key: 'contact.notas_internas', field_value: noteParts.join('\n') || '' },
      { key: 'contact.como_nos_conocio', field_value: 'Histórico Holded' }
    ]
  };

  if (!ghlBody.email) delete ghlBody.email;
  if (!ghlBody.phone) delete ghlBody.phone;
  if (!ghlBody.website) delete ghlBody.website;
  if (!ghlBody.address1) delete ghlBody.address1;
  if (!ghlBody.postalCode) delete ghlBody.postalCode;
  if (!ghlBody.country) delete ghlBody.country;

  return ghlBody;
}

// --- Mailchimp mapping ---
function mapMailchimpToGHL(row) {
  const email = row['Email Address'] || '';
  const { firstName, lastName } = splitName(row['First Name'] || '');
  const lastNameCSV = row['Last Name'] || '';
  const rating = parseInt(row['MEMBER_RATING'] || '0');

  const tags = ['origen:mailchimp-import', 'tipo:cliente'];
  // Rating-based engagement tags
  if (rating >= 4) tags.push('engagement:top', 'prioridad:alta');
  else if (rating === 3) tags.push('engagement:medio');
  else if (rating === 2) tags.push('engagement:bajo');
  else tags.push('engagement:inactivo');

  // Country
  const cc = (row['CC'] || '').toUpperCase();
  const region = (row['REGION'] || '').toUpperCase();

  const ghlBody = {
    locationId: GHL_LOCATION_ID,
    firstName: firstName || email.split('@')[0] || '',
    lastName: lastNameCSV || lastName || '',
    email: email,
    tags: tags,
    customFields: [
      { key: 'contact.tipo_contacto', field_value: 'Cliente' },
      { key: 'contact.como_nos_conocio', field_value: 'Histórico Mailchimp' },
      { key: 'contact.notas_internas', field_value: `Mailchimp rating: ${rating}/5 | Suscrito desde: ${row['OPTIN_TIME'] || 'N/A'}` }
    ]
  };

  if (cc) ghlBody.country = cc;

  if (!ghlBody.email) delete ghlBody.email;

  return ghlBody;
}

// --- API calls ---
async function fetchHoldedContacts() {
  const res = await fetch('https://api.holded.com/api/invoicing/v1/contacts', {
    headers: { 'key': HOLDED_API_KEY }
  });
  return res.json();
}

function loadMailchimpContacts() {
  const scriptDir = new URL('.', import.meta.url).pathname;
  const dataDir = scriptDir.replace('/scripts/', '/data/');
  const subscribedPath = dataDir + 'mailchimp-subscribed.csv';

  try {
    const content = readFileSync(subscribedPath, 'utf-8');
    return parseCSV(content);
  } catch (err) {
    console.error(`Error leyendo ${subscribedPath}: ${err.message}`);
    return [];
  }
}

async function createGHLContact(body) {
  const res = await fetch(`${GHL_API}/contacts/upsert`, {
    method: 'POST',
    headers: GHL_HEADERS,
    body: JSON.stringify(body)
  });
  return res.json();
}

async function migrateSource(sourceName, contacts, mapFn, getLabel, getSkipCheck) {
  console.log(`\n--- ${sourceName}: ${contacts.length} contactos ---\n`);

  let created = 0, skipped = 0, errors = 0;

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const ghlBody = mapFn(c);
    const label = `[${i + 1}/${contacts.length}] ${getLabel(c)}`;

    if (getSkipCheck(ghlBody)) {
      console.log(`${label} — SKIP (sin email ni teléfono)`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${label} — OK (dry-run)`);
      console.log(`  → ${ghlBody.email || 'sin email'} | ${ghlBody.phone || 'sin tel'} | tags: ${ghlBody.tags.join(', ')}`);
      created++;
      continue;
    }

    try {
      const result = await createGHLContact(ghlBody);
      if (result.contact?.id) {
        console.log(`${label} — CREADO (${result.contact.id})`);
        created++;
      } else {
        console.log(`${label} — ERROR: ${JSON.stringify(result)}`);
        errors++;
      }
    } catch (err) {
      console.log(`${label} — ERROR: ${err.message}`);
      errors++;
    }

    await sleep(DELAY_MS);
  }

  return { created, skipped, errors, total: contacts.length };
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN — no se crean contactos ===' : '=== MIGRACIÓN EN VIVO ===');

  const results = [];

  // 1. Holded
  if (!MAILCHIMP_ONLY) {
    const holdedContacts = await fetchHoldedContacts();
    const holdedResult = await migrateSource(
      'HOLDED',
      holdedContacts,
      mapHoldedToGHL,
      (c) => c.name || '(sin nombre)',
      (body) => !body.email && !body.phone
    );
    results.push({ source: 'Holded', ...holdedResult });
  }

  // 2. Mailchimp (solo suscritos)
  if (!HOLDED_ONLY) {
    const mailchimpContacts = loadMailchimpContacts();
    const mcResult = await migrateSource(
      'MAILCHIMP',
      mailchimpContacts,
      mapMailchimpToGHL,
      (c) => c['Email Address'] || '(sin email)',
      (body) => !body.email
    );
    results.push({ source: 'Mailchimp', ...mcResult });
  }

  // Resumen final
  console.log('\n=============================');
  console.log('     RESUMEN FINAL');
  console.log('=============================');
  let totalCreated = 0, totalSkipped = 0, totalErrors = 0, totalAll = 0;
  results.forEach(r => {
    console.log(`\n${r.source}:`);
    console.log(`  Creados:  ${r.created}`);
    console.log(`  Saltados: ${r.skipped}`);
    console.log(`  Errores:  ${r.errors}`);
    console.log(`  Total:    ${r.total}`);
    totalCreated += r.created;
    totalSkipped += r.skipped;
    totalErrors += r.errors;
    totalAll += r.total;
  });
  console.log(`\nGRAND TOTAL: ${totalCreated} creados, ${totalSkipped} saltados, ${totalErrors} errores de ${totalAll} contactos`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
