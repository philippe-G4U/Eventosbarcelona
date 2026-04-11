/**
 * Create Google Sheet for Xavi to review and classify contacts
 * Uses Service Account with domain-wide delegation
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'service-account-key.json');
const TARGET_USER = 'xavi@eventosbarcelona.com';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ],
    clientOptions: { subject: TARGET_USER }
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Load data
  const contacts = JSON.parse(fs.readFileSync('data/gmail-contacts-extracted.json', 'utf8'));
  const threads = JSON.parse(fs.readFileSync('data/gmail-threads-analysis.json', 'utf8'));
  const googleContacts = JSON.parse(fs.readFileSync('data/google-contacts.json', 'utf8'));
  const threadMap = new Map(threads.map(t => [t.email.toLowerCase(), t]));

  // Phone lookup
  const phoneByEmail = new Map();
  googleContacts.forEach(c => {
    if (c.phone && c.email) phoneByEmail.set(c.email.toLowerCase(), c.phone);
  });

  // Filters
  const internal = /@eventosbarcelona\.com|@www\.eventosbarcelona\.com/i;
  const noisePattern = /noreply|no-reply|mailer-daemon|notification|newsletter|google\.com|facebook|linkedin|mailchimp|hubspot|stripe|paypal|shopify|zoom|canva|dropbox|wordpress|amazon|apple|microsoft|instagram|github|vercel|cloudflare|ariba\.com|intuit|sendgrid|zendesk|intercom|trello|asana|jira|atlassian|slack\.com|figma|notion/i;

  // Categorize function
  function categorize(c, t) {
    const subjects = [...(c.subjects || []), ...(t?.subjects || [])].join(' ').toLowerCase();
    const email = c.email.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const domain = email.split('@')[1] || '';

    const artistPatterns = /artista|artist|show |performance|actuaci|espectáculo|dj |music|band|grupo musical|cantante|bailar|dance|flamenco|magician|mago|caricatur|animaci|entertaint|talent|performer|drummer|saxo|piano|violin|acrobat|circo|circus|clown|payaso|comedian|humorist|coreograf|singer|vocalist|guitarist|percusi|puppeteer|marioneta|stilts|zancud|fire.?show|led.?show|glow|beatbox|rapper|mc host|presentador|mimo|juggl|malabar|aerial|trapez|contortion|hula.?hoop|bongo|cello|harp|quartet|trio|duo musical|one.?man|tribut|live painter|hair.*make|make.*up|hostess|model/i;
    const clientPatterns = /presupuesto|budget|quote|propuesta|proposal|evento corporativo|corporate|gala|dinner|cena|congress|congreso|incentive|team.?building|wedding|boda|pax |welcome drink|cocktail|conferencia|conference|convención|convention|lanzamiento|launch|fiesta empresa|company party|kick.?off|award|premios|ceremoni|summit|forum|feria|fair|trade.?show/i;
    const clientDomains = /dmc|mice|event(?!os?barcelona)|incentiv|congress|meeting|travel|tour|experience|hospitality|pco|conference/i;
    const providerPatterns = /factura|invoice|albarán|proveedor|supplier|catering|audiovisual|iluminaci|lighting|sound|sonido|transport|logistic|florist|decoraci|fotograf|video prod|print|imprenta|seguridad|security|limpieza|cleaning|alquiler|rental|rigging|staging|escenario|pantalla|screen|led wall|sonorizaci|backline|generador|generator|carpa|tent|mobiliario|furniture|vajilla|menaje|floral/i;
    const venuePatterns = /hotel|restaurante|restaurant|sala |venue|espacio|finca|masía|castle|castillo|museo|museum|palacio|palace|teatro|theatre|club |rooftop|terraza|jardín|garden|bodega|winery|resort|llotja|recinto/i;
    const adminPatterns = /gestor|asesor|contab|fiscal|legal|abogado|notari|seguro|insurance|banco|bank|nòmina|nomina|irpf|iva|impuesto|hacienda|seguridad social|tgss|mutua|laboral|reclamaci/i;
    const adminDomains = /osoromartin|deabcn|insolnet|assessor|gestor|abogad|notar|asegurad|bancsabadell|caixa|bankinter/i;

    if (artistPatterns.test(subjects) || artistPatterns.test(name)) return 'Artista';
    if (clientPatterns.test(subjects) || clientDomains.test(domain)) return 'Cliente';
    if (venuePatterns.test(subjects)) return 'Venue';
    if (providerPatterns.test(subjects)) return 'Proveedor';
    if (adminPatterns.test(subjects) || adminDomains.test(domain)) return 'Admin';
    return '';
  }

  // Get artist activity
  function getActivity(name, subjects) {
    const text = [name, ...subjects].join(' ').toLowerCase();
    if (/dj |disc.?jockey/.test(text)) return 'DJ';
    if (/flamenco|rumba|gitano|gypsy/.test(text)) return 'Flamenco';
    if (/piano|pianist/.test(text)) return 'Piano';
    if (/saxo/.test(text)) return 'Saxo';
    if (/violin/.test(text)) return 'Violín';
    if (/guitar|guitarr/.test(text)) return 'Guitarra';
    if (/percus|drummer|drum|bongo|batería/.test(text)) return 'Percusión';
    if (/cello/.test(text)) return 'Cello';
    if (/harp|arpa/.test(text)) return 'Arpa';
    if (/quartet|cuarteto|trio|duo|ensemble/.test(text)) return 'Ensemble';
    if (/jazz|swing/.test(text)) return 'Jazz';
    if (/band|grupo musical|orquesta/.test(text)) return 'Banda';
    if (/singer|cantante|vocal/.test(text)) return 'Cantante';
    if (/acrobat|aerial|trapez|contortion|circo|circus/.test(text)) return 'Circo';
    if (/mago|magician|magic/.test(text)) return 'Magia';
    if (/caricatur/.test(text)) return 'Caricatura';
    if (/paint|pintor/.test(text)) return 'Live Painter';
    if (/dance|danza|bailar|ballet/.test(text)) return 'Danza';
    if (/fire|fuego/.test(text)) return 'Fire Show';
    if (/led |glow|light.?show/.test(text)) return 'LED Show';
    if (/mimo|mime|clown|payaso/.test(text)) return 'Mimo/Clown';
    if (/stilts|zancud/.test(text)) return 'Zancudos';
    if (/host|presenta|mc |emcee/.test(text)) return 'MC/Presentador';
    if (/model|hostess|azafat/.test(text)) return 'Hostess';
    if (/make.?up|maquilla|hair|estilis/.test(text)) return 'Maquillaje';
    if (/swim|aquatic|water/.test(text)) return 'Show Acuático';
    if (/show|espectáculo|performance|entertainment/.test(text)) return 'Show';
    if (/music|músic/.test(text)) return 'Música';
    return '';
  }

  // Process all valuable contacts
  const allContacts = contacts
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
      const cat = categorize(c, t);
      const threadCount = t?.conversationThreads || 0;
      const temp = threadCount >= 2 ? 'HOT' : 'WARM';
      const phone = phoneByEmail.get(c.email.toLowerCase()) || '';
      const activity = cat === 'Artista' ? getActivity(c.name || '', [...(c.subjects || []), ...(t?.subjects || [])]) : '';
      const subject = (t?.subjects?.[0] || '').substring(0, 80);

      return [
        c.name || '',
        c.email,
        phone,
        cat,
        '', // Column for Xavi to override category
        temp,
        activity,
        threadCount,
        c.lastSeen,
        subject
      ];
    })
    .sort((a, b) => {
      // Sort: HOT first, then by threads desc
      if (a[5] !== b[5]) return a[5] === 'HOT' ? -1 : 1;
      return b[7] - a[7];
    });

  console.log('Total contacts for sheet:', allContacts.length);

  // Create spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: 'EB - Revisión Contactos para GHL'
      },
      sheets: [
        {
          properties: {
            title: 'Todos los contactos',
            gridProperties: { frozenRowCount: 1 }
          }
        },
        {
          properties: {
            title: 'Contactos Móvil (Artistas)',
            gridProperties: { frozenRowCount: 1 }
          }
        }
      ]
    }
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  console.log('Sheet created:', sheetUrl);

  // Write headers + data to main sheet
  const headers = [
    'Nombre', 'Email', 'Teléfono', 'Categoría (auto)',
    'Tu clasificación (Cliente/Artista/Proveedor/Borrar)',
    'Temperatura', 'Actividad (artistas)', 'Conversaciones', 'Último año', 'Ejemplo email'
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Todos los contactos!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [headers, ...allContacts]
    }
  });

  // Write mobile contacts
  const mobileHeaders = ['Nombre', 'Teléfono', 'Empresa', 'Actividad (auto)', 'Tu clasificación'];
  const mobileData = googleContacts
    .filter(c => c.phone && c.name)
    .map(c => {
      const activity = getActivity(c.name, []);
      return [c.name, c.phone, c.company || '', activity, ''];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Contactos Móvil (Artistas)!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [mobileHeaders, ...mobileData]
    }
  });

  // Format: header row bold, auto-resize, colors
  const mainSheetId = spreadsheet.data.sheets[0].properties.sheetId;
  const mobileSheetId = spreadsheet.data.sheets[1].properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Bold headers - main sheet
        {
          repeatCell: {
            range: { sheetId: mainSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        // Bold headers - mobile sheet
        {
          repeatCell: {
            range: { sheetId: mobileSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        // Auto resize columns - main
        {
          autoResizeDimensions: {
            dimensions: { sheetId: mainSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 10 }
          }
        },
        // Auto resize columns - mobile
        {
          autoResizeDimensions: {
            dimensions: { sheetId: mobileSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 }
          }
        },
        // Data validation for classification column (E) - dropdown
        {
          setDataValidation: {
            range: { sheetId: mainSheetId, startRowIndex: 1, endRowIndex: allContacts.length + 1, startColumnIndex: 4, endColumnIndex: 5 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'Cliente' },
                  { userEnteredValue: 'Artista' },
                  { userEnteredValue: 'Proveedor' },
                  { userEnteredValue: 'Venue' },
                  { userEnteredValue: 'Borrar' }
                ]
              },
              showCustomUi: true,
              strict: false
            }
          }
        },
        // Data validation for mobile classification
        {
          setDataValidation: {
            range: { sheetId: mobileSheetId, startRowIndex: 1, endRowIndex: mobileData.length + 1, startColumnIndex: 4, endColumnIndex: 5 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'Artista' },
                  { userEnteredValue: 'Proveedor' },
                  { userEnteredValue: 'Cliente' },
                  { userEnteredValue: 'Borrar' }
                ]
              },
              showCustomUi: true,
              strict: false
            }
          }
        },
        // Conditional formatting: HOT = green background
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId: mainSheetId, startRowIndex: 1, endRowIndex: allContacts.length + 1 }],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'HOT' }] },
                format: { backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 } }
              }
            },
            index: 0
          }
        },
        // Conditional formatting: WARM = yellow background
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId: mainSheetId, startRowIndex: 1, endRowIndex: allContacts.length + 1 }],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'WARM' }] },
                format: { backgroundColor: { red: 1, green: 0.95, blue: 0.8 } }
              }
            },
            index: 1
          }
        }
      ]
    }
  });

  // Share with Phil
  // The sheet is already in Xavi's drive since we created it as him

  console.log('\nDone!');
  console.log('Sheet URL:', sheetUrl);
  console.log('Main sheet:', allContacts.length, 'contacts');
  console.log('Mobile sheet:', mobileData.length, 'contacts');
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
});
