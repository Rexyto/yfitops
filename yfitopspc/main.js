const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { setNowPlaying, clearPresence } = require('./discordRpc');

const isDev = !app.isPackaged;

const tokenPath = path.join(app.getPath('userData'), 'session.json');

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
    backgroundColor: '#0a0a0a',
    // Sin titlebar nativa — usamos nuestra propia drag region en CSS
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true);
    callback(false);
  });

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