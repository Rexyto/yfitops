import { getConnection } from './mysql.js';

// ── Utilidades de fecha ─────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isWeekend(date = new Date()) {
  const day = date.getDay(); // 0 = domingo, 6 = sábado
  return day === 0 || day === 6;
}

function isNight(date = new Date()) {
  const h = date.getHours();
  return h >= 0 && h < 6;
}

// ─────────────────────────────────────────────────────────────
// REGISTRO DE ESCUCHA (llamado desde /heartbeat)
// ─────────────────────────────────────────────────────────────

// Suma segundos escuchados al total del usuario, al día de hoy,
// y a los contadores de noche/fin de semana según la hora del
// servidor en el momento de la llamada. Es una aproximación
// (no reparte el tramo si cruza medianoche o el límite del finde),
// suficiente para fines de logros/estadísticas.
export async function addListeningSeconds(userId, seconds) {
  if (!userId || !seconds || seconds <= 0) return;
  const connection = await getConnection();
  const now = new Date();
  const nightSecs = isNight(now) ? seconds : 0;
  const weekendSecs = isWeekend(now) ? seconds : 0;

  try {
    await connection.execute(
      `INSERT INTO user_listening_stats (user_id, total_listening_seconds, total_songs_played, night_seconds, weekend_seconds)
       VALUES (?, ?, 0, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_listening_seconds = total_listening_seconds + VALUES(total_listening_seconds),
         night_seconds = night_seconds + VALUES(night_seconds),
         weekend_seconds = weekend_seconds + VALUES(weekend_seconds)`,
      [userId, seconds, nightSecs, weekendSecs]
    );

    await connection.execute(
      `INSERT INTO user_daily_listening (user_id, day, seconds)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE seconds = seconds + VALUES(seconds)`,
      [userId, todayStr(), seconds]
    );
  } catch (error) {
    console.error('[USERSTATS] Error registrando segundos de escucha:', error.message);
  }
}

// Marca el inicio de reproducción de una canción (se llama sólo
// cuando cambia de canción o empieza a reproducir, igual que el
// contador global de /heartbeat).
export async function recordSongPlay(userId, song) {
  if (!userId || !song?.id) return;
  const connection = await getConnection();
  try {
    await connection.execute(
      `INSERT INTO user_listening_stats (user_id, total_listening_seconds, total_songs_played)
       VALUES (?, 0, 1)
       ON DUPLICATE KEY UPDATE total_songs_played = total_songs_played + 1`,
      [userId]
    );

    await connection.execute(
      `INSERT INTO user_song_plays (user_id, song_id, song_title, song_artist, play_count, last_played_at)
       VALUES (?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         play_count = play_count + 1,
         song_title = VALUES(song_title),
         song_artist = VALUES(song_artist),
         last_played_at = NOW()`,
      [userId, song.id, song.title || 'Desconocido', song.artist || 'Desconocido']
    );
  } catch (error) {
    console.error('[USERSTATS] Error registrando reproducción de canción:', error.message);
  }
}

