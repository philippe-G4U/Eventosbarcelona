/**
 * Analyze Gmail threads to identify contacts with real back-and-forth conversations
 * Uses threadId to group messages accurately
 *
 * Usage: node scripts/analyze-threads.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'service-account-key.json');
const TARGET_USER = 'xavi@eventosbarcelona.com';
const OUTPUT_FILE = 'data/gmail-threads-analysis.json';
const BATCH_SIZE = 10;
const DELAY_MS = 300;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseEmail(raw) {
  if (!raw) return '';
  const match = raw.match(/<(.+?)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    clientOptions: { subject: TARGET_USER }
  });

  const gmail = google.gmail({ version: 'v1', auth });

  // Get threads with multiple messages (2020+)
  console.log('Listing threads from 2020+...');
  let allThreadIds = [];
  let pageToken = null;

  do {
    const res = await gmail.users.threads.list({
      userId: 'me',
      maxResults: 500,
      q: 'after:2020/01/01',
      pageToken: pageToken || undefined
    });

    if (res.data.threads) {
      allThreadIds = allThreadIds.concat(res.data.threads.map(t => ({
        id: t.id,
        snippet: t.snippet
      })));
    }
    pageToken = res.data.nextPageToken;
    console.log(`Found ${allThreadIds.length} threads...`);
  } while (pageToken);

  console.log(`\nTotal threads: ${allThreadIds.length}`);

  // Now fetch each thread to count messages and participants
  const contactThreads = new Map(); // email -> { threads, totalMsgs, subjects }
  let processed = 0;

  for (let i = 0; i < allThreadIds.length; i += BATCH_SIZE) {
    const batch = allThreadIds.slice(i, i + BATCH_SIZE);

    try {
      const results = await Promise.all(
        batch.map(t =>
          gmail.users.threads.get({
            userId: 'me',
            id: t.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          })
        )
      );

      for (const res of results) {
        const thread = res.data;
        const msgCount = thread.messages?.length || 0;

        if (msgCount < 2) continue; // Skip single-message threads

        // Get participants and check for back-and-forth
        const senders = new Set();
        const allParticipants = new Set();
        let subject = '';
        let hasDate = '';

        for (const msg of (thread.messages || [])) {
          const getH = (n) => msg.payload?.headers?.find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
          const from = parseEmail(getH('From'));
          const to = parseEmail(getH('To'));
          if (!subject) subject = getH('Subject').replace(/^(re|fwd|fw|rv):\s*/gi, '').trim();
          if (!hasDate) hasDate = getH('Date');

          if (from) { senders.add(from); allParticipants.add(from); }
          if (to) allParticipants.add(to);
        }

        // Must have at least 2 different senders (= actual back-and-forth)
        if (senders.size < 2) continue;

        // Get external participants
        const external = [...allParticipants].filter(e =>
          !e.endsWith('@eventosbarcelona.com') &&
          !e.endsWith('@www.eventosbarcelona.com') &&
          !/noreply|no-reply|mailer-daemon|notification/i.test(e)
        );

        for (const email of external) {
          if (!contactThreads.has(email)) {
            contactThreads.set(email, {
              email,
              conversationThreads: 0,
              totalBackAndForthMsgs: 0,
              subjects: []
            });
          }
          const c = contactThreads.get(email);
          c.conversationThreads++;
          c.totalBackAndForthMsgs += msgCount;
          if (c.subjects.length < 5) c.subjects.push(subject);
        }
      }

      processed += batch.length;
      process.stdout.write(`\r  ${processed}/${allThreadIds.length} threads`);
    } catch (err) {
      if (err.code === 429 || err.code === 403) {
        console.log(`\n  Rate limited. Saving and waiting 60s...`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify([...contactThreads.values()], null, 2));
        await sleep(60000);
        i -= BATCH_SIZE;
        continue;
      }
      throw err;
    }

    await sleep(DELAY_MS);

    // Save every 1000
    if (processed % 1000 < BATCH_SIZE) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify([...contactThreads.values()], null, 2));
    }
  }

  // Final save
  const results = [...contactThreads.values()].sort((a, b) => b.conversationThreads - a.conversationThreads);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log(`\n\n=== RESULTS ===`);
  console.log(`Contacts with real conversations (2+ msgs, 2+ senders): ${results.length}`);
  console.log(`\nTop 30 by conversation threads:`);
  results.slice(0, 30).forEach(c =>
    console.log(`  ${c.conversationThreads} threads (${c.totalBackAndForthMsgs} msgs) | ${c.email} | ${c.subjects[0] || ''}`)
  );

  // Save CSV
  const headers = 'email,conversationThreads,totalBackAndForthMsgs,sampleSubjects';
  const rows = results.map(c =>
    [c.email, c.conversationThreads, c.totalBackAndForthMsgs, c.subjects.join(' | ')]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(',')
  );
  fs.writeFileSync('data/gmail-threads-analysis.csv', [headers, ...rows].join('\n'));
  console.log(`\nSaved to ${OUTPUT_FILE} and data/gmail-threads-analysis.csv`);
}

main().catch(err => {
  console.error('Error:', err.message);
});
