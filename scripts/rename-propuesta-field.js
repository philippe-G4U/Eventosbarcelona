/**
 * Renombra el campo existente "URL de la propuesta" → "URL Propuesta Prevalidada"
 * para coherencia con el nuevo campo "URL Propuesta Validada".
 */

require('dotenv').config();

const API_KEY = process.env.GHL_API_KEY;
const LOC = process.env.GHL_LOCATION_ID;
const BASE = 'https://services.leadconnectorhq.com';
const FIELD_ID = 'vQ4c2U1klXrQgek3nx44';

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

(async () => {
  const r = await api('PUT', `/locations/${LOC}/customFields/${FIELD_ID}`, {
    name: 'URL Propuesta Prevalidada'
  });
  console.log('Status:', r.status);
  console.log('Response:', JSON.stringify(r.data, null, 2));
})();
