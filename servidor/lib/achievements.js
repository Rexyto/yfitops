import { getConnection } from './mysql.js';
import { readUsers, readData, readDataPl } from './storage.js';
import {
  getUserListeningStats,
  getCurrentStreak,
  getMaxDailySeconds,
  getUniqueSongsPlayedCount,
  getUniquePlaylistsPlayedCount,
  getMaxSongPlayCount,
  getMaxPlaylistPlayCount,
} from './userStats.js';

function mapRow(row) {
  return {
    id: row.id,
    icon: row.icon,
    title: row.title,
    description: row.description,
    category: row.category,
    metric: row.metric,
    threshold: row.threshold,
    clientReported: Boolean(row.client_reported),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// CATÁLOGO (tabla `achievements`)
// ─────────────────────────────────────────────────────────────

export async function getActiveCatalog() {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM achievements WHERE active = 1 ORDER BY sort_order ASC, category ASC'
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error leyendo catálogo:', error.message);
    return [];
  }
}

export async function getFullCatalog() {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM achievements ORDER BY sort_order ASC, category ASC'
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error leyendo catálogo completo:', error.message);
    return [];
  }
}

export async function getAchievementById(id) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT * FROM achievements WHERE id = ?', [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error leyendo logro:', error.message);
    return null;
  }
}