// Marca el inicio de reproducción de una playlist/colección.
export async function recordPlaylistPlay(userId, playlist) {
  if (!userId || !playlist?.id) return;
  const connection = await getConnection();
  const type = playlist.type === 'folder' ? 'folder' : 'manual';
  try {
    await connection.execute(
      `INSERT INTO user_playlist_plays (user_id, playlist_id, playlist_type, playlist_name, play_count, last_played_at)
       VALUES (?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         play_count = play_count + 1,
         playlist_name = VALUES(playlist_name),
         last_played_at = NOW()`,
      [userId, playlist.id, type, playlist.name || 'Playlist']
    );
  } catch (error) {
    console.error('[USERSTATS] Error registrando reproducción de playlist:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// LECTURA DE ESTADÍSTICAS
// ─────────────────────────────────────────────────────────────

export async function getUserListeningStats(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM user_listening_stats WHERE user_id = ?',
      [userId]
    );
    const row = rows[0];
    return {
      totalListeningSeconds: row?.total_listening_seconds || 0,
      totalSongsPlayed: row?.total_songs_played || 0,
      nightSeconds: row?.night_seconds || 0,
      weekendSeconds: row?.weekend_seconds || 0,
    };
  } catch (error) {
    console.error('[USERSTATS] Error leyendo estadísticas de usuario:', error.message);
    return { totalListeningSeconds: 0, totalSongsPlayed: 0, nightSeconds: 0, weekendSeconds: 0 };
  }
}

export async function getUserDailyListening(userId, days = 30) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT day, seconds FROM user_daily_listening
       WHERE user_id = ? AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY day ASC`,
      [userId, days]
    );
    return rows.map(r => ({
      date: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
      seconds: r.seconds,
    }));
  } catch (error) {
    console.error('[USERSTATS] Error leyendo escucha diaria:', error.message);
    return [];
  }
}

export async function getMostPlayedSong(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT song_id, song_title, song_artist, play_count, last_played_at
       FROM user_song_plays WHERE user_id = ?
       ORDER BY play_count DESC, last_played_at DESC LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].song_id,
      title: rows[0].song_title,
      artist: rows[0].song_artist,
      playCount: rows[0].play_count,
    };
  } catch (error) {
    console.error('[USERSTATS] Error leyendo canción más escuchada:', error.message);
    return null;
  }
}

export async function getMostPlayedPlaylist(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT playlist_id, playlist_type, playlist_name, play_count, last_played_at
       FROM user_playlist_plays WHERE user_id = ?
       ORDER BY play_count DESC, last_played_at DESC LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].playlist_id,
      type: rows[0].playlist_type,
      name: rows[0].playlist_name,
      playCount: rows[0].play_count,
    };
  } catch (error) {
    console.error('[USERSTATS] Error leyendo playlist más escuchada:', error.message);
    return null;
  }
}

// Racha de días consecutivos escuchando música (incluye hoy si ya
// hay algo registrado, o cuenta desde ayer si hoy aún no se ha
// escuchado nada).
export async function getCurrentStreak(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT day FROM user_daily_listening
       WHERE user_id = ? AND seconds > 0
       ORDER BY day DESC LIMIT 400`,
      [userId]
    );
    if (!rows.length) return 0;

    const days = rows.map(r => (r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10)));
    const daySet = new Set(days);

    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // Si hoy no hay escucha todavía, la racha se cuenta desde ayer
    // (no se rompe sólo porque aún no ha pasado el día).
    if (!daySet.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  } catch (error) {
    console.error('[USERSTATS] Error calculando racha:', error.message);
    return 0;
  }
}

export async function getMaxDailySeconds(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT MAX(seconds) as m FROM user_daily_listening WHERE user_id = ?',
      [userId]
    );
    return rows[0]?.m || 0;
  } catch (error) {
    console.error('[USERSTATS] Error leyendo máximo diario:', error.message);
    return 0;
  }
}

export async function getUniqueSongsPlayedCount(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as c FROM user_song_plays WHERE user_id = ?',
      [userId]
    );
    return rows[0]?.c || 0;
  } catch (error) {
    return 0;
  }
}

export async function getUniquePlaylistsPlayedCount(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as c FROM user_playlist_plays WHERE user_id = ?',
      [userId]
    );
    return rows[0]?.c || 0;
  } catch (error) {
    return 0;
  }
}

export async function getMaxSongPlayCount(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT MAX(play_count) as m FROM user_song_plays WHERE user_id = ?',
      [userId]
    );
    return rows[0]?.m || 0;
  } catch (error) {
    return 0;
  }
}

export async function getMaxPlaylistPlayCount(userId) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT MAX(play_count) as m FROM user_playlist_plays WHERE user_id = ?',
      [userId]
    );
    return rows[0]?.m || 0;
  } catch (error) {
    return 0;
  }
}
