const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { setNowPlaying, clearPresence } = require('./discordRpc');
const localData = require('./localData');
const autostart = require('./autostart');

const isDev = !app.isPackaged;

const tokenPath = path.join(app.getPath('userData'), 'session.json');

// En Windows, sin esto la app puede identificarse como "Electron" en
// notificaciones, agrupación de la barra de tareas y accesos directos
// (incluido el de inicio automático). Debe fijarse lo antes posible.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.yfitops.pc');
}

// Icono según plataforma: .ico solo lo renderiza bien Windows,
// en Linux (barra de tareas, dock, alt-tab) hace falta un .png.
const iconPath = process.platform === 'win32'
  ? path.join(__dirname, 'assets', 'icon.ico')
  : path.join(__dirname, 'assets', 'icon.png');

function readPersistedToken() {
  try {
    const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    return data;
  } catch { return { token: null, username: null }; }
}

function writePersistedToken(token, username) {
  try { fs.writeFileSync(tokenPath, JSON.stringify({ token, username })); } catch {}
}

function clearPersistedToken() {
  try { fs.writeFileSync(tokenPath, JSON.stringify({ token: null, username: null })); } catch {}
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'YFitops',
    backgroundColor: '#0a0a0a',
    show: false,
    // Sin titlebar nativa — usamos nuestra propia drag region en CSS
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: iconPath,
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true);
    callback(false);
  });

  autostart.initAutostart();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  clearPresence();
});

// ── IPC: ventana ─────────────────────────────────────────────
ipcMain.handle('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.handle('window-maximize', () => {
  const w = BrowserWindow.getFocusedWindow();
  w?.isMaximized() ? w.unmaximize() : w?.maximize();
});
ipcMain.handle('window-close', () => BrowserWindow.getFocusedWindow()?.close());
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

// ── IPC: sesión persistida ────────────────────────────────────
ipcMain.handle('get-session',   () => readPersistedToken());
ipcMain.handle('set-session',   (_, token, username) => writePersistedToken(token, username));
ipcMain.handle('clear-session', () => clearPersistedToken());

// ── IPC: Discord Rich Presence ────────────────────────────────
ipcMain.handle('discord-now-playing', (_, payload) => {
  setNowPlaying(payload);
});

ipcMain.handle('discord-clear-presence', () => {
  clearPresence();
});

// ── IPC: foto de perfil (solo local, nunca al servidor) ────────
ipcMain.handle('save-profile-picture',  (_, dataUrl) => localData.saveProfilePicture(dataUrl));
ipcMain.handle('get-profile-picture',   () => localData.getProfilePicture());
ipcMain.handle('clear-profile-picture', () => localData.clearProfilePicture());

// ── IPC: descargas offline (canciones y playlists) ─────────────
ipcMain.handle('download-song',        (_, songId, url) => localData.downloadSong(songId, url));
ipcMain.handle('delete-song-file',     (_, songId) => localData.deleteSongFile(songId));
ipcMain.handle('is-song-downloaded',   (_, songId) => localData.isSongDownloaded(songId));
ipcMain.handle('get-local-song-path',  (_, songId) => localData.getLocalSongPath(songId));
ipcMain.handle('get-downloads-info',   () => localData.getDownloadsInfo());

ipcMain.handle('save-offline-playlist',   (_, playlist) => localData.saveOfflinePlaylist(playlist));
ipcMain.handle('get-offline-playlists',   () => localData.getOfflinePlaylists());
ipcMain.handle('delete-offline-playlist', (_, playlistId) => localData.deleteOfflinePlaylist(playlistId));

// ── IPC: gestión de caché ───────────────────────────────────────
ipcMain.handle('get-cache-size',  () => localData.getCacheSize());
ipcMain.handle('clear-song-cache', () => localData.clearSongCache());

// ── IPC: inicio automático con el sistema ───────────────────────
ipcMain.handle('get-launch-on-startup', () => autostart.getLaunchOnStartup());
ipcMain.handle('set-launch-on-startup', (_, enabled) => autostart.setLaunchOnStartup(enabled));