import fs from 'fs/promises';
import path from 'path';
import { getConnection } from './mysql.js';
import { CANCIONES_DIR, PLAYLIST_DIR, PORTADAS_DIR } from './config.js';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function normalizeCoverUrl(value) {
  if (typeof value !== 'string') return null;
  const pathname = value.split(/[?#]/, 1)[0];
  try {
    return pathname.split('/').map(segment => decodeURIComponent(segment)).join('/');
  } catch {
    return pathname;
  }
}

function parseSongs(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getLocalCoverPath(coverUrl) {
  const normalized = normalizeCoverUrl(coverUrl);
  if (!normalized) return null;
  let root;
  let relativePath;
  if (normalized.startsWith('/canciones/')) {
    root = CANCIONES_DIR;
    relativePath = normalized.slice('/canciones/'.length);
  } else if (normalized.startsWith('/playlist/')) {
    root = PLAYLIST_DIR;
    relativePath = normalized.slice('/playlist/'.length);
  } else if (normalized.startsWith('/portadas/')) {
    root = PORTADAS_DIR;
    relativePath = normalized.slice('/portadas/'.length);
  } else {
    return null;
  }

  const absolutePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, absolutePath);
  if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) return null;
  return { absolutePath, normalized };
}

export async function cleanupUnusedSongCovers(coverUrls) {
  const candidates = [...new Map(
    coverUrls.map(getLocalCoverPath).filter(Boolean).map(candidate => [candidate.normalized, candidate])
  ).values()];
  if (candidates.length === 0) return;

  let connection;
  let songCoverRows;
  let folderPlaylistRows;
  let playlistCoverRows;
  try {
    connection = await getConnection();
    [songCoverRows] = await connection.execute('SELECT cover_url FROM songs WHERE cover_url IS NOT NULL');
    [folderPlaylistRows] = await connection.execute('SELECT songs, cover_url FROM folder_playlists');
    [playlistCoverRows] = await connection.execute('SELECT cover_url FROM playlists WHERE cover_url IS NOT NULL');
  } catch (error) {
    console.error('[PORTADA] No se pudo comprobar si las imágenes siguen en uso; se conservarán:', error.message);
    return;
  }

  const referencedCovers = new Set(
    [...songCoverRows, ...playlistCoverRows, ...folderPlaylistRows]
      .map(row => normalizeCoverUrl(row.cover_url))
      .filter(Boolean)
  );
  for (const playlist of folderPlaylistRows) {
    const songs = parseSongs(playlist.songs);
    if (!songs) {
      console.warn('[PORTADA] Playlist con canciones ilegibles; se conservan las imágenes para evitar borrados incorrectos');
      return;
    }
    for (const song of songs) {
      const cover = normalizeCoverUrl(song?.coverUrl);
      if (cover) referencedCovers.add(cover);
    }
  }

  for (const candidate of candidates) {
    if (referencedCovers.has(candidate.normalized)) {
      console.log(`[PORTADA] Conservada ${candidate.normalized}: todavía la usa otra canción`);
      continue;
    }
    try {
      await fs.unlink(candidate.absolutePath);
      console.log(`[PORTADA] Eliminada ${candidate.normalized}: ya no tiene canciones asociadas`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[PORTADA] No se pudo eliminar ${candidate.normalized}:`, error.message);
      }
    }
  }
}

export function songCoverUrls(songId, scope = null) {
  if (!songId || typeof songId !== 'string' || /[\\/]/.test(songId)) return [];
  const folderPrefix = scope
    ? `/playlist/${encodeURIComponent(scope)}/`
    : '/canciones/';
  const prefixes = scope
    ? [`${folderPrefix}${encodeURIComponent(songId)}`, `${folderPrefix}pl_${encodeURIComponent(songId)}`]
    : [`${folderPrefix}${encodeURIComponent(songId)}`];
  return prefixes.flatMap(prefix => IMAGE_EXTENSIONS.map(extension => `${prefix}${extension}`));
}

export function coverUrlForCleanup(coverUrl) {
  return getLocalCoverPath(coverUrl) ? [coverUrl] : [];
}