export async function createAchievement(data) {
  const connection = await getConnection();
  const id = data.id || data.title?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').slice(0, 60) || `custom_${Date.now()}`;
  try {
    await connection.execute(
      `INSERT INTO achievements (id, icon, title, description, category, metric, threshold, client_reported, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.icon || '🏅',
        data.title || 'Logro',
        data.description || '',
        data.category || 'general',
        data.metric || 'client_reported',
        Number(data.threshold) || 1,
        data.clientReported ? 1 : 0,
        data.active === false ? 0 : 1,
        Number.isFinite(data.sortOrder) ? data.sortOrder : 999,
      ]
    );
    return getAchievementById(id);
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error creando logro:', error.message);
    throw error;
  }
}

export async function updateAchievement(id, data) {
  const connection = await getConnection();
  const fields = [];
  const values = [];
  const map = {
    icon: 'icon', title: 'title', description: 'description', category: 'category',
    metric: 'metric', threshold: 'threshold',
  };
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) { fields.push(`${col} = ?`); values.push(data[key]); }
  }
  if (data.clientReported !== undefined) { fields.push('client_reported = ?'); values.push(data.clientReported ? 1 : 0); }
  if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }
  if (data.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(data.sortOrder); }
  if (!fields.length) return getAchievementById(id);
  values.push(id);
  try {
    await connection.execute(`UPDATE achievements SET ${fields.join(', ')} WHERE id = ?`, values);
    return getAchievementById(id);
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error actualizando logro:', error.message);
    throw error;
  }
}

export async function deleteAchievement(id) {
  const connection = await getConnection();
  try {
    await connection.execute('DELETE FROM achievements WHERE id = ?', [id]);
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error eliminando logro:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// DESBLOQUEOS (tabla `user_achievements`)
// ─────────────────────────────────────────────────────────────

export async function getUserUnlocked(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?',
      [userId]
    );
    return new Map(rows.map(r => [r.achievement_id, r.unlocked_at]));
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error leyendo logros del usuario:', error.message);
    return new Map();
  }
}

async function unlockMany(userId, achievementIds) {
  if (!achievementIds.length) return;
  const connection = await getConnection();
  for (const id of achievementIds) {
    try {
      await connection.execute(
        'INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        [userId, id]
      );
    } catch (error) {
      console.error('[ACHIEVEMENTS] Error desbloqueando logro:', id, error.message);
    }
  }
}

// Intenta desbloquear UN logro y dice si esta llamada en concreto ha sido
// la que lo ha desbloqueado de verdad (a diferencia de "leer si ya está
// desbloqueado y luego insertar", que es una condición de carrera: si dos
// llamadas casi simultáneas leen "todavía no" antes de que ninguna haya
// escrito nada, las dos se creen las primeras). En vez de eso, se intenta
// insertar directamente y se mira `affectedRows`: MySQL sólo deja que UNA
// de las dos inserciones concurrentes tenga éxito de verdad gracias a la
// clave primaria (user_id, achievement_id) de `user_achievements`; la otra
// se ignora sola (INSERT IGNORE) y devuelve affectedRows = 0. Así no hace
// falta ningún candado en memoria: la propia base de datos hace de árbitro.
async function tryUnlockOne(userId, achievementId) {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute(
      'INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
      [userId, achievementId]
    );
    return (result?.affectedRows || 0) > 0;
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error desbloqueando logro:', achievementId, error.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// MÉTRICAS DEL USUARIO
// ─────────────────────────────────────────────────────────────

async function getLibrarySize() {
  try {
    const [data, dataPl] = await Promise.all([readData(), readDataPl()]);
    const folderSongs = (dataPl.playlists || []).reduce((acc, p) => acc + (p.songs?.length || 0), 0);
    return (data.songs?.length || 0) + folderSongs;
  } catch {
    return 0;
  }
}

export async function computeUserMetrics(userId) {
  const [
    users,
    listening,
    streak,
    maxDailySeconds,
    uniqueSongs,
    uniquePlaylists,
    maxSongPlays,
    maxPlaylistPlays,
    librarySize,
    achievementsUnlockedMap,
    playlistsCreatedCount,
  ] = await Promise.all([
    readUsers(),
    getUserListeningStats(userId),
    getCurrentStreak(userId),
    getMaxDailySeconds(userId),
    getUniqueSongsPlayedCount(userId),
    getUniquePlaylistsPlayedCount(userId),
    getMaxSongPlayCount(userId),
    getMaxPlaylistPlayCount(userId),
    getLibrarySize(),
    getUserUnlocked(userId),
    getUserPlaylistsCreatedCount(userId),
  ]);

  const user = users.find(u => u.id === userId);
  const accountAgeDays = user?.createdAt
    ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
    : 0;

  return {
    songs_played: listening.totalSongsPlayed,
    unique_songs_played: uniqueSongs,
    song_play_count: maxSongPlays,
    listening_hours: listening.totalListeningSeconds / 3600,
    daily_streak: streak,
    favorites_count: user?.favorites?.length || 0,
    playlists_created: playlistsCreatedCount,
    unique_playlists_played: uniquePlaylists,
    playlist_play_count: maxPlaylistPlays,
    songs_uploaded: user?.songs?.length || 0,
    night_hours: listening.nightSeconds / 3600,
    weekend_hours: listening.weekendSeconds / 3600,
    account_age_days: accountAgeDays,
    achievements_unlocked: achievementsUnlockedMap.size,
    library_size: librarySize,
    max_daily_hours: maxDailySeconds / 3600,
  };
}

async function getUserPlaylistsCreatedCount(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT COUNT(*) as c FROM playlists WHERE user_id = ?', [userId]);
    return rows[0]?.c || 0;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// EVALUACIÓN
// ─────────────────────────────────────────────────────────────

// Compara las métricas actuales del usuario contra el catálogo y
// desbloquea los logros nuevos que ya cumple. Se puede (y debe)
// llamar con frecuencia: es barato y es idempotente (INSERT IGNORE).
// Si dos heartbeats (u otros disparadores) del MISMO usuario llegan casi a
// la vez, sin este candado ambos podrían leer "todavía no desbloqueado"
// para el mismo logro antes de que ninguno haya terminado de escribirlo, y
// el cliente recibiría el mismo logro duplicado en dos respuestas seguidas.
// Con este Map, la segunda llamada mientras la primera sigue en curso
// simplemente espera a que termine esa (en vez de lanzar otra evaluación en
// paralelo) y no devuelve nada nuevo por su cuenta.
const evaluationLocks = new Map(); // userId -> Promise

export async function evaluateUserAchievements(userId) {
  if (!userId) return [];

  const inProgress = evaluationLocks.get(userId);
  if (inProgress) {
    await inProgress.catch(() => {});
    return [];
  }

  const promise = doEvaluateUserAchievements(userId);
  evaluationLocks.set(userId, promise);
  try {
    return await promise;
  } finally {
    evaluationLocks.delete(userId);
  }
}

async function doEvaluateUserAchievements(userId) {
  const [catalog, unlocked, metrics] = await Promise.all([
    getActiveCatalog(),
    getUserUnlocked(userId),
    computeUserMetrics(userId),
  ]);

  const toUnlock = catalog.filter((a) => {
    if (a.clientReported) return false;
    if (unlocked.has(a.id)) return false;
    const value = metrics[a.metric];
    return typeof value === 'number' && value >= a.threshold;
  });

  if (toUnlock.length) {
    await unlockMany(userId, toUnlock.map(a => a.id));
  }
  return toUnlock;
}

// Desbloqueo manual para logros "client_reported" (cosas que sólo
// el cliente sabe, como descargas offline). Valida que el logro
// exista, esté activo y esté marcado como reclamable por el cliente.
export async function claimClientAchievement(userId, achievementId) {
  const achievement = await getAchievementById(achievementId);
  if (!achievement || !achievement.active || !achievement.clientReported) {
    return { ok: false, error: 'Logro no reclamable' };
  }
  // Se intenta desbloquear directamente (sin comprobar antes si ya lo
  // estaba): así, si el cliente llama a este endpoint dos veces casi a la
  // vez para el mismo logro (por ejemplo, una vez al terminar una descarga
  // y otra vez al entrar en Perfil justo después), sólo UNA de las dos
  // llamadas se lleva `alreadyUnlocked: false` y por tanto sólo una
  // muestra el toast de "logro desbloqueado" en el cliente.
  const justUnlocked = await tryUnlockOne(userId, achievementId);
  return { ok: true, alreadyUnlocked: !justUnlocked, achievement };
}

// Devuelve el catálogo completo con el estado de desbloqueo y el
// progreso actual de cada logro para un usuario concreto.
export async function getUserAchievementsView(userId) {
  const [catalog, unlocked, metrics] = await Promise.all([
    getActiveCatalog(),
    getUserUnlocked(userId),
    computeUserMetrics(userId),
  ]);

  return catalog.map((a) => {
    const isUnlocked = unlocked.has(a.id);
    const rawProgress = a.clientReported ? (isUnlocked ? a.threshold : 0) : (metrics[a.metric] || 0);
    return {
      id: a.id,
      icon: a.icon,
      title: a.title,
      description: a.description,
      category: a.category,
      threshold: a.threshold,
      clientReported: a.clientReported,
      unlocked: isUnlocked,
      unlockedAt: unlocked.get(a.id) || null,
      progress: Math.min(rawProgress, a.threshold),
    };
  });
}