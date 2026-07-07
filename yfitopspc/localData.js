// localData.js
// Todo lo que vive SOLO en el dispositivo: foto de perfil, canciones
// descargadas para escuchar offline y los metadatos de esas playlists.
// Nada de esto se sube nunca al servidor.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const userDataDir = () => app.getPath('userData');
const profilePicBase = () => path.join(userDataDir(), 'profile-picture');
const downloadsDir = () => path.join(userDataDir(), 'downloads');
const songsDir = () => path.join(downloadsDir(), 'songs');
const playlistsDir = () => path.join(downloadsDir(), 'playlists');

function ensureDirs() {
  try { fs.mkdirSync(songsDir(), { recursive: true }); } catch {}
  try { fs.mkdirSync(playlistsDir(), { recursive: true }); } catch {}
}

const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// ── Foto de perfil ────────────────────────────────────────────
// Se guarda como archivo binario en el disco del usuario, nunca en el servidor.
function findExistingProfilePicture() {
  const dir = userDataDir();
  const files = fs.readdirSync(dir).filter(f => f.startsWith('profile-picture.'));
  return files[0] ? path.join(dir, files[0]) : null;
}

function saveProfilePicture(dataUrl) {
  try {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) throw new Error('Formato de imagen no soportado');
    const mime = match[1].toLowerCase();
    const ext = MIME_EXT[mime] || '.png';
    const buffer = Buffer.from(match[2], 'base64');

    // Limpiar cualquier foto anterior con otra extensión
    const existing = findExistingProfilePicture();
    if (existing) { try { fs.unlinkSync(existing); } catch {} }

    fs.writeFileSync(`${profilePicBase()}${ext}`, buffer);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getProfilePicture() {
  try {
    const found = findExistingProfilePicture();
    if (!found) return null;
    const ext = path.extname(found).toLowerCase();
    const mime = EXT_MIME[ext] || 'image/png';
    const buffer = fs.readFileSync(found);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function clearProfilePicture() {
  try {
    const existing = findExistingProfilePicture();
    if (existing) fs.unlinkSync(existing);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Canciones descargadas ──────────────────────────────────────
function findSongFile(songId) {
  ensureDirs();
  const dir = songsDir();
  const match = fs.readdirSync(dir).find(f => path.parse(f).name === String(songId));
  return match ? path.join(dir, match) : null;
}

function isSongDownloaded(songId) {
  return !!findSongFile(songId);
}

function getLocalSongPath(songId) {
  const found = findSongFile(songId);
  if (!found) return null;
  // file:// con las barras siempre en formato URL (importante en Windows)
  return `file://${found.replace(/\\/g, '/')}`;
}

async function downloadSong(songId, url) {
  ensureDirs();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();

    // Adivinar extensión a partir de la URL; por defecto mp3
    let ext = path.extname(new URL(url).pathname).toLowerCase();
    if (!ext || ext.length > 5) ext = '.mp3';

    // Si ya había una copia con otra extensión, la quitamos primero
    const existing = findSongFile(songId);
    if (existing) { try { fs.unlinkSync(existing); } catch {} }

    fs.writeFileSync(path.join(songsDir(), `${songId}${ext}`), Buffer.from(arrayBuffer));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteSongFile(songId) {
  try {
    const found = findSongFile(songId);
    if (found) fs.unlinkSync(found);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getCacheSize() {
  ensureDirs();
  try {
    const dir = songsDir();
    const files = fs.readdirSync(dir);
    let total = 0;
    for (const f of files) {
      try { total += fs.statSync(path.join(dir, f)).size; } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

function getDownloadsInfo() {
  ensureDirs();
  try {
    const files = fs.readdirSync(songsDir());
    return {
      songIds: files.map(f => path.parse(f).name),
      totalBytes: getCacheSize(),
    };
  } catch {
    return { songIds: [], totalBytes: 0 };
  }
}

// Borra TODO lo descargado: audios y metadatos de playlists offline.
function clearSongCache() {
  ensureDirs();
  try {
    for (const f of fs.readdirSync(songsDir())) {
      try { fs.unlinkSync(path.join(songsDir(), f)); } catch {}
    }
    for (const f of fs.readdirSync(playlistsDir())) {
      try { fs.unlinkSync(path.join(playlistsDir(), f)); } catch {}
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Metadatos de playlists offline ─────────────────────────────
function safePlaylistFile(id) {
  return path.join(playlistsDir(), `${id}.json`);
}

function saveOfflinePlaylist(playlist) {
  ensureDirs();
  try {
    fs.writeFileSync(safePlaylistFile(playlist.id), JSON.stringify({
      ...playlist,
      downloadedAt: Date.now(),
    }));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getOfflinePlaylists() {
  ensureDirs();
  try {
    return fs.readdirSync(playlistsDir())
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(playlistsDir(), f), 'utf-8')); }
        catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Borra la playlist offline y, de sus canciones, solo elimina el audio
// de las que no pertenezcan a ninguna otra playlist descargada.
function deleteOfflinePlaylist(playlistId) {
  ensureDirs();
  try {
    const all = getOfflinePlaylists();
    const target = all.find(p => p.id === playlistId);
    if (!target) return { success: true };

    const others = all.filter(p => p.id !== playlistId);
    const stillUsed = new Set(others.flatMap(p => (p.songs || []).map(s => s.id)));

    for (const song of target.songs || []) {
      if (!stillUsed.has(song.id)) deleteSongFile(song.id);
    }

    fs.unlinkSync(safePlaylistFile(playlistId));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  saveProfilePicture, getProfilePicture, clearProfilePicture,
  downloadSong, deleteSongFile, isSongDownloaded, getLocalSongPath,
  getCacheSize, getDownloadsInfo, clearSongCache,
  saveOfflinePlaylist, getOfflinePlaylists, deleteOfflinePlaylist,
};
