import fsSync from 'fs';
import path from 'path';
import { CANCIONES_DIR, PLAYLIST_DIR, AUDIO_EXTS } from './config.js';
import { readData, writeData, readUsers, writeUsers, readDataPl, writeDataPl } from './storage.js';
import { processAudioFile, scanPlaylistFolder } from './audio.js';

export async function syncPlaylistDir() {
  const data = await readDataPl().catch(() => ({ playlists: [] }));
  let folders;
  try {
    const entries = await fsSync.promises.readdir(PLAYLIST_DIR, { withFileTypes: true });
    folders = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return;
  }

  const existingMap = new Map(data.playlists.map(p => [p.folderName, p]));
  data.playlists = (await Promise.all(folders.map(f => scanPlaylistFolder(f, existingMap.get(f))))).filter(Boolean);
  await writeDataPl(data);
  console.log(`[PLAYLIST] ${data.playlists.length} colecciones, ${data.playlists.reduce((a, p) => a + p.songs.length, 0)} canciones`);
}

export async function watchCanciones() {
  const debounceMap = new Map();

  fsSync.watch(CANCIONES_DIR, async (eventType, filename) => {
    if (!filename || !AUDIO_EXTS.includes(path.extname(filename).toLowerCase())) return;
    if (debounceMap.has(filename)) clearTimeout(debounceMap.get(filename));

    debounceMap.set(filename, setTimeout(async () => {
      debounceMap.delete(filename);
      const filePath = path.join(CANCIONES_DIR, filename);
      const data = await readData();
      const exists = await fsSync.promises.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        if (data.songs.some(s => s.filename === filename)) return;
        const song = await processAudioFile(filename);
        data.songs.push(song);
        await writeData(data);
        console.log(`[WATCHER] Añadida: ${song.title}`);
      } else {
        const removed = data.songs.find(s => s.filename === filename);
        if (!removed) return;
        data.songs = data.songs.filter(s => s.filename !== filename);
        const users = await readUsers();
        for (const u of users) u.favorites = (u.favorites || []).filter(id => id !== removed.id);
        await writeUsers(users);
        try { await fsSync.promises.unlink(path.join(CANCIONES_DIR, `${removed.id}.jpg`)); } catch {}
        await writeData(data);
        console.log(`[WATCHER] Eliminada: ${filename}`);
      }
    }, 1500));
  });
}

export async function watchPlaylistDir() {
  let debounceTimeout = null;
  try {
    fsSync.watch(PLAYLIST_DIR, { recursive: true }, () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => syncPlaylistDir().catch((error) => console.error('[PLAYLIST WATCHER]', error.message || error)), 2000);
    });
  } catch (e) {
    console.error('[PLAYLIST WATCHER]', e.message || e);
  }
}
