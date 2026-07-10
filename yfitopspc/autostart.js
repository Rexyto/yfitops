// Gestiona el arranque automático de la app con el sistema operativo.
// Windows/macOS usan la API nativa de Electron; en Linux se registra
// mediante un archivo .desktop en ~/.config/autostart (estándar XDG).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const settingsPath = () => path.join(app.getPath('userData'), 'app-settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')); } catch { return {}; }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try { fs.writeFileSync(settingsPath(), JSON.stringify(next)); } catch {}
  return next;
}

function linuxDesktopFilePath() {
  return path.join(os.homedir(), '.config', 'autostart', 'yfitops.desktop');
}

function applyLinuxAutostart(enabled) {
  const filePath = linuxDesktopFilePath();
  if (enabled) {
    // Dentro de un AppImage, la variable APPIMAGE apunta al binario real
    const exePath = process.env.APPIMAGE || process.execPath;
    const contents = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=YFitops',
      `Exec=${exePath}`,
      'Icon=yfitops',
      'X-GNOME-Autostart-enabled=true',
      'Terminal=false',
      '',
    ].join('\n');
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, contents);
    } catch {}
  } else {
    try { fs.unlinkSync(filePath); } catch {}
  }
}

function applyAutostart(enabled) {
  // En desarrollo, process.execPath apunta al binario de Electron
  // (node_modules/electron/dist/electron.exe), NO a la app empaquetada.
  // Si se registrara ese binario como inicio automático, Windows/Linux
  // mostrarían "Electron" en el arranque en vez de "YFitops". Por eso
  // el inicio automático real solo se aplica en la build empaquetada;
  // en desarrollo el ajuste se guarda pero no se registra en el SO.
  if (!app.isPackaged) return;

  if (process.platform === 'linux') {
    applyLinuxAutostart(enabled);
  } else {
    try {
      const args = app.isPackaged ? [] : [app.getAppPath()];
      app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args });
    } catch {}
  }
}


function initAutostart() {
  const settings = readSettings();
  if (typeof settings.launchOnStartup !== 'boolean') {
    writeSettings({ launchOnStartup: true });
    applyAutostart(true);
    return true;
  }
  applyAutostart(settings.launchOnStartup);
  return settings.launchOnStartup;
}

function getLaunchOnStartup() {
  const settings = readSettings();
  return typeof settings.launchOnStartup === 'boolean' ? settings.launchOnStartup : true;
}

function setLaunchOnStartup(enabled) {
  writeSettings({ launchOnStartup: !!enabled });
  applyAutostart(!!enabled);
  return { success: true, enabled: !!enabled };
}

module.exports = { initAutostart, getLaunchOnStartup, setLaunchOnStartup };