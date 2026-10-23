import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { parseFile } from 'music-metadata';
import { CANCIONES_DIR, PLAYLIST_DIR, PORTADAS_DIR, AUDIO_EXTS, IMAGE_EXTS } from './config.js';
import { findCoverFile, findOrDownloadCover, normalizeCoverName, parseTrackFilename } from './covers.js';

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

export function matchCustomCover(filename, portadaFiles, title = '', artist = '') {
  return findCoverFile(filename, portadaFiles, title, artist);
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

export async function readTrackMetadata(filePath, filename, defaultAlbum) {
  const fallback = parseTrackFilename(filename);
  const metadata = {
    title: fallback.title,
    artist: fallback.artist,
    album: defaultAlbum,
    picture: null,
  };
  try {
    const meta = await parseFile(filePath, { duration: false, skipCovers: false });
    if (meta.common.title) metadata.title = meta.common.title;
    if (meta.common.artist) metadata.artist = meta.common.artist;
    if (meta.common.album) metadata.album = meta.common.album;
    if (meta.common.picture?.length > 0) metadata.picture = meta.common.picture[0].data;
    const comments = Array.isArray(meta.common.comment)
      ? meta.common.comment.map(comment => typeof comment === 'string' ? comment : comment?.text || '')
      : [];
    metadata.source = [meta.common.url, ...comments].filter(Boolean).join(' ');
  } catch (e) {
    console.error('[AUDIO] Metadata error for', filename, e.message || e);
  }
  return metadata;
}

async function createAudioRecord({
  filePath,
  filename,
  songId,
  metadata,
  embeddedCoverPath,
  embeddedCoverUrl,
  audioUrl,
  previousCoverUrl = null,
  fetchMissingArtwork = false,
}) {
  let coverUrl = null;
  const hasEmbeddedPicture = Boolean(metadata.picture);
  if (hasEmbeddedPicture) {
    await fs.writeFile(embeddedCoverPath, metadata.picture);
    coverUrl = embeddedCoverUrl;
    console.log(`[PORTADA] Extraída del audio "${metadata.title}"`);
  }

  const customCover = matchCustomCover(filename, await listPortadaFiles(), metadata.title, metadata.artist);
  if (customCover) {
    coverUrl = customCover;
    console.log(`[PORTADA] Reutilizada "${metadata.title}" desde ${customCover}`);
  } else if (!hasEmbeddedPicture && fetchMissingArtwork) {
    coverUrl = await findOrDownloadCover(filename, metadata.title, metadata.artist, metadata.source);
  }
  if (!coverUrl && previousCoverUrl) coverUrl = previousCoverUrl;
  const duration = await getAudioDuration(filePath);
  return {
    id: songId,
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    duration,
    filename,
    url: audioUrl,
    coverUrl,
  };
}

export async function processAudioFile(filename, existingId = null) {
  const filePath = path.join(CANCIONES_DIR, filename);
  const songId = existingId || Date.now().toString();
  const metadata = await readTrackMetadata(filePath, filename, 'Desconocido');
  return {
    ...await createAudioRecord({
      filePath,
      filename,
      songId,
      metadata,
      embeddedCoverPath: path.join(CANCIONES_DIR, `${songId}.jpg`),
      embeddedCoverUrl: `/canciones/${songId}.jpg`,
      audioUrl: `/canciones/${encodeURIComponent(filename)}`,
    }),
    uploadDate: new Date().toISOString(),
  };
}

export async function processPlaylistAudioFile(
  folderName,
  filename,
  previousSong = null,
  metadata = null,
  { fetchMissingArtwork = true } = {}
) {
  const filePath = path.join(PLAYLIST_DIR, folderName, filename);
  const songId = previousSong?.id || `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const trackMetadata = metadata || await readTrackMetadata(filePath, filename, folderName);
  const coverFilename = `pl_${songId}.jpg`;
  return createAudioRecord({
    filePath,
    filename,
    songId,
    metadata: trackMetadata,
    embeddedCoverPath: path.join(PLAYLIST_DIR, folderName, coverFilename),
    embeddedCoverUrl: `/playlist/${encodeURIComponent(folderName)}/${encodeURIComponent(coverFilename)}`,
    audioUrl: `/playlist/${encodeURIComponent(folderName)}/${encodeURIComponent(filename)}`,
    previousCoverUrl: previousSong?.coverUrl || null,
    fetchMissingArtwork,
  });
}

export async function scanPlaylistFolder(
  folderName,
  existingPl,
  { retryMissingCovers = false, fetchMissingCovers = true } = {}
) {
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
    const coverFilename = files.includes(`cover${ext}`) ? `cover${ext}` : files.includes(folderName + ext) ? folderName + ext : null;
    if (coverFilename) {
      coverUrl = `/playlist/${encodeURIComponent(folderName)}/${encodeURIComponent(coverFilename)}`;
      break;
    }
  }

  const audioFiles = files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()));
  const existing = existingPl || { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), songs: [] };
  const oldSongs = Array.isArray(existing.songs) ? existing.songs : [];
  const existingMap = new Map(oldSongs.map(s => [s.filename, s]));
  const remainingSongsByIdentity = new Map();
  const orphanSongs = oldSongs.filter(song => !audioFiles.includes(song.filename));
  for (const song of oldSongs) {
    if (audioFiles.includes(song.filename)) continue;
    const key = `${normalizeCoverName(song.title)}|${normalizeCoverName(song.artist)}`;
    if (key === '|') continue;
    if (!remainingSongsByIdentity.has(key)) remainingSongsByIdentity.set(key, []);
    remainingSongsByIdentity.get(key).push(song);
  }
  const newFiles = audioFiles.filter(filename => !existingMap.has(filename));
  const metadataByFilename = new Map();
  const previousSongByFilename = new Map();
  const matchedOldSongIds = new Set();

  for (const filename of newFiles) {
    const metadata = await readTrackMetadata(path.join(folderPath, filename), filename, folderName);
    metadataByFilename.set(filename, metadata);
    const key = `${normalizeCoverName(metadata.title)}|${normalizeCoverName(metadata.artist)}`;
    const matchingSongs = remainingSongsByIdentity.get(key);
    const previousSong = matchingSongs?.shift() || null;
    if (previousSong) {
      previousSongByFilename.set(filename, previousSong);
      matchedOldSongIds.add(previousSong.id);
    }
  }

  const unmatchedNewFiles = newFiles.filter(filename => !previousSongByFilename.has(filename));
  const unmatchedOldSongs = orphanSongs.filter(song => !matchedOldSongIds.has(song.id));
  if (
    unmatchedNewFiles.length === 1
    && unmatchedOldSongs.length === 1
    && unmatchedOldSongs[0].coverUrl
  ) {
    previousSongByFilename.set(unmatchedNewFiles[0], unmatchedOldSongs[0]);
    matchedOldSongIds.add(unmatchedOldSongs[0].id);
  }

  const songs = [];

  for (const filename of audioFiles) {
    if (existingMap.has(filename)) {
      const existingSong = existingMap.get(filename);
      const customCover = matchCustomCover(filename, await listPortadaFiles(), existingSong.title, existingSong.artist);
      if (customCover && existingSong.coverUrl !== customCover) {
        console.log(`[PORTADA] Actualizada "${existingSong.title}" desde ${customCover}`);
        songs.push({ ...existingSong, coverUrl: customCover });
      } else if (retryMissingCovers && !existingSong.coverUrl) {
        const fileMetadata = await readTrackMetadata(path.join(folderPath, filename), filename, folderName);
        const persistedMetadata = {
          ...fileMetadata,
          title: typeof existingSong.title === 'string' ? existingSong.title : fileMetadata.title,
          artist: typeof existingSong.artist === 'string' ? existingSong.artist : fileMetadata.artist,
          album: typeof existingSong.album === 'string' ? existingSong.album : fileMetadata.album,
        };
        const recoveredSong = await processPlaylistAudioFile(
          folderName,
          filename,
          existingSong,
          persistedMetadata,
          { fetchMissingArtwork: fetchMissingCovers }
        );
        if (recoveredSong.coverUrl) {
          console.log(`[PORTADA] Recuperada al sincronizar "${recoveredSong.title}"`);
        }
        songs.push(recoveredSong);
      } else {
        songs.push(existingSong);
      }
      continue;
    }

    const metadata = metadataByFilename.get(filename);
    const previousSong = previousSongByFilename.get(filename) || null;
    const song = await processPlaylistAudioFile(
      folderName,
      filename,
      previousSong,
      metadata,
      { fetchMissingArtwork: fetchMissingCovers }
    );
    songs.push(song);
    if (previousSong && previousSong.filename !== filename) {
      console.log(`[DB] Archivo renombrado "${previousSong.filename}" → "${filename}" en playlist "${folderName}"`);
    } else if (!previousSong) {
      console.log(`[DB] Añadida "${song.title}"${song.artist !== 'Desconocido' ? ` - ${song.artist}` : ''} a playlist "${folderName}"`);
    }
    await new Promise(r => setTimeout(r, 1));
  }

  for (const oldSong of oldSongs) {
    if (!audioFiles.includes(oldSong.filename) && !matchedOldSongIds.has(oldSong.id)) {
      console.log(`[DB] Eliminada "${oldSong.title}" (${oldSong.filename}) de playlist "${folderName}"`);
    }
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