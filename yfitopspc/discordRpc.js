// discordRpc.js
const { Client } = require('@xhayper/discord-rpc');
const { ActivityType } = require('discord-api-types/v10');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const logPath = path.join(app.getPath('userData'), 'discord-rpc.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logPath, line); } catch {}
  console.log(msg);
}

const clientId = process.env.DISCORD_CLIENT_ID || '1519069424890675300';
const rpc = new Client({ clientId });

let ready = false;

// Se captura UNA sola vez, al cargar este módulo (cuando arranca la app).
// Así el contador de Discord muestra el tiempo que llevas con la app abierta,
// no el progreso de la canción actual.
const appStartTimestamp = Date.now();

rpc.on('ready', () => {
  ready = true;
  log(`Conectado como ${rpc.user?.username}`);
});

rpc.login().catch((err) => {
  log(`No se pudo conectar (¿Discord cerrado?): ${err.message}`);
});

function setNowPlaying({ title, artist, paused, coverUrl }) {
  log(`setNowPlaying llamado: ready=${ready} title=${title} paused=${paused}`);
  if (!ready) return;

  const stateText = artist
    ? (paused ? `${artist} · En pausa` : artist)
    : (paused ? 'En pausa' : null);

  rpc.user?.setActivity({
    type: ActivityType.Listening,
    details: title,
    state: stateText,
    startTimestamp: appStartTimestamp, // sin endTimestamp -> contador ascendente, sin barra
    largeImageKey: coverUrl,
    largeImageText: artist || title,
    instance: false,
  }).then(() => log('setActivity OK')).catch(e => log(`Error setActivity: ${e.message}`));
}

function clearPresence() {
  log('clearPresence llamado');
  if (!ready) return;
  rpc.user?.clearActivity().catch(() => {});
}

module.exports = { setNowPlaying, clearPresence };