/**
 * Merge Holded contacts into review-completo-xavi.csv
 * - Enrich existing contacts with Holded data (phone, address, NIF)
 * - Add new Holded contacts not already in the CSV
 * - Mark origin as "Holded" for new ones
 */

const fs = require('fs');

// Load Holded contacts
const holded = JSON.parse(fs.readFileSync('data/holded-contacts.json', 'utf8'));

// Load existing CSV
const csvRaw = fs.readFileSync('data/review-completo-xavi.csv', 'utf8');
const lines = csvRaw.split('\n');
const headers = lines[0];
const rows = lines.slice(1).filter(l => l.trim());

// Parse CSV rows (handle quoted fields)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

// Header indices
const headerFields = parseCSVLine(headers);
const idx = {};
headerFields.forEach((h, i) => idx[h] = i);

console.log('Headers:', headerFields);
console.log('CSV rows:', rows.length);

// Build email lookup from existing CSV
const existingByEmail = new Map();
const parsedRows = rows.map(r => parseCSVLine(r));
parsedRows.forEach((fields, i) => {
  const email = (fields[idx['Email']] || '').toLowerCase().trim();
  if (email) existingByEmail.set(email, i);
});

// Build name lookup for fuzzy matching
const existingByName = new Map();
parsedRows.forEach((fields, i) => {
  const name = (fields[idx['Nombre']] || '').toLowerCase().trim();
  if (name) existingByName.set(name, i);
});

console.log('\n=== HOLDED CONTACTS ===');
console.log('Total:', holded.length);
console.log('With email:', holded.filter(h => h.email).length);
console.log('With phone/mobile:', holded.filter(h => h.phone || h.mobile).length);
console.log('Types:', [...new Set(holded.map(h => h.type || 'unknown'))].join(', '));

// Process Holded contacts
let enriched = 0;
let added = 0;
let skipped = 0;
const newRows = [];

for (const h of holded) {
  const email = (h.email || '').toLowerCase().trim();
  const phone = h.mobile || h.phone || '';
  const name = (h.tradeName || h.name || '').trim();
  const company = (h.name || '').trim();

  // Map Holded type to our categories
  let category = '';
  if (h.type === 'client') category = 'Cliente';
  else if (h.type === 'supplier' || h.type === 'creditor') category = 'Proveedor';

  // Check if already in CSV by email
  if (email && existingByEmail.has(email)) {
    const rowIdx = existingByEmail.get(email);
    const fields = parsedRows[rowIdx];

    // Enrich: add phone if missing
    if (!fields[idx['Teléfono']] && phone) {
      fields[idx['Teléfono']] = phone;
      enriched++;
    }

    // Mark as also in Holded
    if (fields[idx['Ya en GHL']] === 'Sí') {
      fields[idx['Ya en GHL']] = 'Sí + Holded';
    } else if (!fields[idx['Ya en GHL']] || fields[idx['Ya en GHL']] === 'No') {
      fields[idx['Ya en GHL']] = 'Holded';
    }

    // Update category if we have one and theirs is empty
    if (category && !fields[idx['Categoría (auto)']]) {
      fields[idx['Categoría (auto)']] = category;
    }

    continue;
  }

  // Check by name (fuzzy)
  const nameLower = name.toLowerCase().trim();
  if (nameLower && existingByName.has(nameLower)) {
    const rowIdx = existingByName.get(nameLower);
    const fields = parsedRows[rowIdx];

    // Enrich
    if (!fields[idx['Teléfono']] && phone) {
      fields[idx['Teléfono']] = phone;
      enriched++;
    }
    if (!fields[idx['Email']] && email) {
      fields[idx['Email']] = email;
      enriched++;
    }
    if (fields[idx['Ya en GHL']] === 'Sí') {
      fields[idx['Ya en GHL']] = 'Sí + Holded';
    } else if (!fields[idx['Ya en GHL']] || fields[idx['Ya en GHL']] === 'No') {
      fields[idx['Ya en GHL']] = 'Holded';
    }

    continue;
  }

  // Skip if no email and no phone
  if (!email && !phone) {
    skipped++;
    continue;
  }

  // New contact - add to CSV
  // Headers: Subir (X),Nombre,Email,Teléfono,Categoría (auto),Tipo,Temperatura,Actividad artista,Conversaciones,Último año,Ejemplo email,Origen,Ya en GHL,Tags GHL
  const newRow = new Array(headerFields.length).fill('');
  newRow[idx['Subir (X)']] = '';
  newRow[idx['Nombre']] = name;
  newRow[idx['Email']] = email;
  newRow[idx['Teléfono']] = phone;
  newRow[idx['Categoría (auto)']] = category;
  newRow[idx['Tipo']] = '';
  newRow[idx['Temperatura']] = 'Holded';
  newRow[idx['Actividad artista']] = '';
  newRow[idx['Conversaciones']] = '';
  newRow[idx['Último año']] = '';
  newRow[idx['Ejemplo email']] = '';
  newRow[idx['Origen']] = 'Holded';
  newRow[idx['Ya en GHL']] = 'Holded';
  newRow[idx['Tags GHL']] = '';

  newRows.push(newRow);
  added++;
}

console.log('\n=== RESULTADO ===');
console.log('Enriquecidos (teléfono/email añadido):', enriched);
console.log('Nuevos contactos añadidos:', added);
console.log('Saltados (sin email ni teléfono):', skipped);
console.log('Ya existían (por email o nombre):', holded.length - added - skipped);

// Rebuild CSV
const allRows = [...parsedRows, ...newRows];

function toCSVLine(fields) {
  return fields.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',');
}

const output = [headers, ...allRows.map(toCSVLine)].join('\n');
fs.writeFileSync('data/review-completo-xavi.csv', output);

console.log('\nTotal contactos en CSV final:', allRows.length);
console.log('Guardado en data/review-completo-xavi.csv');
