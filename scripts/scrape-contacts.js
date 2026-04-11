/**
 * Scrape all contacts from Xavi's Google account via Service Account
 * Usage: node scripts/scrape-contacts.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'service-account-key.json');
const TARGET_USER = 'xavi@eventosbarcelona.com';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/contacts.readonly'],
    clientOptions: { subject: TARGET_USER }
  });

  const people = google.people({ version: 'v1', auth });

  let allContacts = [];
  let nextPageToken = null;

  do {
    const res = await people.people.connections.list({
      resourceName: 'people/me',
      personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
      pageSize: 1000,
      pageToken: nextPageToken || undefined
    });

    if (res.data.connections) {
      allContacts = allContacts.concat(res.data.connections);
    }
    nextPageToken = res.data.nextPageToken;
    console.log(`Fetched ${allContacts.length} contacts...`);
  } while (nextPageToken);

  // Format
  const formatted = allContacts.map(c => ({
    name: c.names?.[0]?.displayName || '',
    firstName: c.names?.[0]?.givenName || '',
    lastName: c.names?.[0]?.familyName || '',
    email: c.emailAddresses?.[0]?.value || '',
    phone: c.phoneNumbers?.[0]?.value || '',
    company: c.organizations?.[0]?.name || '',
    title: c.organizations?.[0]?.title || '',
    address: c.addresses?.[0]?.formattedValue || ''
  }));

  // Save JSON
  fs.writeFileSync('data/google-contacts.json', JSON.stringify(formatted, null, 2));
  console.log(`\n${formatted.length} contacts saved to data/google-contacts.json`);

  // Save CSV
  const headers = 'name,firstName,lastName,email,phone,company,title,address';
  const rows = formatted.map(c =>
    [c.name, c.firstName, c.lastName, c.email, c.phone, c.company, c.title, c.address]
      .map(v => `"${(v || '').replace(/"/g, '""')}"`)
      .join(',')
  );
  fs.writeFileSync('data/google-contacts.csv', [headers, ...rows].join('\n'));
  console.log(`CSV saved to data/google-contacts.csv`);
}

main().catch(console.error);
