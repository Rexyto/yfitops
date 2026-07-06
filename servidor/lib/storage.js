import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getConnection } from './mysql.js';
import { APP_VERSION_FILE, CHANGELOG_FILE, DEFAULT_VERSION, DEFAULT_CHANGELOG } from './config.js';

// Función helper para formatear fechas a MySQL
function formatDateForMySQL(date) {
  if (!date) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (typeof date === 'string' && date.includes('T')) {
    return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
  }
  return date;
}

function parseJsonField(field, defaultValue = []) {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return defaultValue;
  }
}

// Funciones para archivos (version.json y actualizacion.json)
async function readJsonFile(filePath, defaultValue) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      const data = JSON.parse(JSON.stringify(defaultValue));
      await writeJsonFile(filePath, data);
      return data;
    }
    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  await fs.rename(tempPath, filePath);
}

// Funciones MySQL para usuarios
export async function readUsers() {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(row => ({
      id: row.id,
      username: row.username,
      password: row.password,
      favorites: parseJsonField(row.favorites, []),
      songs: parseJsonField(row.songs, [])
    }));
  } catch (error) {
    console.error('[STORAGE] Error leyendo usuarios:', error.message);
    return [];
  }
}

export async function writeUsers(users) {
  const connection = await getConnection();
  try {
    // Limpiar tabla
    await connection.execute('DELETE FROM users');

    // Insertar usuarios uno por uno
    if (users.length > 0) {
      for (const user of users) {
        await connection.execute(
          'INSERT INTO users (id, username, password, favorites, songs) VALUES (?, ?, ?, ?, ?)',
          [
            user.id,
            user.username,
            user.password,
            JSON.stringify(user.favorites || []),
            JSON.stringify(user.songs || [])
          ]
        );
      }
    }

    console.log(`[STORAGE] ${users.length} usuarios guardados`);
  } catch (error) {
    console.error('[STORAGE] Error guardando usuarios:', error.message);
    throw error;
  }
}

// Funciones MySQL para canciones
export async function readData() {
  const connection = await getConnection();
  try {
    const [songs] = await connection.execute('SELECT * FROM songs ORDER BY upload_date DESC');
    const [playlists] = await connection.execute('SELECT * FROM playlists ORDER BY created_at DESC');

    return {
      songs: songs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        filename: song.filename,
        url: song.url,
        coverUrl: song.cover_url,
        uploadDate: song.upload_date
      })),
      playlists: playlists.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        songs: parseJsonField(playlist.songs, []),
        coverColor: playlist.cover_color,
        userId: playlist.user_id,
        createdAt: playlist.created_at
      }))
    };
  } catch (error) {
    console.error('[STORAGE] Error leyendo datos:', error.message);
    return { songs: [], playlists: [] };
  }
}

export async function writeData(data) {
  const connection = await getConnection();
  try {
    // Limpiar tablas
    await connection.execute('DELETE FROM songs');
    await connection.execute('DELETE FROM playlists');

    // Insertar canciones uno por uno
    if (data.songs && data.songs.length > 0) {
      for (const song of data.songs) {
        await connection.execute(
          'INSERT INTO songs (id, title, artist, album, duration, filename, url, cover_url, upload_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            song.id,
            song.title || '',
            song.artist || '',
            song.album || '',
            song.duration || 0,
            song.filename || '',
            song.url || '',
            song.coverUrl || null,
            formatDateForMySQL(song.uploadDate || new Date())
          ]
        );
      }
    }

    // Insertar playlists uno por uno
    if (data.playlists && data.playlists.length > 0) {
      for (const playlist of data.playlists) {
        await connection.execute(
          'INSERT INTO playlists (id, name, songs, cover_color, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            playlist.id,
            playlist.name || '',
            JSON.stringify(playlist.songs || []),
            playlist.coverColor || '#1DB954',
            playlist.userId || null,
            formatDateForMySQL(playlist.createdAt || new Date())
          ]
        );
      }
    }

    console.log(`[STORAGE] ${data.songs?.length || 0} canciones y ${data.playlists?.length || 0} playlists guardadas`);
  } catch (error) {
    console.error('[STORAGE] Error guardando datos:', error.message);
    throw error;
  }
}

