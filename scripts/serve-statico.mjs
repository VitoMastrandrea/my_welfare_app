#!/usr/bin/env node
/**
 * Server statico per la build di produzione (`dist/`), pensato per Railway
 * o per qualunque hosting che esponga una porta via la variabile PORT.
 *
 * Non usa dipendenze esterne e gestisce il fallback SPA: qualunque rotta
 * sconosciuta (es. /admin/utenti aperta direttamente) restituisce index.html,
 * altrimenti React Router non riceverebbe mai il controllo.
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORTA = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Restituisce il percorso del file da servire, oppure null se non esiste. */
async function risolviFile(urlRichiesta) {
  const percorso = decodeURIComponent(new URL(urlRichiesta, 'http://localhost').pathname);
  const candidato = resolve(join(RADICE, normalize(percorso)));

  // Nessuna richiesta puo' uscire dalla cartella dist.
  if (candidato !== RADICE && !candidato.startsWith(RADICE + '/')) return null;

  try {
    const informazioni = await stat(candidato);
    if (informazioni.isFile()) return candidato;
  } catch {
    /* file assente: si passa al fallback SPA */
  }
  return null;
}

const server = createServer(async (richiesta, risposta) => {
  if (richiesta.method !== 'GET' && richiesta.method !== 'HEAD') {
    risposta.writeHead(405, { Allow: 'GET, HEAD' }).end('Metodo non consentito');
    return;
  }

  const file = (await risolviFile(richiesta.url ?? '/')) ?? join(RADICE, 'index.html');
  const estensione = extname(file).toLowerCase();

  // Gli asset con hash nel nome sono immutabili; index.html deve essere sempre fresco.
  const cache = file.includes(`${'/'}assets${'/'}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';

  risposta.writeHead(200, {
    'Content-Type': TIPI[estensione] ?? 'application/octet-stream',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  });

  if (richiesta.method === 'HEAD') {
    risposta.end();
    return;
  }

  createReadStream(file)
    .on('error', () => risposta.end())
    .pipe(risposta);
});

server.listen(PORTA, HOST, () => {
  console.log(`Welfare Aziendale in ascolto su http://${HOST}:${PORTA}`);
});
