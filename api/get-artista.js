export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  // Validate UUID format to prevent injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return res.status(400).json({ error: 'Invalid token format' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/artistas?token=eq.${token}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const rows = await response.json();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Artista no encontrado' });
    }

    const artist = rows[0];

    // Return artist data for form pre-fill (exclude internal IDs)
    return res.status(200).json({
      success: true,
      mode: 'update',
      data: {
        nombre: artist.nombre || '',
        nombreArtistico: artist.nombre_artistico || '',
        compania: artist.compania || '',
        email: artist.email || '',
        telefono: artist.telefono || '',
        ciudad: artist.ciudad || '',
        disciplinas: artist.disciplinas || [],
        subcategorias: artist.subcategorias || [],
        formatoShow: artist.formato_show || '',
        bioShow: artist.bio_show || '',
        showUnico: artist.show_unico || [],
        video1: artist.video1 || '',
        video2: artist.video2 || '',
        webRrss: artist.web_rrss || '',
        riderTecnico: artist.rider_tecnico || '',
        fotosUrls: artist.fotos_urls || [],
        rangoCache: artist.rango_cache || '',
        numArtistas: artist.num_artistas || '',
        duracionShow: artist.duracion_show || '',
        showsAdicionales: artist.shows_adicionales || '',
        aceptoPrivacidad: artist.acepto_privacidad || false,
        aceptoVisibilidad: artist.acepto_visibilidad || false
      }
    });
  } catch (err) {
    console.error('Supabase fetch error:', err);
    return res.status(500).json({ error: 'Error fetching artist data' });
  }
}