// Funciones MySQL para playlists de carpeta
export async function readDataPl() {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT * FROM folder_playlists ORDER BY updated_at DESC');
    return {
      playlists: rows.map(row => {
        try {
          return {
            id: row.id,
            name: row.name,
            folderName: row.folder_name,
            songs: parseJsonField(row.songs, []),
            coverUrl: row.cover_url,
            totalDuration: row.total_duration,
            source: row.source,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        } catch (parseError) {
          console.error(`[STORAGE] Error parseando playlist de carpeta ${row.id}:`, parseError.message);
          console.error('[STORAGE] Datos raw songs:', row.songs);

          // Intentar reparar automáticamente
          const fixedSongs = Array.isArray(row.songs) ? JSON.stringify(row.songs) : '[]';

          connection.execute(
            'UPDATE folder_playlists SET songs = ? WHERE id = ?',
            [fixedSongs, row.id]
          ).catch(err => console.error('[STORAGE] Error actualizando playlist:', err.message));

          return {
            id: row.id,
            name: row.name,
            folderName: row.folder_name,
            songs: JSON.parse(fixedSongs),
            coverUrl: row.cover_url,
            totalDuration: row.total_duration,
            source: row.source,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        }
      })
    };
  } catch (error) {
    console.error('[STORAGE] Error leyendo playlists de carpeta:', error.message);
    return { playlists: [] };
  }
}

export async function writeDataPl(data) {
  const connection = await getConnection();
  try {
    // Limpiar tabla
    await connection.execute('DELETE FROM folder_playlists');

    // Insertar playlists uno por uno
    if (data.playlists && data.playlists.length > 0) {
      for (const playlist of data.playlists) {
        await connection.execute(
          'INSERT INTO folder_playlists (id, name, folder_name, songs, cover_url, total_duration, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            playlist.id,
            playlist.name || '',
            playlist.folderName || '',
            JSON.stringify(playlist.songs || []),
            playlist.coverUrl || null,
            playlist.totalDuration || 0,
            playlist.source || 'folder',
            formatDateForMySQL(playlist.createdAt),
            formatDateForMySQL(playlist.updatedAt)
          ]
        );
      }
    }

    console.log(`[STORAGE] ${data.playlists?.length || 0} playlists de carpeta guardadas`);
  } catch (error) {
    console.error('[STORAGE] Error guardando playlists de carpeta:', error.message);
    throw error;
  }
}

export async function readBotApiKeys() {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT * FROM bot_api_keys ORDER BY created_at DESC');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      apiKey: row.api_key,
      active: Boolean(row.active),
      usageCount: row.usage_count,
      avgResponseMs: row.avg_response_ms,
      lastResponseMs: row.last_response_ms,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('[STORAGE] Error leyendo claves de bot:', error.message);
    return [];
  }
}

export async function findBotApiKeyByKey(apiKey) {
  if (!apiKey) return null;
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT * FROM bot_api_keys WHERE api_key = ?', [apiKey]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      apiKey: row.api_key,
      active: Boolean(row.active),
      usageCount: row.usage_count,
      avgResponseMs: row.avg_response_ms,
      lastResponseMs: row.last_response_ms,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('[STORAGE] Error buscando clave de bot:', error.message);
    return null;
  }
}

