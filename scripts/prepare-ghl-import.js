/**
 * Prepare final GHL import: HOT + WARM contacts
 * Separate CSVs for clients and artists pipelines
 * Enrich with phone numbers from Google Contacts
 * Exclude providers, admin, marketing, internal
 */

const fs = require('fs');

// Load all data
const contacts = JSON.parse(fs.readFileSync('data/gmail-contacts-extracted.json', 'utf8'));
const threads = JSON.parse(fs.readFileSync('data/gmail-threads-analysis.json', 'utf8'));
const googleContacts = JSON.parse(fs.readFileSync('data/google-contacts.json', 'utf8'));

// Build lookups
const threadMap = new Map(threads.map(t => [t.email.toLowerCase(), t]));

// Phone lookup from Google Contacts
const phoneByEmail = new Map();
const phoneByNameWords = new Map();
googleContacts.forEach(c => {
  if (c.phone) {
    if (c.email) phoneByEmail.set(c.email.toLowerCase(), c.phone);
    if (c.name) {
      const words = c.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      words.forEach(w => {
        if (!phoneByNameWords.has(w)) phoneByNameWords.set(w, []);
        phoneByNameWords.get(w).push({ phone: c.phone, name: c.name });
      });
    }
  }
});

// Existing GHL contacts (Mailchimp)
let existingEmails = new Set();
try {
  const mcRaw = fs.readFileSync('data/mailchimp-subscribed.csv', 'utf8');
  mcRaw.split('\n').slice(1).forEach(line => {
    const email = line.split(',')[0]?.replace(/"/g, '').trim().toLowerCase();
    if (email) existingEmails.add(email);
  });
  const mcCleaned = fs.readFileSync('data/mailchimp-cleaned.csv', 'utf8');
  mcCleaned.split('\n').slice(1).forEach(line => {
    const email = line.split(',')[0]?.replace(/"/g, '').trim().toLowerCase();
    if (email) existingEmails.add(email);
  });
} catch(e) {}
console.log('Existing GHL emails (Mailchimp):', existingEmails.size);

// Filters
const internal = /@eventosbarcelona\.com|@www\.eventosbarcelona\.com/i;
const noisePattern = /noreply|no-reply|mailer-daemon|notification|newsletter|google\.com|facebook|linkedin|mailchimp|hubspot|stripe|paypal|shopify|zoom|canva|dropbox|wordpress|amazon|apple|microsoft|instagram|github|vercel|cloudflare|ariba\.com|intuit|sendgrid|zendesk|intercom|trello|asana|jira|atlassian|slack\.com|figma|notion/i;

// Categorize
function categorize(contact, threadData) {
  const subjects = [...(contact.subjects || []), ...(threadData?.subjects || [])].join(' ').toLowerCase();
  const email = contact.email.toLowerCase();
  const name = (contact.name || '').toLowerCase();
  const domain = email.split('@')[1] || '';

  const artistPatterns = /artista|artist|show |performance|actuaci|espectáculo|dj |music|band|grupo musical|cantante|bailar|dance|flamenco|magician|mago|caricatur|animaci|entertaint|talent|performer|drummer|saxo|piano|violin|acrobat|circo|circus|clown|payaso|comedian|humorist|coreograf|singer|vocalist|guitarist|percusi|puppeteer|marioneta|stilts|zancud|fire.?show|led.?show|glow|beatbox|rapper|mc host|presentador|mimo|juggl|malabar|aerial|trapez|contortion|hula.?hoop|bongo|cello|harp|quartet|trio|duo musical|one.?man|tribut|live painter|hair.*make|make.*up|hostess|model/i;

  const clientPatterns = /presupuesto|budget|quote|propuesta|proposal|evento corporativo|corporate|gala|dinner|cena|congress|congreso|incentive|team.?building|wedding|boda|pax |welcome drink|cocktail|conferencia|conference|convención|convention|lanzamiento|launch|fiesta empresa|company party|kick.?off|award|premios|ceremoni|summit|forum|feria|fair|trade.?show/i;
  const clientDomains = /dmc|mice|event(?!os?barcelona)|incentiv|congress|meeting|travel|tour|experience|hospitality|pco|conference/i;

  const providerPatterns = /factura|invoice|albarán|proveedor|supplier|catering|audiovisual|iluminaci|lighting|sound|sonido|transport|logistic|florist|decoraci|fotograf|video prod|print|imprenta|seguridad|security|limpieza|cleaning|alquiler|rental|rigging|staging|escenario|pantalla|screen|led wall|sonorizaci|backline|generador|generator|carpa|tent|mobiliario|furniture|vajilla|menaje|floral/i;
  const providerDomains = /tecno|audio|light|sound|rental|alquiler|logist|catering|florist|foto|video|seguridad|security|clean|print|impren|carpa|staging|rigging/i;

  const venuePatterns = /hotel|restaurante|restaurant|sala |venue|espacio|finca|masía|castle|castillo|museo|museum|palacio|palace|teatro|theatre|club |rooftop|terraza|jardín|garden|bodega|winery|resort|llotja|recinto/i;
  const venueDomains = /hotel|resort|palace|palacio|museo|museum|theatre|teatro|finca|masia|club|restaurant|bodega/i;

  const adminPatterns = /gestor|asesor|contab|fiscal|legal|abogado|notari|seguro|insurance|banco|bank|nòmina|nomina|irpf|iva|impuesto|hacienda|seguridad social|tgss|mutua|laboral|reclamaci/i;
  const adminDomains = /osoromartin|deabcn|insolnet|assessor|gestor|abogad|notar|asegurad|bancsabadell|caixa|bankinter/i;

  const marketingDomains = /rodanet|isocialweb|semrush|seo|marketing|publicitar|agencia.?digital|social.?media/i;

  let scores = { artista: 0, cliente: 0, proveedor: 0, venue: 0, admin: 0, marketing: 0 };

  if (artistPatterns.test(subjects) || artistPatterns.test(name)) scores.artista += 3;
  if (clientPatterns.test(subjects)) scores.cliente += 3;
  if (clientDomains.test(domain)) scores.cliente += 2;
  if (providerPatterns.test(subjects)) scores.proveedor += 3;
  if (providerDomains.test(domain)) scores.proveedor += 2;
  if (venuePatterns.test(subjects) || venueDomains.test(domain)) scores.venue += 3;
  if (adminPatterns.test(subjects) || adminDomains.test(domain)) scores.admin += 3;
  if (marketingDomains.test(domain)) scores.marketing += 3;

  const intlTlds = /\.(uk|de|fr|it|nl|ae|us|ch|at|se|no|dk|fi|be|pt|ie|au|nz|sg|hk|jp|cn|kr|in|za|br|mx|ar|cl|co)$/i;
  if (intlTlds.test(domain)) scores.cliente += 1;

  const max = Math.max(...Object.values(scores));
  if (max === 0) return 'sin clasificar';
  return Object.entries(scores).find(([k, v]) => v === max)[0];
}

// Find phone for a contact
function findPhone(email, name) {
  // By email
  let phone = phoneByEmail.get(email.toLowerCase());
  if (phone) return phone;
  // By name words
  if (name) {
    const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    for (const w of words) {
      const matches = phoneByNameWords.get(w) || [];
      if (matches.length === 1) return matches[0].phone; // unique match
    }
  }
  return '';
}

// Process contacts
const processed = contacts
  .filter(c => {
    if (internal.test(c.email)) return false;
    if (noisePattern.test(c.email)) return false;
    if (c.lastSeen < 2023) return false;
    const t = threadMap.get(c.email.toLowerCase());
    if (!t) return false;
    return true;
  })
  .map(c => {
    const t = threadMap.get(c.email.toLowerCase());
    const category = categorize(c, t);
    const threadCount = t?.conversationThreads || 0;
    const temperature = threadCount >= 2 ? 'HOT' : 'WARM';
    const phone = findPhone(c.email, c.name);

    // Parse name into first/last
    const nameParts = (c.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Company from email domain
    const domain = c.email.split('@')[1] || '';
    const company = domain.split('.')[0] || '';

    return {
      firstName,
      lastName,
      fullName: c.name || '',
      email: c.email,
      phone,
      category,
      temperature,
      threads: threadCount,
      totalMsgs: t?.totalBackAndForthMsgs || 0,
      firstSeen: c.firstSeen,
      lastSeen: c.lastSeen,
      yearsActive: (c.yearsActive || []).join(';'),
      company,
      sampleSubject: (c.subjects?.[0] || '').substring(0, 100)
    };
  })
  // Exclude providers, admin, marketing
  .filter(c => !['proveedor', 'admin', 'marketing'].includes(c.category));

// Deduplicate against existing GHL
const newContacts = processed.filter(c => !existingEmails.has(c.email.toLowerCase()));
const duplicates = processed.filter(c => existingEmails.has(c.email.toLowerCase()));

console.log('\n=== RESULTADO FINAL ===');
console.log('Contactos procesados (sin proveedores/admin):', processed.length);
console.log('Ya existen en GHL:', duplicates.length);
console.log('Nuevos para importar:', newContacts.length);

// Split by pipeline
const clients = newContacts.filter(c => ['cliente', 'venue', 'sin clasificar'].includes(c.category));
const artists = newContacts.filter(c => c.category === 'artista');

console.log('\n=== PARA IMPORTAR ===');
console.log('Pipeline CLIENTES:', clients.length);
console.log('  HOT:', clients.filter(c => c.temperature === 'HOT').length);
console.log('  WARM:', clients.filter(c => c.temperature === 'WARM').length);
console.log('  Con teléfono:', clients.filter(c => c.phone).length);

console.log('\nPipeline ARTISTAS:', artists.length);
console.log('  HOT:', artists.filter(c => c.temperature === 'HOT').length);
console.log('  WARM:', artists.filter(c => c.temperature === 'WARM').length);
console.log('  Con teléfono:', artists.filter(c => c.phone).length);

// Save CSVs for GHL import
function toCSV(data, filename) {
  const headers = 'firstName,lastName,email,phone,tags,company';
  const rows = data.map(c => {
    const tags = [c.temperature, c.category, 'gmail-import'].filter(Boolean).join(',');
    return [c.firstName, c.lastName, c.email, c.phone, tags, c.company]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(',');
  });
  fs.writeFileSync(filename, [headers, ...rows].join('\n'));
  console.log(`Saved: ${filename} (${data.length} rows)`);
}

toCSV(clients, 'data/ghl-import-clientes.csv');
toCSV(artists, 'data/ghl-import-artistas.csv');

// Save providers separately
const providers = processed.filter(c => false); // already excluded above
// Actually get providers from full set
const allWithProviders = contacts
  .filter(c => {
    if (internal.test(c.email)) return false;
    if (noisePattern.test(c.email)) return false;
    if (c.lastSeen < 2023) return false;
    const t = threadMap.get(c.email.toLowerCase());
    if (!t) return false;
    return true;
  })
  .map(c => {
    const t = threadMap.get(c.email.toLowerCase());
    const category = categorize(c, t);
    const threadCount = t?.conversationThreads || 0;
    const phone = findPhone(c.email, c.name);
    const nameParts = (c.name || '').trim().split(/\s+/);
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: c.email,
      phone,
      category,
      temperature: threadCount >= 2 ? 'HOT' : 'WARM',
      threads: threadCount,
      company: (c.email.split('@')[1] || '').split('.')[0] || ''
    };
  })
  .filter(c => ['proveedor', 'venue'].includes(c.category));

toCSV(allWithProviders, 'data/ghl-proveedores-separado.csv');
console.log('\nProveedores (separado):', allWithProviders.length);

// Also add Google phone-only contacts as artists
const phoneOnlyArtists = googleContacts
  .filter(c => c.phone && !c.email && c.name)
  .map(c => {
    const nameParts = c.name.trim().split(/\s+/);
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: '',
      phone: c.phone,
      temperature: 'mobile',
      category: 'artista',
      company: c.company || ''
    };
  });

toCSV(phoneOnlyArtists, 'data/ghl-import-artistas-movil.csv');
console.log('Artistas del móvil (solo teléfono):', phoneOnlyArtists.length);

// Full JSON for reference
fs.writeFileSync('data/ghl-import-all.json', JSON.stringify({ clients, artists, providers: allWithProviders, phoneOnlyArtists }, null, 2));
