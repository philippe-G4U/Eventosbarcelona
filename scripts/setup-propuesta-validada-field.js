/**
 * Crear custom field en GHL:
 *   - url_propuesta_validada (TEXT, contactos)
 *     Se rellena cuando Xavi valida la propuesta pre-validada.
 */

require('dotenv').config();

const API_KEY = process.env.GHL_API_KEY;
const LOC = process.env.GHL_LOCATION_ID;
const BASE = 'https://services.leadconnectorhq.com';

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
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function main() {
  console.log('=== Creando campo URL Propuesta Validada ===\n');

  const r = await api('POST', `/locations/${LOC}/customFields`, {
    name: 'URL Propuesta Validada',
    dataType: 'TEXT',
    model: 'contact',
    position: 8
  });

  const id = r.data?.customField?.id;
  const key = r.data?.customField?.fieldKey;
  console.log(`  ${id ? '✓' : '✗'} URL Propuesta Validada → id: ${id || 'ERROR ' + r.status}`);
  if (key) console.log(`    fieldKey: ${key}`);
  if (!id) console.log(`    response: ${JSON.stringify(r.data)}`);

  console.log('\n=== Verificando campos de propuesta ===\n');
  const existing = await api('GET', `/locations/${LOC}/customFields`);
  const fields = existing.data?.customFields || [];

  for (const name of ['URL de la propuesta', 'URL Propuesta Validada']) {
    const found = fields.find(f => f.name === name);
    console.log(`  ${found ? '✓' : '✗'} ${name}${found ? ' (id: ' + found.id + ')' : ' — NO ENCONTRADO'}`);
  }

  console.log('\n=== DONE ===');
}

main().catch(err => console.error('Error fatal:', err.message));
