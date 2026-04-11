const https = require('https');
const http = require('http');

const shows = [
  { id: "shadows-of-the-future", url: "https://www.eventosbarcelona.com/danza/shadows-of-the-future/" },
  { id: "pulsar-dancers", url: "https://www.eventosbarcelona.com/danza/pulsar-dancers/" },
  { id: "silk-road-burlesque", url: "https://www.eventosbarcelona.com/danza/silk-road-burlesque/" },
  { id: "street-dancers", url: "https://www.eventosbarcelona.com/danza/street-dancers/" },
  { id: "show-danza-funky", url: "https://www.eventosbarcelona.com/danza/show-danza-funky/" },
  { id: "olympian-odyssey", url: "https://www.eventosbarcelona.com/danza/olympian-odyssey/" },
  { id: "ballet-clasica", url: "https://www.eventosbarcelona.com/danza/bailarinas-barcelona/" },
  { id: "pole-dance", url: "https://www.eventosbarcelona.com/danza/shows-de-pole-dance/" },
  { id: "hiphop-breakdance", url: "https://www.eventosbarcelona.com/danza/street-dancers-hip-hop-breakdance-eventos-barcelona/" },
  { id: "bollywood", url: "https://www.eventosbarcelona.com/danza/show-de-bollywood/" },
  { id: "flamenco-danza", url: "https://www.eventosbarcelona.com/danza/bailarines-flamenco-barcelona/" },
  { id: "cabaret-burlesque", url: "https://www.eventosbarcelona.com/danza/contratar-bailarinas-burlesque-cabaret-barcelona/" },
  { id: "danza-aerea", url: "https://www.eventosbarcelona.com/danza/danza-aerea-barcelona/" },
  { id: "espectaculo-brasileno", url: "https://www.eventosbarcelona.com/danza/espectaculos-brasilenos/" },
  { id: "hula-hoop-led", url: "https://www.eventosbarcelona.com/danza/hula-hoop-dancers/" },
  { id: "glamm-dancers", url: "https://www.eventosbarcelona.com/danza/glamm-dancers/" },
  { id: "bailarines-salsa", url: "https://www.eventosbarcelona.com/danza/bailarines-salsa-barcelona/" },
  { id: "grupos-flamenco", url: "https://www.eventosbarcelona.com/musica/grupos-de-flamenco-barcelona/" },
  { id: "arpista-clasica", url: "https://www.eventosbarcelona.com/musica/arpista-clasica/" },
  { id: "saxofonista-chillout", url: "https://www.eventosbarcelona.com/musica/contratar-chica-saxofonista/" },
  { id: "cantante-jazz", url: "https://www.eventosbarcelona.com/musica/cantante-jazz-barcelona/" },
  { id: "trio-violin", url: "https://www.eventosbarcelona.com/musica/trio-violinistas/" },
  { id: "flamenco-instrumental", url: "https://www.eventosbarcelona.com/musica/flamenco-instrumental-para-eventos/" },
  { id: "djs", url: "https://www.eventosbarcelona.com/musica/dj-barcelona/" },
  { id: "orquesta-clasica", url: "https://www.eventosbarcelona.com/musica/contratar-orquesta-musica-clasica/" },
  { id: "bandas-jazz", url: "https://www.eventosbarcelona.com/musica/grupo-jazz-barcelona/" },
  { id: "dixieland", url: "https://www.eventosbarcelona.com/musica/book-hire-dixieland-jazz-band/" },
  { id: "flamenco-chillout", url: "https://www.eventosbarcelona.com/musica/grupo-flamenco-chill-out/" },
  { id: "percusionistas-batucadas", url: "https://www.eventosbarcelona.com/musica/contratar-percusionistas-batucada-para-eventos/" },
  { id: "cantantes-opera", url: "https://www.eventosbarcelona.com/musica/cantante-opera-barcelona/" },
  { id: "rumba-catalana", url: "https://www.eventosbarcelona.com/musica/grupos-de-rumba/" },
  { id: "bossa-nova", url: "https://www.eventosbarcelona.com/musica/contratar-grupos-de-bossa-nova/" },
  { id: "pop-rock", url: "https://www.eventosbarcelona.com/musica/pop-rock-live-band/" },
  { id: "soul-bossa-nova", url: "https://www.eventosbarcelona.com/musica/souldade-bossa-nova-soul-grupo/" },
  { id: "soul-rb-femenina", url: "https://www.eventosbarcelona.com/musica/scarlets-femme-soul-band/" },
  { id: "jazz-vintage", url: "https://www.eventosbarcelona.com/musica/the-gildas-boys/" },
  { id: "malabaristas-zancudos-led", url: "https://www.eventosbarcelona.com/artistas/malabarista-barcelona/" },
  { id: "malabares-fuego", url: "https://www.eventosbarcelona.com/artistas/espectaculo-malabares-fuego/" },
  { id: "personajes-halloween", url: "https://www.eventosbarcelona.com/artistas/personajes-halloween/" },
  { id: "freestylers-futbol", url: "https://www.eventosbarcelona.com/artistas/freestyler-futbol/" },
  { id: "personajes-gaudi", url: "https://www.eventosbarcelona.com/artistas/gaudi-characters/" },
  { id: "artistas-asiaticos", url: "https://www.eventosbarcelona.com/artistas/contratar-artistas-asiaticos-geishas-kendo-samurai/" },
  { id: "siluetista", url: "https://www.eventosbarcelona.com/artistas/contratar-siluetista-siluetas/" },
  { id: "zancudos-surrealistas", url: "https://www.eventosbarcelona.com/artistas/zancudos-barcelona/" },
  { id: "magos-ilusionistas", url: "https://www.eventosbarcelona.com/artistas/magos-en-barcelona/" },
  { id: "acrobatas-equilibristas", url: "https://www.eventosbarcelona.com/artistas/equilibrista-barcelona/" },
  { id: "caricaturistas", url: "https://www.eventosbarcelona.com/artistas/caricaturistas-barcelona/" },
  { id: "actores-animadores", url: "https://www.eventosbarcelona.com/artistas/actores-barcelona/" },
  { id: "body-painter", url: "https://www.eventosbarcelona.com/artistas/body-painting-barcelona/" },
  { id: "maestros-ceremonias", url: "https://www.eventosbarcelona.com/artistas/maestro-ceremonias/" },
  { id: "personajes-bienvenida", url: "https://www.eventosbarcelona.com/artistas/personajes-bienvenida/" },
  { id: "light-boxes-show", url: "https://www.eventosbarcelona.com/espectaculos/light-boxes-show/" },
  { id: "fire-painting", url: "https://www.eventosbarcelona.com/espectaculos/show-de-fire-painting/" },
  { id: "light-painting", url: "https://www.eventosbarcelona.com/espectaculos/light-painting-eventos-barcelona/" },
  { id: "natacion-sincronizada", url: "https://www.eventosbarcelona.com/espectaculos/shows-espectaculos-acuaticos-agua-bailarinas-natacion-sincronizada/" },
  { id: "violin-laser", url: "https://www.eventosbarcelona.com/espectaculos/violin-laser-show-eventos-barcelona/" },
  { id: "artista-arena", url: "https://www.eventosbarcelona.com/espectaculos/artista-de-la-arena/" },
  { id: "light-art-show", url: "https://www.eventosbarcelona.com/espectaculos/light-art-show/" },
  { id: "shows-laser", url: "https://www.eventosbarcelona.com/espectaculos/laser-show/" },
  { id: "bailarines-led", url: "https://www.eventosbarcelona.com/espectaculos/contratar-espectaculo-bailarines-led/" },
  { id: "percusionistas-led", url: "https://www.eventosbarcelona.com/espectaculos/contratar-percusionistas-led-eventos/" },
  { id: "arpa-laser", url: "https://www.eventosbarcelona.com/espectaculos/contratar-arpa-laser-barcelona/" },
  { id: "video-mapping", url: "https://www.eventosbarcelona.com/espectaculos/barcelona-video-mapping/" },
  { id: "malabares-led", url: "https://www.eventosbarcelona.com/espectaculos/malabaristas-led-barcelona/" },
  { id: "3d-dreams", url: "https://www.eventosbarcelona.com/espectaculos/3d-dreams-videomapping-danza/" },
  { id: "percusionistas-agua", url: "https://www.eventosbarcelona.com/espectaculos/percusionistas-agua-proyecciones/" },
  { id: "flamenco-mapping", url: "https://www.eventosbarcelona.com/espectaculos/contratar-espectaculo-baile-mapping-flamenco/" },
  { id: "holovortex", url: "https://www.eventosbarcelona.com/espectaculos/holovortex-mapping-holografico/" },
];

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirects + 1);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    };
    follow(url);
  });
}

