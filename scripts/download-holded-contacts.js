#!/usr/bin/env node

/**
 * Download ALL contacts from Holded CRM via their API.
 * Saves results to data/holded-contacts.json
 *
 * Usage: node scripts/download-holded-contacts.js
 *
 * API docs: https://developers.holded.com/reference/list-contacts-1
 * Endpoint: GET https://api.holded.com/api/invoicing/v1/contacts
 * Auth: API key in "key" header
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env manually (no dotenv dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  });
  return env;
}

const envVars = loadEnv();
const API_KEY = process.env.HOLDED_API_KEY || envVars.HOLDED_API_KEY || 'e93ad5ddb43ef587cc5b6f55428c0907';
const BASE_URL = 'https://api.holded.com/api/invoicing/v1';
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'holded-contacts.json');

function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`  GET ${url}`);

    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'key': API_KEY,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}\nBody: ${body.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function downloadAllContacts() {
  console.log('\n=== Holded Contacts Download ===\n');
  console.log(`API Key: ${API_KEY.slice(0, 6)}...${API_KEY.slice(-4)}`);

  // The Holded list contacts endpoint returns all contacts at once (no pagination params documented).
  // However, some users report a page param works: /contacts?page=1
  // We'll try fetching page by page as a safety measure.

  let allContacts = [];
  let page = 1;
  const PAGE_SIZE_THRESHOLD = 50; // if a page returns fewer than this, assume we're done

  while (true) {
    console.log(`\nFetching page ${page}...`);
    try {
      const contacts = await apiGet(`/contacts?page=${page}`);

      if (!Array.isArray(contacts)) {
        // If page param is not supported, the API might return all contacts on page 1
        // or return an object. Handle both cases.
        if (page === 1 && typeof contacts === 'object') {
          console.log('  Response is an object, not an array. Checking structure...');
          console.log('  Keys:', Object.keys(contacts).join(', '));
          // Some APIs wrap results: { data: [...], total: N }
          if (contacts.data && Array.isArray(contacts.data)) {
            allContacts = contacts.data;
          } else {
            // Might be a single contact or error
            allContacts = [contacts];
          }
        }
        break;
      }

      if (contacts.length === 0) {
        console.log('  Empty page, done.');
        break;
      }

      allContacts = allContacts.concat(contacts);
      console.log(`  Got ${contacts.length} contacts (total so far: ${allContacts.length})`);

      // If we got very few results, likely no more pages
      if (contacts.length < PAGE_SIZE_THRESHOLD) {
        console.log('  Fewer results than threshold, assuming last page.');
        break;
      }

      page++;

      // Safety limit
      if (page > 100) {
        console.log('  Reached page limit (100), stopping.');
        break;
      }
    } catch (err) {
      if (page === 1) {
        throw err; // First page failed = real error
      }
      // Later pages failing might mean pagination isn't supported
      console.log(`  Page ${page} failed (${err.message}), assuming end of data.`);
      break;
    }
  }

  return allContacts;
}

function printSummary(contacts) {
  console.log('\n=== SUMMARY ===\n');
  console.log(`Total contacts: ${contacts.length}`);

  if (contacts.length === 0) {
    console.log('No contacts found.');
    return;
  }

  // Count by type
  const byType = {};
  contacts.forEach(c => {
    const type = c.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  });
  console.log('\nBy type:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Count with email
  const withEmail = contacts.filter(c => c.email && c.email.trim()).length;
  const withPhone = contacts.filter(c => (c.phone && c.phone.trim()) || (c.mobile && c.mobile.trim())).length;
  const withName = contacts.filter(c => c.name && c.name.trim()).length;

  console.log(`\nWith email: ${withEmail}`);
  console.log(`With phone/mobile: ${withPhone}`);
  console.log(`With name: ${withName}`);

  // Show first 5 as sample
  console.log('\nSample contacts (first 5):');
  contacts.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name || '(no name)'} | ${c.email || '(no email)'} | type: ${c.type || '?'}`);
  });
}

async function main() {
  try {
    const contacts = await downloadAllContacts();

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save to JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(contacts, null, 2), 'utf-8');
    console.log(`\nSaved ${contacts.length} contacts to ${OUTPUT_FILE}`);

    printSummary(contacts);
  } catch (err) {
    console.error('\nERROR:', err.message);
    process.exit(1);
  }
}

main();
