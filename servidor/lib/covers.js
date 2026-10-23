import { execFile as execFileCallback } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { DATA_DIR, PORTADAS_DIR } from './config.js';

const execFile = promisify(execFileCallback);
const IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ARTWORK_CACHE_PATH = path.join(DATA_DIR, 'artwork-cache.json');
const ARTWORK_CACHE_LIMIT = 5000;
const POSITIVE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const PROVIDER_MIN_INTERVAL = { Deezer: 1000, iTunes: 3100 };
const pendingArtwork = new Map();
const artworkCache = new Map();
const providerState = new Map();
let artworkCacheLoadPromise = null;
let artworkCacheWritePromise = Promise.resolve();
let providerQueue = Promise.resolve();

const sleep = milliseconds => new Promise(resolve => {
  const timer = setTimeout(resolve, milliseconds);
  timer.unref?.();
});

export function normalizeCoverName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]/gu, '');
}

function removeArtworkAnnotations(value) {
  return String(value || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, match =>
      /official|video|vídeo|letra|lyrics|live|shot\s+by|visuali[sz]er|ultra\s+records|audio/i.test(match)
        ? ' '
        : match
    )
    .replace(/\s*[\[(][^\])]*$/g, ' ')
    .replace(/(?:^|\s)[#@][\p{Letter}\p{Number}_]+/gu, ' ')
    .replace(/\s*-\s*\d+\s*$/g, ' ')
    .replace(/\s*[-–—]\s*$/g, ' ')
    .replace(/["'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanArtworkSearchText(value) {
  return removeArtworkAnnotations(value)
    .replace(/\s+(?:ft\.?|feat(?:uring)?\.?)\s+.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanArtworkArtist(value) {
  let artist = cleanArtworkSearchText(value);
  if (normalizeCoverName(artist) === normalizeCoverName('Desconocido')) return '';
  const comma = artist.indexOf(',');
  if (comma > 0 && !/,\s*the\b/i.test(artist)) artist = artist.slice(0, comma);
  return artist.trim();
}

export function parseTrackFilename(filename) {
  const cleanName = removeArtworkAnnotations(path.parse(String(filename).replace(/^\d+-/, '')).name);
  const separator = cleanName.search(/[-–—]/u);
  if (separator > 0 && separator < cleanName.length - 1) {
    const artist = cleanArtworkArtist(cleanName.slice(0, separator));
    const title = cleanArtworkSearchText(cleanName.slice(separator + 1));
    if (artist && title) return { title, artist };
  }
  return { title: cleanName, artist: 'Desconocido' };
}

export function extractYouTubeVideoId(value) {
  const text = String(value || '');
  const urlMatch = text.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (urlMatch) return urlMatch[1];
  const filenameMatch = path.basename(text).match(/\[([A-Za-z0-9_-]{11})\](?=[^[]*$)/);
  return filenameMatch?.[1] || null;
}

async function loadArtworkCache() {
  if (!artworkCacheLoadPromise) {
    artworkCacheLoadPromise = (async () => {
      let contents;
      try {
        contents = await fs.readFile(ARTWORK_CACHE_PATH, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return;
        console.error('[PORTADA] No se pudo leer la caché:', error.message);
        return;
      }
      try {
        const entries = JSON.parse(contents);
        const now = Date.now();
        for (const [key, entry] of Object.entries(entries)) {
          if (entry && Number(entry.expiresAt) > now && (entry.url === null || typeof entry.url === 'string')) {
            artworkCache.set(key, entry);
          }
        }
      } catch (error) {
        console.error('[PORTADA] La caché persistente no es válida:', error.message);
      }
    })();
  }
  await artworkCacheLoadPromise;
}

async function persistArtworkCache() {
  artworkCacheWritePromise = artworkCacheWritePromise.catch(() => {}).then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const now = Date.now();
    for (const [key, entry] of artworkCache) {
      if (entry.expiresAt <= now) artworkCache.delete(key);
    }
    while (artworkCache.size > ARTWORK_CACHE_LIMIT) {
      artworkCache.delete(artworkCache.keys().next().value);
    }
    const tempPath = `${ARTWORK_CACHE_PATH}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(Object.fromEntries(artworkCache)));
      await fs.rename(tempPath, ARTWORK_CACHE_PATH);
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  });
  await artworkCacheWritePromise;
}

async function getCachedArtwork(key) {
  await loadArtworkCache();
  const entry = artworkCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    artworkCache.delete(key);
    return undefined;
  }
  artworkCache.delete(key);
  artworkCache.set(key, entry);
  return entry;
}

async function setCachedArtwork(key, url) {
  await loadArtworkCache();
  artworkCache.delete(key);
  artworkCache.set(key, {
    url,
    expiresAt: Date.now() + (url ? POSITIVE_CACHE_TTL : NEGATIVE_CACHE_TTL),
  });
  await persistArtworkCache();
}

function retryAfterMilliseconds(response) {
  const value = response.headers.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function enqueueProviderRequest(provider, operation) {
  const request = providerQueue.then(async () => {
    const state = providerState.get(provider) || { nextRequestAt: 0, blockedUntil: 0, rateLimitCount: 0 };
    if (state.blockedUntil > Date.now()) {
      const error = new Error(`fuente temporalmente bloqueada (${Math.ceil((state.blockedUntil - Date.now()) / 1000)} s)`);
      error.status = 429;
      throw error;
    }
    const wait = state.nextRequestAt - Date.now();
    if (wait > 0) await sleep(wait);
    state.nextRequestAt = Date.now() + PROVIDER_MIN_INTERVAL[provider];
    providerState.set(provider, state);
    try {
      const result = await operation();
      state.rateLimitCount = 0;
      return result;
    } catch (error) {
      if (error.status === 429) {
        const backoff = error.retryAfterMs ?? Math.min(15 * 60 * 1000, 5000 * (2 ** state.rateLimitCount));
        state.rateLimitCount += 1;
        state.blockedUntil = Date.now() + backoff;
      } else if (error.status === 403) {
        state.blockedUntil = Date.now() + 30 * 60 * 1000;
      }
      throw error;
    }
  });
  providerQueue = request.catch(() => {});
  return request;
}

export function findCoverFile(filename, portadaFiles, title = '', artist = '') {
  const cleanName = path.parse(String(filename).replace(/^\d+-/, '')).name;
  const candidates = new Set([
    path.parse(String(filename)).name,
    cleanName,
    title && artist && artist !== 'Desconocido' ? `${title} - ${artist}` : '',
    (!artist || artist === 'Desconocido') ? title : '',
  ].filter(Boolean).map(normalizeCoverName));
  for (const extension of IMAGE_EXTENSIONS) {
    const match = portadaFiles.find(file =>
      path.extname(file).toLowerCase() === extension
      && candidates.has(normalizeCoverName(path.parse(file).name))
    );
    if (match) return `/portadas/${encodeURIComponent(match)}`;
  }
  return null;
}

function artworkMatchesTrack(track, title, artist) {
  const normalizedTitle = normalizeCoverName(title);
  const normalizedArtist = artist === 'Desconocido' ? '' : normalizeCoverName(artist);
  const resultTitle = normalizeCoverName(track.title || track.trackName);
  const resultArtist = normalizeCoverName(track.artist?.name || track.artistName);
  const titleMatches = normalizedTitle && (
    resultTitle === normalizedTitle
    || (normalizedArtist && normalizedTitle.length >= 5 && resultTitle.startsWith(normalizedTitle))
    || (normalizedArtist && resultTitle.length >= 5 && normalizedTitle.startsWith(resultTitle))
  );
  const artistMatches = !normalizedArtist || !resultArtist
    || resultArtist.includes(normalizedArtist)
    || normalizedArtist.includes(resultArtist);
  return titleMatches && artistMatches;
}

async function requestJson(url, provider) {
  return enqueueProviderRequest(provider, async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'YFitops/1.0' },
      redirect: 'error',
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.retryAfterMs = retryAfterMilliseconds(response);
      throw error;
    }
    return response.json();
  });
}

async function findDeezerArtwork(title, artist) {
  const query = [title, artist].filter(Boolean).join(' ');
  const url = new URL('https://api.deezer.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');
  const result = await requestJson(url, 'Deezer');
  const track = result.data?.find(item => artworkMatchesTrack(item, title, artist));
  return track?.album?.cover_xl || track?.album?.cover_big || track?.album?.cover_medium || null;
}

async function findITunesArtwork(title, artist) {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', [title, artist].filter(Boolean).join(' '));
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', '10');
  const result = await requestJson(url, 'iTunes');
  const track = result.results?.find(item => artworkMatchesTrack(item, title, artist));
  return track?.artworkUrl100
    ?.replace(/\/\d+x\d+bb(?=\.[^.]+$)/i, '/600x600bb')
    || track?.artworkUrl100
    || null;
}

function safeCoverStem(title, artist) {
  const raw = artist && artist !== 'Desconocido' ? `${title} - ${artist}` : title;
  const safe = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 160);
  if (safe && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) return safe;
  return `track-${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
}

export function sharedCoverFilename(title, artist) {
  return `${safeCoverStem(title, artist)}.webp`;
}

export async function convertImageToWebp(imageBuffer, originalFilename) {
  const extension = path.extname(originalFilename).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(extension)) throw new Error('Formato de imagen no compatible');
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) throw new Error('La imagen está vacía');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yfitops-upload-cover-'));
  const inputPath = path.join(tempDir, `source${extension}`);
  const outputPath = path.join(tempDir, 'cover.webp');
  try {
    await fs.writeFile(inputPath, imageBuffer);
    await execFile('ffmpeg', [
      '-y', '-v', 'error', '-i', inputPath,
      '-frames:v', '1',
      '-vf', "scale=w='min(1200,iw)':h='min(1200,ih)':force_original_aspect_ratio=decrease",
      '-c:v', 'libwebp', '-quality', '82',
      '-compression_level', '6', outputPath,
    ], { timeout: 20000 });
    const webpBuffer = await fs.readFile(outputPath);
    if (webpBuffer.length === 0) throw new Error('FFmpeg generó una imagen vacía');
    return webpBuffer;
  } catch (error) {
    throw new Error(`No se pudo convertir la portada a WebP (comprueba que ffmpeg esté instalado): ${error.message}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function extensionFromResponse(response, imageUrl) {
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const contentTypeExtension = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }[contentType];
  if (contentTypeExtension) return contentTypeExtension;

  const extension = path.extname(new URL(imageUrl).pathname).toLowerCase();
  return IMAGE_EXTENSIONS.includes(extension) ? extension : null;
}

async function downloadAndSaveArtwork(imageUrl, title, artist) {
  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('La URL de la imagen no es HTTPS');
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw new Error(`Descarga HTTP ${response.status}`);

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) {
    throw new Error('La imagen supera el tamaño máximo de 10 MB');
  }

  const extension = extensionFromResponse(response, imageUrl);
  if (!extension) throw new Error('Formato de imagen no compatible');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_IMAGE_SIZE) throw new Error('La imagen supera el tamaño máximo de 10 MB');
    chunks.push(chunk);
  }
  if (size === 0) throw new Error('La imagen está vacía');
  const data = Buffer.concat(chunks, size);

  await fs.mkdir(PORTADAS_DIR, { recursive: true });
  const stem = safeCoverStem(title, artist);
  const existingFiles = await fs.readdir(PORTADAS_DIR);
  const existingCover = findCoverFile('', existingFiles, title, artist);
  if (existingCover) return existingCover;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yfitops-cover-'));
  const inputPath = path.join(tempDir, `source${extension}`);
  const outputPath = path.join(tempDir, 'cover.webp');
  const webpFilename = `${stem}.webp`;
  const webpPath = path.join(PORTADAS_DIR, webpFilename);

  try {
    await fs.writeFile(inputPath, data);
    try {
      await execFile('ffmpeg', [
        '-y', '-v', 'error', '-i', inputPath,
        '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85', outputPath,
      ], { timeout: 20000 });
      await fs.rename(outputPath, webpPath);
      console.log(`[PORTADA] Guardada "${title}"${artist && artist !== 'Desconocido' ? ` - ${artist}` : ''} en ${webpFilename} (WebP)`);
      return `/portadas/${encodeURIComponent(webpFilename)}`;
    } catch (error) {
      console.warn(`[PORTADA] No se pudo convertir "${title}" a WebP; se conservará el formato original:`, error.message);
      const originalFilename = `${stem}${extension}`;
      await fs.writeFile(path.join(PORTADAS_DIR, originalFilename), data);
      console.log(`[PORTADA] Guardada "${title}" en ${originalFilename} (formato original)`);
      return `/portadas/${encodeURIComponent(originalFilename)}`;
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function findOrDownloadCover(filename, title, artist, sourceInfo = '', { refresh = false } = {}) {
  const existingFiles = await fs.readdir(PORTADAS_DIR).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const existingCover = findCoverFile(refresh ? '' : filename, existingFiles, title, artist);
  if (existingCover) {
    console.log(`[PORTADA] Reutilizada "${title}" desde ${existingCover}`);
    return existingCover;
  }
  if (!String(title || '').trim()) {
    console.log(`[PORTADA] No encontrada: falta el título para "${filename}"`);
    return null;
  }

  const searchTitle = cleanArtworkSearchText(title);
  const searchArtist = cleanArtworkArtist(artist);
  if (!searchTitle) return null;
  const key = `${normalizeCoverName(searchTitle)}|${normalizeCoverName(searchArtist)}`;
  if (refresh) {
    await loadArtworkCache();
    artworkCache.delete(key);
    await persistArtworkCache();
  }
  if (pendingArtwork.has(key)) return pendingArtwork.get(key);

  const lookup = (async () => {
    const cachedEntry = await getCachedArtwork(key);
    if (cachedEntry?.url === null) {
      const remainingDays = Math.max(1, Math.ceil((cachedEntry.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
      console.log(`[PORTADA] Caché negativa vigente (${remainingDays} día(s); no se consultan proveedores): "${searchTitle}"${searchArtist ? ` - ${searchArtist}` : ''}`);
      return null;
    }
    if (cachedEntry?.url) {
      try {
        return await downloadAndSaveArtwork(cachedEntry.url, searchTitle, searchArtist);
      } catch (error) {
        console.warn(`[PORTADA] Resultado en caché caducado para "${searchTitle}":`, error.message);
        artworkCache.delete(key);
      }
    } else {
      console.log(`[PORTADA] Sin caché para "${searchTitle}"${searchArtist ? ` - ${searchArtist}` : ''}; buscando en Deezer e iTunes`);
    }

    const videoId = extractYouTubeVideoId(`${filename} ${sourceInfo}`);
    if (videoId) {
      for (const quality of ['maxresdefault', 'hqdefault']) {
        try {
          const cover = await downloadAndSaveArtwork(
            `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`,
            searchTitle,
            searchArtist
          );
          await setCachedArtwork(key, `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`);
          return cover;
        } catch (error) {
          if (quality === 'hqdefault') {
            console.warn(`[PORTADA] Miniatura de YouTube no disponible para "${searchTitle}":`, error.message);
          }
        }
      }
    }

    const titleVariants = [...new Set([
      searchTitle,
      cleanArtworkSearchText(searchTitle.split(',')[0]),
    ].filter(Boolean))];
    let imageUrl = null;
    let foundProvider = null;
    let hadProviderError = false;
    for (const [provider, search] of [
      ['Deezer', findDeezerArtwork],
      ['iTunes', findITunesArtwork],
    ]) {
      for (const queryTitle of titleVariants) {
        try {
          imageUrl = await search(queryTitle, searchArtist);
          if (!imageUrl && searchArtist) imageUrl = await search(queryTitle, '');
          if (imageUrl) {
            foundProvider = provider;
            break;
          }
          console.log(`[PORTADA] ${provider}: sin resultados para "${queryTitle}"${searchArtist ? ` - ${searchArtist}` : ''}`);
        } catch (error) {
          hadProviderError = true;
          console.warn(`[PORTADA] ${provider} no pudo obtener la portada de "${queryTitle}":`, error.message);
          if (error.status === 429 || error.status === 403) break;
        }
      }
      if (imageUrl) break;
    }

    if (!imageUrl) {
      if (!hadProviderError) {
        await setCachedArtwork(key, null).catch(error =>
          console.error('[PORTADA] No se pudo guardar la caché negativa:', error.message)
        );
      }
      console.log(`[PORTADA] No encontrada: "${searchTitle}"${searchArtist ? ` - ${searchArtist}` : ''}`);
      return null;
    }

    await setCachedArtwork(key, imageUrl).catch(error =>
      console.error('[PORTADA] No se pudo guardar la caché:', error.message)
    );
    console.log(`[PORTADA] ${foundProvider}: resultado encontrado para "${searchTitle}"${searchArtist ? ` - ${searchArtist}` : ''}`);
    try {
      return await downloadAndSaveArtwork(imageUrl, searchTitle, searchArtist);
    } catch (error) {
      console.warn(`[PORTADA] No se pudo guardar la portada de "${searchTitle}":`, error.message);
      artworkCache.delete(key);
    }
    return null;
  })();
  pendingArtwork.set(key, lookup);
  try {
    return await lookup;
  } finally {
    pendingArtwork.delete(key);
  }
}