export async function createBotApiKey(name = 'Bot API Key') {
  const connection = await getConnection();
  const apiKey = crypto.randomBytes(24).toString('hex');
  const id = crypto.randomUUID();
  const now = formatDateForMySQL(new Date());
  try {
    await connection.execute(
      `INSERT INTO bot_api_keys (id, name, api_key, active, usage_count, avg_response_ms, last_response_ms, created_at, updated_at)
       VALUES (?, ?, ?, 1, 0, 0, 0, ?, ?)`,
      [id, name, apiKey, now, now]
    );

    return {
      id,
      name,
      apiKey,
      active: true,
      usageCount: 0,
      avgResponseMs: 0,
      lastResponseMs: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.error('[STORAGE] Error creando clave de bot:', error.message);
    throw error;
  }
}

export async function updateBotApiKey(id, updates) {
  const connection = await getConnection();
  const fields = [];
  const values = [];
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.active !== undefined) {
    fields.push('active = ?');
    values.push(updates.active ? 1 : 0);
  }
  if (fields.length === 0) return null;
  values.push(id);
  try {
    await connection.execute(
      `UPDATE bot_api_keys SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    const [rows] = await connection.execute('SELECT * FROM bot_api_keys WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      apiKey: row.api_key,
      active: Boolean(row.active),
      usageCount: row.usage_count,
      avgResponseMs: row.avg_response_ms,
      lastResponseMs: row.last_response_ms,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('[STORAGE] Error actualizando clave de bot:', error.message);
    throw error;
  }
}

export async function resetBotApiKey(id) {
  const connection = await getConnection();
  const apiKey = crypto.randomBytes(24).toString('hex');
  try {
    await connection.execute(
      `UPDATE bot_api_keys SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [apiKey, id]
    );
    const [rows] = await connection.execute('SELECT * FROM bot_api_keys WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      apiKey: row.api_key,
      active: Boolean(row.active),
      usageCount: row.usage_count,
      avgResponseMs: row.avg_response_ms,
      lastResponseMs: row.last_response_ms,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('[STORAGE] Error reseteando clave de bot:', error.message);
    throw error;
  }
}

export async function deleteBotApiKey(id) {
  const connection = await getConnection();
  try {
    await connection.execute('DELETE FROM bot_api_keys WHERE id = ?', [id]);
  } catch (error) {
    console.error('[STORAGE] Error eliminando clave de bot:', error.message);
    throw error;
  }
}

export async function recordBotApiKeyUsage(apiKey, responseMs) {
  if (!apiKey || typeof responseMs !== 'number') return;
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT usage_count, avg_response_ms FROM bot_api_keys WHERE api_key = ?', [apiKey]);
    const row = rows[0];
    if (!row) return;
    const count = row.usage_count || 0;
    const avg = row.avg_response_ms || 0;
    const nextCount = count + 1;
    const nextAvg = Math.round((avg * count + responseMs) / nextCount);
    await connection.execute(
      `UPDATE bot_api_keys SET
        usage_count = ?,
        avg_response_ms = ?,
        last_response_ms = ?,
        last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE api_key = ?`,
      [nextCount, nextAvg, responseMs, apiKey]
    );
  } catch (error) {
    console.error('[STORAGE] Error registrando uso de bot key:', error.message);
  }
}

// Funciones para archivos (version.json y actualizacion.json)
export async function readVersion() {
  return readJsonFile(APP_VERSION_FILE, DEFAULT_VERSION);
}

export function writeVersion(data) {
  return writeJsonFile(APP_VERSION_FILE, data);
}

export async function readChangelog() {
  return readJsonFile(CHANGELOG_FILE, DEFAULT_CHANGELOG);
}

// Funciones MySQL para estadísticas
export async function readStats() {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT * FROM stats WHERE id = 1');
    if (rows.length === 0) {
      return {
        totalListeningSeconds: 0,
        totalSongsPlayed: 0,
        latencySamples: [],
        processingTimes: [],
        dailyListening: {}
      };
    }

    const row = rows[0];
    return {
      totalListeningSeconds: row.total_listening_seconds,
      totalSongsPlayed: row.total_songs_played,
      latencySamples: parseJsonField(row.latency_samples, []),
      processingTimes: parseJsonField(row.processing_times, []),
      dailyListening: parseJsonField(row.daily_listening, {})
    };
  } catch (error) {
    console.error('[STORAGE] Error leyendo estadísticas:', error.message);
    return {
      totalListeningSeconds: 0,
      totalSongsPlayed: 0,
      latencySamples: [],
      processingTimes: [],
      dailyListening: {}
    };
  }
}

export async function writeStats(stats) {
  const connection = await getConnection();
  try {
    await connection.execute(`
      UPDATE stats SET
        total_listening_seconds = ?,
        total_songs_played = ?,
        latency_samples = ?,
        processing_times = ?,
        daily_listening = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      stats.totalListeningSeconds || 0,
      stats.totalSongsPlayed || 0,
      JSON.stringify(stats.latencySamples || []),
      JSON.stringify(stats.processingTimes || []),
      JSON.stringify(stats.dailyListening || {})
    ]);

    console.log('[STORAGE] Estadísticas guardadas');
  } catch (error) {
    console.error('[STORAGE] Error guardando estadísticas:', error.message);
    throw error;
  }
}

// Función auxiliar
export function avg(arr) {
  return Array.isArray(arr) && arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}
