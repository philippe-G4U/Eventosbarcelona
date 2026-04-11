/**
 * Extract unique email contacts from Gmail efficiently
 * Only fetches headers (From/To) - much faster than full metadata
 * Categorizes by year and tries to identify clients vs artists
 *
 * Usage: node scripts/extract-email-contacts.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'service-account-key.json');
const TARGET_USER = 'xavi@eventosbarcelona.com';
const OUTPUT_FILE = 'data/gmail-contacts-extracted.json';
const BATCH_SIZE = 10;
const DELAY_MS = 300;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseEmailAddress(raw) {
  if (!raw) return [];
  // Handle multiple recipients
  const parts = raw.split(',');
  return parts.map(part => {
    const match = part.match(/(.+?)\s*<(.+?)>/);
    if (match) {
      return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim().toLowerCase() };
    }
    const email = part.trim().toLowerCase();
    return { name: '', email };
  }).filter(p => p.email && p.email.includes('@'));
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    clientOptions: { subject: TARGET_USER }
  });

  const gmail = google.gmail({ version: 'v1', auth });

  // Load existing progress
  let processed = new Set();
  let contactMap = new Map();
  if (fs.existsSync(OUTPUT_FILE)) {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    existing.forEach(c => {
      contactMap.set(c.email, c);
    });
    console.log(`Resuming with ${contactMap.size} contacts already found`);
  }

  // Process by year: 2020, 2021, 2022, 2023, 2024, 2025, 2026
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

  for (const year of years) {
    console.log(`\n=== Processing ${year} ===`);
    const query = `after:${year}/01/01 before:${year + 1}/01/01`;

    let messageIds = [];
    let pageToken = null;

    do {
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 500,
        q: query,
        pageToken: pageToken || undefined
      });

      if (res.data.messages) {
        messageIds = messageIds.concat(res.data.messages.map(m => m.id));
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    console.log(`${year}: ${messageIds.length} emails`);

    // Fetch in batches
    let count = 0;
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE);

      try {
        const results = await Promise.all(
          batch.map(id =>
            gmail.users.messages.get({
              userId: 'me',
              id,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date']
            })
          )
        );

        for (const res of results) {
          const msg = res.data;
          const getHeader = (name) => msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          const from = parseEmailAddress(getHeader('From'));
          const to = parseEmailAddress(getHeader('To'));
          const subject = getHeader('Subject');
          const allAddresses = [...from, ...to];

          for (const addr of allAddresses) {
            // Skip internal EB addresses
            if (addr.email.endsWith('@eventosbarcelona.com')) continue;
            // Skip noreply, notifications, etc
            if (/noreply|no-reply|mailer-daemon|notifications|donotreply/i.test(addr.email)) continue;

            if (!contactMap.has(addr.email)) {
              contactMap.set(addr.email, {
                name: addr.name,
                email: addr.email,
                firstSeen: year,
                lastSeen: year,
                emailCount: 0,
                subjects: [],
                yearsActive: [year]
              });
            }

            const contact = contactMap.get(addr.email);
            contact.emailCount++;
            if (!contact.name && addr.name) contact.name = addr.name;
            if (year < contact.firstSeen) contact.firstSeen = year;
            if (year > contact.lastSeen) contact.lastSeen = year;
            if (!contact.yearsActive.includes(year)) contact.yearsActive.push(year);
            if (contact.subjects.length < 5 && subject) contact.subjects.push(subject);
          }
        }

        count += batch.length;
        process.stdout.write(`\r  ${count}/${messageIds.length}`);
      } catch (err) {
        if (err.code === 429 || err.code === 403) {
          console.log(`\n  Rate limited. Saving ${contactMap.size} contacts and waiting 60s...`);
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify([...contactMap.values()], null, 2));
          await sleep(60000);
          i -= BATCH_SIZE;
          continue;
        }
        throw err;
      }

      await sleep(DELAY_MS);
    }

    // Save after each year
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([...contactMap.values()], null, 2));
    console.log(`\n  ${year} done. Total unique contacts: ${contactMap.size}`);
  }

  // Final summary
  const contacts = [...contactMap.values()];
  console.log(`\n\n=== FINAL SUMMARY ===`);
  console.log(`Total unique contacts: ${contacts.length}`);
  console.log(`Active in 2024+: ${contacts.filter(c => c.lastSeen >= 2024).length}`);
  console.log(`Active in 2023+: ${contacts.filter(c => c.lastSeen >= 2023).length}`);
  console.log(`Most frequent:`);
  contacts.sort((a, b) => b.emailCount - a.emailCount);
  contacts.slice(0, 30).forEach(c =>
    console.log(`  ${c.emailCount}x | ${c.name} | ${c.email} | ${c.firstSeen}-${c.lastSeen}`)
  );

  // Save CSV
  const headers = 'name,email,firstSeen,lastSeen,emailCount,yearsActive,sampleSubject';
  const rows = contacts.map(c =>
    [c.name, c.email, c.firstSeen, c.lastSeen, c.emailCount, c.yearsActive.join(';'), c.subjects[0] || '']
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(',')
  );
  fs.writeFileSync('data/gmail-contacts-extracted.csv', [headers, ...rows].join('\n'));
  console.log(`\nCSV saved to data/gmail-contacts-extracted.csv`);
}

main().catch(err => {
  console.error('Error:', err.message);
});