function extractVideos(html) {
  const videos = new Set();

  // YouTube patterns
  const patterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|v\/)([a-zA-Z0-9_-]{11})/g,
    /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/g,
    /youtube_url['":\s]+['"](https?:\/\/[^'"]+)['"]/g,
    /data-src=['"](https?:\/\/(?:www\.)?youtube\.com[^'"]+)['"]/g,
    /src=['"](https?:\/\/(?:www\.)?youtube\.com\/embed\/[^'"]+)['"]/g,
    // Elementor video widget patterns
    /youtube_url.*?\\u0022(https?:[^\\]+)\\u0022/g,
    /youtube_url.*?"(https?:\/\/[^"]+)"/g,
    // Vimeo
    /https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/g,
    /https?:\/\/player\.vimeo\.com\/video\/(\d+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      videos.add(match[0]);
    }
  }

  // Also look for YouTube IDs in data-settings JSON
  const settingsPattern = /data-settings='([^']+)'/g;
  let settingsMatch;
  while ((settingsMatch = settingsPattern.exec(html)) !== null) {
    try {
      const decoded = settingsMatch[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'");
      if (decoded.includes('youtube') || decoded.includes('youtu')) {
        videos.add('SETTINGS: ' + decoded.substring(0, 500));
      }
    } catch (e) {}
  }

  // Look for data-settings with encoded JSON
  const settingsPattern2 = /data-settings="([^"]+)"/g;
  while ((settingsMatch = settingsPattern2.exec(html)) !== null) {
    try {
      const decoded = settingsMatch[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
      if (decoded.includes('youtube') || decoded.includes('youtu') || decoded.includes('video')) {
        // Extract URL from the decoded settings
        const urlMatch = decoded.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s"\\]*/);
        if (urlMatch) videos.add(urlMatch[0]);
      }
    } catch (e) {}
  }

  return [...videos];
}

async function main() {
  const results = {};
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];
    try {
      process.stderr.write(`[${i+1}/${shows.length}] ${show.id}...`);
      const html = await fetchPage(show.url);
      const videos = extractVideos(html);
      if (videos.length > 0) {
        results[show.id] = videos;
        found++;
        process.stderr.write(` ${videos.length} video(s)\n`);
      } else {
        process.stderr.write(` no video\n`);
        notFound++;
      }
      // Small delay to not hammer the server
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      process.stderr.write(` ERROR: ${e.message}\n`);
    }
  }

  console.log(JSON.stringify(results, null, 2));
  process.stderr.write(`\nDone: ${found} with videos, ${notFound} without\n`);
}

main();
