import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ debug: false, override: true, path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs/promises';
import fsSync from 'fs';
import { initUsers } from './lib/auth.js';
import { attachRoutes } from './routes/index.js';
import { scanSongsOnStartup } from './lib/startup.js';
import { syncPlaylistDir, watchCanciones, watchPlaylistDir } from './lib/watchers.js';
import { initializeDatabase } from './lib/mysql.js';
import { globalIpLimiter, loginLimiter, heartbeatLimiter, apiLimiter, pcLimiter, webLimiter, botLimiter } from './lib/rateLimit.js';

const configModule = await import(new URL('./lib/config.js', import.meta.url));
const { HOST, PORT, DIST_DIR, CANCIONES_DIR, PLAYLIST_DIR, PORTADAS_DIR, ROOT_DIR, DATA_DIR } = configModule;

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Protección anti-spam (ver lib/rateLimit.js) ──────────────
// 1) Límite global por IP como backstop para todo el servidor.
// 2) Límites específicos por plataforma/ruta, más generosos en
//    heartbeat/latencia (se llaman muy seguido) y más estrictos
//    en login (fuerza bruta) y en bots.
app.use(globalIpLimiter);
app.use('/api/login', loginLimiter);
app.use('/pc/login', loginLimiter);
app.use('/web/login', loginLimiter);
app.use('/api/heartbeat', heartbeatLimiter);
app.use('/api/latency', heartbeatLimiter);
app.use('/pc/heartbeat', heartbeatLimiter);
app.use('/pc/latency', heartbeatLimiter);
app.use('/api', apiLimiter);
app.use('/pc', pcLimiter);
app.use('/web', webLimiter);
app.use('/bot', botLimiter);

app.use('/canciones', express.static(CANCIONES_DIR));
app.use('/playlist', express.static(PLAYLIST_DIR));
app.use('/portadas', express.static(PORTADAS_DIR));
app.use(express.static(DIST_DIR));

attachRoutes(app);

const distIndex = path.join(DIST_DIR, 'index.html');
const fallbackIndex = path.join(ROOT_DIR, 'index.html');

app.get('*', (req, res) => {
  if (fsSync.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }

  if (fsSync.existsSync(fallbackIndex)) {
    return res.sendFile(fallbackIndex);
  }

  res.status(404).send('Al parecer nos robaron la web xdddd.');
});

await fs.mkdir(CANCIONES_DIR, { recursive: true });
await fs.mkdir(PLAYLIST_DIR, { recursive: true });
await fs.mkdir(PORTADAS_DIR, { recursive: true });
await fs.mkdir(DATA_DIR, { recursive: true });

// Inicializar base de datos MySQL
await initializeDatabase();

await initUsers();
await scanSongsOnStartup();
await syncPlaylistDir();
watchCanciones();
watchPlaylistDir();

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor en http://${HOST}:${PORT}`);
  console.log('Externo: https://yfitops.duckdns.org');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] El puerto ${PORT} ya está en uso. Cierra la otra instancia o cambia PORT en .env.`);
  } else {
    console.error('[FATAL] Error de servidor:', err);
  }
  process.exit(1);
});