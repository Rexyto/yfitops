import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { parseFile } from 'music-metadata';
import { CANCIONES_DIR, PLAYLIST_DIR, PORTADAS_DIR, AUDIO_EXTS, IMAGE_EXTS } from './config.js';

// ── Carátulas personalizadas (carpeta portadas/) ──────────────
// Permite poner un .webp con el mismo nombre que el mp3 en la carpeta
// portadas/ del servidor, y se usará como carátula con prioridad sobre
// la que venga incrustada en los metadatos del propio archivo de audio.
export async function listPortadaFiles() {
  try {
    return await fs.readdir(PORTADAS_DIR);
  } catch {
    return [];
  }
}

export function matchCustomCover(filename, portadaFiles) {
  const rawName = path.parse(filename).name;
  const cleanName = path.parse(filename.replace(/^\d+-/, '')).name;
  const candidateNames = [rawName, cleanName];
  const candidateExts = ['.webp', '.png', '.jpg', '.jpeg'];
  for (const name of candidateNames) {
    for (const ext of candidateExts) {
      const target = `${name}${ext}`.toLowerCase();
      const match = portadaFiles.find(f => f.toLowerCase() === target);
      if (match) return `/portadas/${encodeURIComponent(match)}`;
    }
  }
  return null;
}

export async function getAudioDuration(filePath) {
  try {
    const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { timeout: 10000 }).toString().trim();
    const dur = parseFloat(out);
    if (dur > 1) return dur;
  } catch {}

  try {
    const meta = await parseFile(filePath, { duration: true, skipCovers: true });
    if (meta.format.duration > 1) return meta.format.duration;
  } catch {}

  try {
    const stat = await fs.stat(filePath);
    const est = stat.size / 16000;
    if (est > 5) return est;
  } catch {}

  return 0;
}

export async function processAudioFile(filename, existingId = null) {
  const filePath = path.join(CANCIONES_DIR, filename);
  const cleanFilename = path.parse(filename.replace(/^\d+-/, '')).name;
  let title = cleanFilename;
  let artist = 'Desconocido';
  let album = 'Desconocido';
  let coverUrl = null;
  const songId = existingId || Date.now().toString();

  try {
    const meta = await parseFile(filePath, { duration: false, skipCovers: false });
    if (meta.common.title) title = meta.common.title;
    if (meta.common.artist) artist = meta.common.artist;
    if (meta.common.album) album = meta.common.album;
    if (meta.common.picture?.length > 0) {
      const coverFilename = `${songId}.jpg`;
      await fs.writeFile(path.join(CANCIONES_DIR, coverFilename), meta.common.picture[0].data);
      coverUrl = `/canciones/${coverFilename}`;
    }
  } catch (e) {
    console.error('[AUDIO] Metadata error for', filename, e.message || e);
  }

  const customCover = matchCustomCover(filename, await listPortadaFiles());
  if (customCover) coverUrl = customCover;

  const duration = await getAudioDuration(filePath);
  return {
    id: songId,
    title,
    artist,
    album,
    duration,
    filename,
    url: `/canciones/${encodeURIComponent(filename)}`,
    coverUrl,
    uploadDate: new Date().toISOString()
  };
}

export async function scanPlaylistFolder(folderName, existingPl) {
  const folderPath = path.join(PLAYLIST_DIR, folderName);
  try {
    const s = await fs.stat(folderPath);
    if (!s.isDirectory()) return null;
  } catch {
    return null;
  }

  const files = await fs.readdir(folderPath);
  let coverUrl = null;
  for (const ext of IMAGE_EXTS) {
    if (files.includes(folderName + ext)) {
      coverUrl = `/playlist/${encodeURIComponent(folderName)}/${encodeURIComponent(folderName + ext)}`;
      break;
    }
  }

  const audioFiles = files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()));
  const existing = existingPl || { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), songs: [] };
  const existingMap = new Map((existing.songs || []).map(s => [s.filename, s]));
  const songs = [];
  const portadaFiles = await listPortadaFiles();

  for (const filename of audioFiles) {
    const customCover = matchCustomCover(filename, portadaFiles);

    if (existingMap.has(filename)) {
      const existingSong = existingMap.get(filename);
      songs.push(customCover && existingSong.coverUrl !== customCover ? { ...existingSong, coverUrl: customCover } : existingSong);
      continue;
    }

    const filePath = path.join(folderPath, filename);
    let title = path.parse(filename).name;
    let artist = 'Desconocido';
    let album = folderName;
    let songCoverUrl = null;
    const songId = Date.now().toString() + Math.random().toString(36).slice(2, 6);

    try {
      const meta = await parseFile(filePath, { duration: false, skipCovers: false });
      if (meta.common.title) title = meta.common.title;
      if (meta.common.artist) artist = meta.common.artist;
      if (meta.common.album) album = meta.common.album;
      if (meta.common.picture?.length > 0) {
        const coverFilename = `pl_${songId}.jpg`;
        await fs.writeFile(path.join(PLAYLIST_DIR, folderName, coverFilename), meta.common.picture[0].data);
        songCoverUrl = `/playlist/${encodeURIComponent(folderName)}/${coverFilename}`;
      }
    } catch {}

    if (customCover) songCoverUrl = customCover;

    const duration = await getAudioDuration(filePath);
    songs.push({
      id: songId,
      title,
      artist,
      album,
      duration,
      filename,
      url: `/playlist/${encodeURIComponent(folderName)}/${encodeURIComponent(filename)}`,
      coverUrl: songCoverUrl
    });
    await new Promise(r => setTimeout(r, 1));
  }

  return {
    id: existing.id,
    name: folderName,
    folderName,
    songs,
    coverUrl,
    totalDuration: songs.reduce((acc, s) => acc + (s.duration || 0), 0),
    source: 'folder',
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}