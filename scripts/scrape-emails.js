/**
 * Scrape all emails from Xavi's Gmail via Service Account
 * With rate limiting and incremental saving
 * Usage: node scripts/scrape-emails.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'service-account-key.json');
const TARGET_USER = 'xavi@eventosbarcelona.com';
const OUTPUT_FILE = 'data/gmail-emails.json';
const BATCH_SIZE = 10;
const DELAY_MS = 500; // 500ms between batches to stay under quota

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    clientOptions: { subject: TARGET_USER }
  });

  const gmail = google.gmail({ version: 'v1', auth });

  // Load existing progress
  let emails = [];
  let processedIds = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    emails = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    processedIds = new Set(emails.map(e => e.id));
    console.log(`Resuming: ${emails.length} emails already downloaded`);
  }

  // List all message IDs (only from 2020 onwards)
  console.log('Listing emails from 2020 onwards...');
  let allMessageIds = [];
  let pageToken = null;

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 500,
      q: 'after:2020/01/01',
      pageToken: pageToken || undefined
    });

    if (res.data.messages) {
      allMessageIds = allMessageIds.concat(res.data.messages.map(m => m.id));
    }
    pageToken = res.data.nextPageToken;
    console.log(`Found ${allMessageIds.length} emails...`);
  } while (pageToken);

  // Filter out already processed
  const toProcess = allMessageIds.filter(id => !processedIds.has(id));
  console.log(`\nTotal: ${allMessageIds.length} emails since 2020. New to process: ${toProcess.length}`);

  // Fetch metadata in small batches with delay
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

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
        emails.push({
          id: msg.id,
          date: getHeader('Date'),
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          snippet: msg.snippet || '',
          labels: msg.labelIds || []
        });
      }
    } catch (err) {
      if (err.code === 429 || err.code === 403) {
        console.log(`Rate limited at ${emails.length}. Saving and waiting 60s...`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(emails, null, 2));
        await sleep(60000);
        i -= BATCH_SIZE; // retry this batch
        continue;
      }
      throw err;
    }

    // Save every 200 emails
    if (emails.length % 200 < BATCH_SIZE) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(emails, null, 2));
    }

    const total = emails.length;
    const pct = ((total / allMessageIds.length) * 100).toFixed(1);
    process.stdout.write(`\rProcessed ${total}/${allMessageIds.length} (${pct}%)`);

    await sleep(DELAY_MS);
  }

  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(emails, null, 2));
  console.log(`\n\nDone! ${emails.length} emails saved to ${OUTPUT_FILE}`);

  // Summary
  const uniqueSenders = new Set(emails.map(e => e.from));
  console.log(`Unique senders: ${uniqueSenders.size}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  // Try to save what we have
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('Partial data was saved.');
  }
});
