/**
 * Merge Gmail contacts with Google Contacts, clean and categorize
 * Output: unified database ready for GHL import
 */

const fs = require('fs');

// Load data
const gmailContacts = JSON.parse(fs.readFileSync('data/gmail-contacts-extracted.json', 'utf8'));
const googleContacts = JSON.parse(fs.readFileSync('data/google-contacts.json', 'utf8'));

console.log('=== INPUT ===');
console.log(`Gmail contacts: ${gmailContacts.length}`);
console.log(`Google contacts: ${googleContacts.length}`);

// 1. Build phone lookup from Google Contacts (normalize names for matching)
const phoneByName = new Map();
const phoneByEmail = new Map();
googleContacts.forEach(c => {
  if (c.phone) {
    if (c.email) phoneByEmail.set(c.email.toLowerCase(), c.phone);
    if (c.name) {
      // Normalize name for fuzzy matching
      const key = c.name.toLowerCase().replace(/[^a-záéíóúñ\s]/gi, '').trim();
      phoneByName.set(key, { phone: c.phone, company: c.company, googleName: c.name });
    }
  }
});

// 2. Filter out noise/spam patterns
const NOISE_PATTERNS = [
  /noreply|no-reply|donotreply|no\.reply/i,
  /mailer-daemon|postmaster/i,
  /notifications?@/i,
  /newsletter@/i,
  /support@.*\.(com|io|net)$/i,
  /billing@/i,
  /^info@(?!eventosbarcelona)/i,  // keep info@eventosbarcelona
  /wordpress@/i,
  /accountservices@/i,
  /calendar-notification/i,
  /google\.com$/i,
  /googlemail\.com$/i,
  /facebookmail\.com$/i,
  /linkedin\.com$/i,
  /mailchimp\.com$/i,
  /sendgrid\.(net|com)$/i,
  /hubspot/i,
  /zendesk/i,
  /intercom/i,
  /shopify/i,
  /stripe\.com$/i,
  /paypal/i,
  /slack\.com$/i,
  /zoom\.(us|com)$/i,
  /canva\.com$/i,
  /dropbox\.com$/i,
  /figma\.com$/i,
  /notion\.so$/i,
  /trello\.com$/i,
  /asana\.com$/i,
  /jira/i,
  /atlassian/i,
  /github\.com$/i,
  /vercel\.com$/i,
  /amazonaws\.com$/i,
  /cloudflare/i,
  /ariba\.com$/i,
  /intuit\.com$/i,
  /@eventosbarcelona\.com$/i,  // skip internal
  /www\.eventosbarcelona\.com$/i,
];

function isNoise(email) {
  return NOISE_PATTERNS.some(p => p.test(email));
}

// 3. Categorize based on email subjects and patterns
function categorize(contact) {
  const subjects = (contact.subjects || []).join(' ').toLowerCase();
  const email = contact.email.toLowerCase();
  const name = (contact.name || '').toLowerCase();

  // Known provider/artist indicators
  const artistKeywords = /artista|artist|show|performance|actuaci|espectáculo|dj|music|band|grupo|cantante|bailar|dance|magician|mago|caricatur|animaci|entertaint|talent/i;
  const clientKeywords = /presupuesto|budget|quote|propuesta|proposal|evento corporativo|corporate|gala|dinner|cena|congress|congreso|incentive|team.?building|wedding|boda/i;
  const providerKeywords = /factura|invoice|albarán|proveedor|supplier|catering|venue|espacio|audiovisual|iluminaci|sound|sonido|transport|logistic|florist|decoraci|fotograf|video|print|imprenta|seguridad|security|limpieza|cleaning/i;
  const agencyKeywords = /agency|agencia|dmc|mice|pco|event.?planner|event.?management|incentiv|meeting|congress/i;
  const adminKeywords = /gestor|asesor|contab|fiscal|legal|abogado|notari|seguro|insurance|banco|bank/i;
  const venueKeywords = /hotel|restaurante|restaurant|sala|venue|espacio|finca|masía|castle|castillo|museo|museum|palacio|palace/i;

  if (artistKeywords.test(subjects) || artistKeywords.test(name)) return 'artista';
  if (venueKeywords.test(subjects) || venueKeywords.test(email)) return 'venue';
  if (agencyKeywords.test(subjects) || agencyKeywords.test(email)) return 'agencia/cliente';
  if (clientKeywords.test(subjects)) return 'cliente';
  if (providerKeywords.test(subjects)) return 'proveedor';
  if (adminKeywords.test(subjects) || adminKeywords.test(name) || adminKeywords.test(email)) return 'admin/gestor';

  // By email domain patterns
  if (/dmc|mice|event|incentiv|congress|meeting/.test(email)) return 'agencia/cliente';
  if (/hotel|resort|palace|palacio/.test(email)) return 'venue';

  return 'sin clasificar';
}

