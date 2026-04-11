/**
 * Configure GHL custom fields properly:
 * - Delete duplicated fields
 * - Recreate TEXT fields as SINGLE_OPTIONS (dropdowns) where needed
 * - Create field folders for organization
 * - Clean up unused tags
 */

require('dotenv').config();

const API_KEY = process.env.GHL_API_KEY;
const LOC = process.env.GHL_LOCATION_ID;
const BASE = 'https://services.leadconnectorhq.com';
const DELAY = 400;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  if (!res.ok && res.status !== 404) {
    console.log(`  ⚠ ${method} ${path} → ${res.status}: ${text.substring(0, 100)}`);
  }
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function main() {
  // ==========================================
  // STEP 1: Delete duplicated/unnecessary fields
  // ==========================================
  console.log('=== PASO 1: Borrar campos duplicados ===');

  const fieldsToDelete = [
    // Duplicates
    { id: 'xVP384cxxbbnLFnjmX0e', name: 'Tipo de evento (dup 1)' },     // duplicate
    { id: 'Umu0Ez8wo24KG86SGxcO', name: 'Subcategorias artisticas (dup)' }, // duplicate of 8AFY4b2Kdh8R632qm28M
    { id: 'L1dKxN5vorKNXlfVAwWO', name: 'Formato de show (dup)' },        // duplicate of b3iPmYwk1HAOfm4yKZPS

    // Fields that need to be recreated as dropdowns
    { id: 'UN8u8K9nxNkqAUcRr9zb', name: 'Tipo de contacto' },
    { id: 'XSes5gGYbtcnG1925bSs', name: 'Tipo de evento' },
    { id: '63cJHvQnz6nVdnbVVzSb', name: 'Categorias artisticas' },
    { id: 'iH5t9acOwBKpIBui6N2o', name: 'Presupuesto aproximado' },
    { id: 'UqYSRw1QtWgaMfoFT9ia', name: 'Necesita produccion tecnica' },
    { id: 'N334swltVbHsX9gXqayh', name: 'Idioma del cliente' },
    { id: 'ZKrNbUtUkFgnomrkPbHW', name: 'Estado de la propuesta' },
    { id: 'd4s72s1ZUeBOBdBSUj3Q', name: 'Como nos conocio' },
    { id: '36PxIwLt0CS7xREgG4Sx', name: 'Disciplina artistica' },
    { id: 'b3iPmYwk1HAOfm4yKZPS', name: 'Formato del show (artista)' },
    { id: 'eoLHv9wWMoW0sBo1zKsr', name: 'Rango de cache' },
    { id: 'B9x9qCNnKVQKanp1ECqM', name: 'Acepto politica privacidad' },
    { id: 'Tlh9gJAkNZ7wtI6KN0NX', name: 'Acepto visibilidad web RRSS' },
  ];

  for (const f of fieldsToDelete) {
    const r = await api('DELETE', `/locations/${LOC}/customFields/${f.id}`);
    console.log(`  ${r.status === 200 ? '✓' : '✗'} Borrado: ${f.name}`);
    await sleep(DELAY);
  }

  // ==========================================
  // STEP 2: Create field folders
  // ==========================================
  console.log('\n=== PASO 2: Crear carpetas de campos ===');

  // Check if we can create folders
  const folderGeneral = await api('POST', `/locations/${LOC}/customFields`, {
    name: 'General',
    model: 'contact',
    documentType: 'folder'
  });
  const generalFolderId = folderGeneral.data?.customField?.id;
  console.log(`  General folder: ${generalFolderId ? '✓ ' + generalFolderId : '✗ using existing'}`);
  await sleep(DELAY);

  const folderClientes = await api('POST', `/locations/${LOC}/customFields`, {
    name: 'Datos Cliente / Lead',
    model: 'contact',
    documentType: 'folder'
  });
  const clienteFolderId = folderClientes.data?.customField?.id;
  console.log(`  Clientes folder: ${clienteFolderId ? '✓ ' + clienteFolderId : '✗ using existing'}`);
  await sleep(DELAY);

  const folderArtistas = await api('POST', `/locations/${LOC}/customFields`, {
    name: 'Datos Artista',
    model: 'contact',
    documentType: 'folder'
  });
  const artistaFolderId = folderArtistas.data?.customField?.id;
  console.log(`  Artistas folder: ${artistaFolderId ? '✓ ' + artistaFolderId : '✗ using existing'}`);
  await sleep(DELAY);

  const folderPropuesta = await api('POST', `/locations/${LOC}/customFields`, {
    name: 'Propuesta',
    model: 'contact',
    documentType: 'folder'
  });
  const propuestaFolderId = folderPropuesta.data?.customField?.id;
  console.log(`  Propuesta folder: ${propuestaFolderId ? '✓ ' + propuestaFolderId : '✗ using existing'}`);
  await sleep(DELAY);

  // Use existing folder as fallback
  const existingFolderId = 'fxnzP5rGXjljHsJsNbJj';

  // ==========================================
  // STEP 3: Recreate fields with proper types
  // ==========================================
  console.log('\n=== PASO 3: Crear campos con tipos correctos ===');

  const fieldsToCreate = [
    // --- GENERAL ---
    {
      name: 'Tipo de contacto',
      dataType: 'SINGLE_OPTIONS',
      options: ['Cliente', 'Artista', 'Proveedor', 'Venue'],
      parentId: generalFolderId || existingFolderId,
      position: 10
    },
    {
      name: 'Como nos conocio',
      dataType: 'SINGLE_OPTIONS',
      options: ['Web', 'Email directo', 'Recomendación', 'Feria/Congreso', 'LinkedIn', 'Otro'],
      parentId: generalFolderId || existingFolderId,
      position: 20
    },

    // --- CLIENTE/LEAD ---
    {
      name: 'Tipo de evento',
      dataType: 'SINGLE_OPTIONS',
      options: ['Gala / Cena', 'Cocktail / Welcome Drink', 'Convención / Congreso', 'Lanzamiento', 'Premios / Ceremonia', 'Family Day', 'Fiesta Empresa', 'Fiesta Temática', 'Team Building', 'Otro'],
      parentId: clienteFolderId || existingFolderId,
      position: 100
    },
    {
      name: 'Categorias artisticas',
      dataType: 'SINGLE_OPTIONS',
      options: ['Danza', 'Música', 'Circo', 'Wow Effect', 'Varios'],
      parentId: clienteFolderId || existingFolderId,
      position: 110
    },
    {
      name: 'Presupuesto aproximado',
      dataType: 'SINGLE_OPTIONS',
      options: ['< 5.000€', '5.000 - 10.000€', '10.000 - 25.000€', '25.000€+', 'No definido'],
      parentId: clienteFolderId || existingFolderId,
      position: 150
    },
    {
      name: 'Necesita produccion tecnica',
      dataType: 'SINGLE_OPTIONS',
      options: ['Sí', 'No', 'No sabe'],
      parentId: clienteFolderId || existingFolderId,
      position: 170
    },
    {
      name: 'Idioma del cliente',
      dataType: 'SINGLE_OPTIONS',
      options: ['Español', 'English', 'Français', 'Deutsch', 'Otro'],
      parentId: clienteFolderId || existingFolderId,
      position: 180
    },

    // --- PROPUESTA ---
    {
      name: 'Estado de la propuesta',
      dataType: 'SINGLE_OPTIONS',
      options: ['Pendiente', 'Enviada', 'Revisada por cliente', 'Aceptada', 'Rechazada'],
      parentId: propuestaFolderId || existingFolderId,
      position: 300
    },

    // --- ARTISTA ---
    {
      name: 'Disciplina artistica',
      dataType: 'SINGLE_OPTIONS',
      options: [
        'DJ', 'Flamenco', 'Danza', 'Piano', 'Saxo', 'Violín', 'Guitarra',
        'Percusión', 'Cello', 'Arpa', 'Ensemble', 'Jazz', 'Banda', 'Cantante',
        'Circo / Acrobacia', 'Magia', 'Caricatura', 'Live Painter',
        'Fire Show', 'LED Show', 'Mimo / Clown', 'Zancudos',
        'MC / Presentador', 'Hostess', 'Maquillaje', 'Show Acuático', 'Otro'
      ],
      parentId: artistaFolderId || existingFolderId,
      position: 500
    },
    {
      name: 'Formato del show',
      dataType: 'SINGLE_OPTIONS',
      options: ['Escenario', 'Ambient', 'Itinerante', 'Escenario + Ambient'],
      parentId: artistaFolderId || existingFolderId,
      position: 550
    },
    {
      name: 'Rango de cache',
      dataType: 'SINGLE_OPTIONS',
      options: ['< 500€', '500 - 1.000€', '1.000 - 2.000€', '2.000 - 5.000€', '5.000€+'],
      parentId: artistaFolderId || existingFolderId,
      position: 600
    },
    {
      name: 'Acepto politica privacidad',
      dataType: 'SINGLE_OPTIONS',
      options: ['Sí', 'No'],
      parentId: artistaFolderId || existingFolderId,
      position: 700
    },
    {
      name: 'Acepto visibilidad web RRSS',
      dataType: 'SINGLE_OPTIONS',
      options: ['Sí', 'No'],
      parentId: artistaFolderId || existingFolderId,
      position: 710
    },
  ];

  for (const f of fieldsToCreate) {
    const r = await api('POST', `/locations/${LOC}/customFields`, {
      name: f.name,
      dataType: f.dataType,
      model: 'contact',
      options: f.options,
      parentId: f.parentId,
      position: f.position
    });
    const ok = r.status === 201;
    console.log(`  ${ok ? '✓' : '✗'} ${f.name} (${f.dataType}${f.options ? ', ' + f.options.length + ' opciones' : ''})`);
    await sleep(DELAY);
  }

  // ==========================================
  // STEP 4: Move existing fields to correct folders
  // ==========================================
  console.log('\n=== PASO 4: Mover campos existentes a carpetas ===');

  const moveToCliente = [
    { id: 'PmLJWOEVchiCDs348Hco', name: 'Numero de asistentes' },
    { id: 'L7rorACpm4Ut2YlFgov8', name: 'Fecha del evento' },
    { id: 'T1nYPr5ENzJIHSlbfNRQ', name: 'Ubicacion Hotel' },
    { id: 'MAuPORQVOMmxbVJ8ZWEH', name: 'Comentarios del cliente' },
  ];

  const moveToArtista = [
    { id: 'njzl9dTk4LD1ysXVFGY9', name: 'Nombre artistico' },
    { id: 'wSREt6RDIahCC1HncV4E', name: 'Nombre de compania' },
    { id: 'WMC6XiNCLHStzoo1OfQk', name: 'Bio del show' },
    { id: 'tQ9NlfXy7SLlJsAlCZbI', name: 'Que hace unico tu show' },
    { id: 'P71RkxGJDu5vJCSEgDQF', name: 'Link video 1' },
    { id: 'wPVaWXmOipkorbTCBLSv', name: 'Link video 2' },
    { id: 'm08mHAY7w5uRlUxCREZe', name: 'Link web RRSS' },
    { id: 'z1iouUMn7hydKO61ZNpO', name: 'Fotos URLs' },
    { id: 'vN2hw47IUl7w7LTC9nf9', name: 'Rider tecnico' },
    { id: 'CskiGF1uqvDIBIu50Xx2', name: 'Num artistas en show' },
    { id: 'OEtGBYONTWlp5fZ9Jj6C', name: 'Duracion del show' },
    { id: 'MBKYVX91JD2OKwLYRzR8', name: 'Shows adicionales' },
    { id: '8AFY4b2Kdh8R632qm28M', name: 'Subcategorias artista' },
  ];

  const moveToPropuesta = [
    { id: 'vQ4c2U1klXrQgek3nx44', name: 'URL de la propuesta' },
    { id: '8t14FlGZM6gLsg9rzZVN', name: 'Fecha de envio propuesta' },
    { id: 'xTaSoTLolF96H5PdJ6LF', name: 'Margen aplicado' },
  ];

  const moveToGeneral = [
    { id: 'Mv5K9LxhK9REB5CMfKzG', name: 'Notas internas' },
  ];

  for (const f of moveToCliente) {
    const r = await api('PUT', `/locations/${LOC}/customFields/${f.id}`, {
      name: f.name,
      parentId: clienteFolderId || existingFolderId
    });
    console.log(`  ${r.status === 200 ? '✓' : '✗'} ${f.name} → Datos Cliente`);
    await sleep(DELAY);
  }

  for (const f of moveToArtista) {
    const r = await api('PUT', `/locations/${LOC}/customFields/${f.id}`, {
      name: f.name,
      parentId: artistaFolderId || existingFolderId
    });
    console.log(`  ${r.status === 200 ? '✓' : '✗'} ${f.name} → Datos Artista`);
    await sleep(DELAY);
  }

  for (const f of moveToPropuesta) {
    const r = await api('PUT', `/locations/${LOC}/customFields/${f.id}`, {
      name: f.name,
      parentId: propuestaFolderId || existingFolderId
    });
    console.log(`  ${r.status === 200 ? '✓' : '✗'} ${f.name} → Propuesta`);
    await sleep(DELAY);
  }

  for (const f of moveToGeneral) {
    const r = await api('PUT', `/locations/${LOC}/customFields/${f.id}`, {
      name: f.name,
      parentId: generalFolderId || existingFolderId
    });
    console.log(`  ${r.status === 200 ? '✓' : '✗'} ${f.name} → General`);
    await sleep(DELAY);
  }

  // ==========================================
  // STEP 5: Clean up tags
  // ==========================================
  console.log('\n=== PASO 5: Limpiar tags innecesarios ===');

  const tagsToDelete = [
    { id: 'mSdl2RXKSwVKMhDNPSMi', name: 'engagement:bajo' },
    { id: '0eecTxnUyiDzsRnQaGuj', name: 'engagement:inactivo' },
    { id: 'PpcBADybfYqzkC0iVYzr', name: 'engagement:medio' },
    { id: 'rz6WdX0wkQkZSJG8ywFM', name: 'engagement:top' },
    { id: 'gj95TRKdAUFEzoXODvSh', name: 'produccion:solicitada' },
    { id: 'DwpXpvizDqaZfrkISd4t', name: 'form:contacto' },
    { id: 'iSR79OGlYLaKGNCVNjXZ', name: 'form:nuevo formular' },
    { id: 'AqkA4GWX7NzixUi5zcjj', name: 'proveedor' },  // redundant with tipo:proveedor
    { id: 'FRAQApsSOwsaJ8uqTBPY', name: 'origen:whatsapp' },
    { id: 'pnUJB3GbMpkvr32MYdoa', name: 'origen:telefono' },
  ];

  for (const t of tagsToDelete) {
    const r = await api('DELETE', `/locations/${LOC}/tags/${t.id}`);
    console.log(`  ${r.status === 200 ? '✓' : '✗'} Borrado tag: ${t.name}`);
    await sleep(DELAY);
  }

  // Add missing tags
  console.log('\n  Creando tags faltantes...');
  const tagsToCreate = ['warm', 'cold'];
  for (const tag of tagsToCreate) {
    const r = await api('POST', `/locations/${LOC}/tags`, { name: tag });
    console.log(`  ${r.status === 201 ? '✓' : '✗'} Creado tag: ${tag}`);
    await sleep(DELAY);
  }

  console.log('\n=== CONFIGURACIÓN COMPLETADA ===');
}

main().catch(err => {
  console.error('Error fatal:', err.message);
});
