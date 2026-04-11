/**
 * Gmail OAuth2 Authentication
 *
 * Paso 1: Ejecutar este script → abre un enlace en el navegador
 * Paso 2: Xavi autoriza con su cuenta xavi@eventsbarcelona.com
 * Paso 3: Se guarda el refresh token en .env
 *
 * Uso: node scripts/gmail-auth.js
 */

import { google } from 'googleapis';
import { createServer } from 'http';
import { URL } from 'url';
import { readFileSync, writeFileSync } from 'fs';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3456/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('');
console.log('=== Gmail OAuth2 ===');
console.log('');
console.log('Abre este enlace en el navegador (Xavi debe iniciar sesión con xavi@eventsbarcelona.com):');
console.log('');
console.log(authUrl);
console.log('');
console.log('Esperando autorización...');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3456');

  if (url.pathname === '/oauth2callback') {
    const code = url.searchParams.get('code');

    if (!code) {
      res.writeHead(400);
      res.end('Error: no se recibió código de autorización');
      server.close();
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);

      console.log('');
      console.log('Autorización exitosa!');
      console.log('');
      console.log('Refresh Token:', tokens.refresh_token);
      console.log('');

      // Append to .env
      const envPath = new URL('../.env', import.meta.url).pathname;
      let envContent = readFileSync(envPath, 'utf-8');

      if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      } else {
        envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
      }

      writeFileSync(envPath, envContent);
      console.log('Refresh token guardado en .env');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Autorización completada!</h1><p>Puedes cerrar esta ventana.</p>');
    } catch (err) {
      console.error('Error obteniendo token:', err.message);
      res.writeHead(500);
      res.end('Error obteniendo token');
    }

    server.close();
  }
});

server.listen(3456, () => {
  console.log('Servidor escuchando en http://localhost:3456');
});