// 4. Process and merge
const filtered = gmailContacts.filter(c => !isNoise(c.email));
console.log(`\nAfter noise filter: ${filtered.length} (removed ${gmailContacts.length - filtered.length} noise)`);

const merged = filtered.map(c => {
  const email = c.email.toLowerCase();
  const phone = phoneByEmail.get(email) || '';
  const category = categorize(c);

  // Try to find phone by name matching
  let matchedPhone = phone;
  let googleInfo = null;
  if (!matchedPhone && c.name) {
    const nameKey = c.name.toLowerCase().replace(/[^a-záéíóúñ\s]/gi, '').trim();
    // Try partial match
    for (const [key, val] of phoneByName) {
      if (key.includes(nameKey) || nameKey.includes(key)) {
        matchedPhone = val.phone;
        googleInfo = val;
        break;
      }
    }
  }

  return {
    name: c.name || '',
    email: c.email,
    phone: matchedPhone,
    category,
    firstSeen: c.firstSeen,
    lastSeen: c.lastSeen,
    emailCount: c.emailCount,
    yearsActive: c.yearsActive,
    sampleSubject: (c.subjects || [])[0] || ''
  };
});

// 5. Add Google contacts that have phone but no email (and weren't in Gmail)
const gmailEmails = new Set(merged.map(c => c.email.toLowerCase()));
const phoneOnlyContacts = googleContacts
  .filter(c => c.phone && !c.email) // phone only
  .filter(c => c.name) // must have a name
  .map(c => ({
    name: c.name,
    email: '',
    phone: c.phone,
    category: categorize({ name: c.name, subjects: [], email: '' }),
    firstSeen: null,
    lastSeen: null,
    emailCount: 0,
    yearsActive: [],
    sampleSubject: '',
    source: 'google-contacts-only'
  }));

const allContacts = [...merged, ...phoneOnlyContacts];

// 6. Stats
console.log(`\n=== FINAL DATABASE ===`);
console.log(`Total contacts: ${allContacts.length}`);
console.log(`  From Gmail: ${merged.length}`);
console.log(`  Phone-only from Google: ${phoneOnlyContacts.length}`);
console.log(`  With email: ${allContacts.filter(c => c.email).length}`);
console.log(`  With phone: ${allContacts.filter(c => c.phone).length}`);
console.log(`  With both: ${allContacts.filter(c => c.email && c.phone).length}`);

// Category breakdown
const cats = {};
allContacts.forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1; });
console.log(`\n=== BY CATEGORY ===`);
Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

// Year breakdown (Gmail contacts only)
const byLastSeen = {};
merged.forEach(c => {
  const y = c.lastSeen || 'unknown';
  byLastSeen[y] = (byLastSeen[y] || 0) + 1;
});
console.log(`\n=== BY LAST ACTIVE YEAR ===`);
Object.entries(byLastSeen).sort().forEach(([year, count]) => {
  console.log(`  ${year}: ${count}`);
});

// 7. Save
fs.writeFileSync('data/ghl-import-full.json', JSON.stringify(allContacts, null, 2));

// CSV for GHL import
const headers = 'name,email,phone,category,firstSeen,lastSeen,emailCount,yearsActive,sampleSubject';
const rows = allContacts.map(c =>
  [c.name, c.email, c.phone, c.category, c.firstSeen || '', c.lastSeen || '', c.emailCount,
   (c.yearsActive || []).join(';'), c.sampleSubject]
    .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
    .join(',')
);
fs.writeFileSync('data/ghl-import-full.csv', [headers, ...rows].join('\n'));
console.log(`\nSaved to data/ghl-import-full.json and data/ghl-import-full.csv`);
