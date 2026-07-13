import mysql from 'mysql2/promise';
import { ACHIEVEMENTS_CATALOG } from './achievementsCatalog.js';

let pool;
const mysqlDebug = process.env.MYSQL_DEBUG === 'true' || process.env.DEBUG_MYSQL === 'true';

function getDbConfig() {
  return {
    host: process.env.MYSQL_HOST || '192.168.1.64',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'RexAgamEs44',
    database: process.env.MYSQL_DATABASE || 'yfitops',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

function logMySQL(...args) {
  if (mysqlDebug) console.log(...args);
}

export async function getConnection() {
  if (!pool) {
    try {
      pool = mysql.createPool(getDbConfig());
      logMySQL('[MYSQL] Pool de conexiones creado');
    } catch (error) {
      console.error('[MYSQL] Error creando pool:', error.message);
      throw error;
    }
  }
  return pool;
}

export async function initializeDatabase() {
  const connection = await getConnection();

  try {
    logMySQL('[MYSQL] Verificando conexión a base de datos...');
    // Solo verificar conexión, no crear tablas (ya existen)
    await connection.execute('SELECT 1');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bot_api_keys (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        api_key VARCHAR(128) NOT NULL UNIQUE,
        active TINYINT(1) NOT NULL DEFAULT 1,
        usage_count INT NOT NULL DEFAULT 0,
        avg_response_ms INT NOT NULL DEFAULT 0,
        last_response_ms INT NOT NULL DEFAULT 0,
        last_used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    logMySQL('[MYSQL] Tabla bot_api_keys verificada');

    await createAchievementTables(connection);
    await seedAchievements(connection);

    logMySQL('[MYSQL] Base de datos conectada correctamente');
  } catch (error) {
    console.error('[MYSQL] Error conectando a base de datos:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Tablas de logros y estadísticas por usuario. Se crean solas al
// arrancar (igual que bot_api_keys); no requieren migración de los
// usuarios ya existentes porque referencian `users.id`, que ya
// existe para todos ellos. En cuanto un usuario haga login o mande
// un heartbeat, sus filas se crean solas (upsert) en estas tablas.
// ─────────────────────────────────────────────────────────────
async function createAchievementTables(connection) {
  // Catálogo de logros (editable desde /web/achievements)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS achievements (
      id VARCHAR(64) PRIMARY KEY,
      icon VARCHAR(10) NOT NULL DEFAULT '🏅',
      title VARCHAR(255) NOT NULL,
      description VARCHAR(500) NOT NULL DEFAULT '',
      category VARCHAR(50) NOT NULL DEFAULT 'general',
      metric VARCHAR(50) NOT NULL,
      threshold INT NOT NULL DEFAULT 1,
      client_reported TINYINT(1) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  logMySQL('[MYSQL] Tabla achievements verificada');

  // Logros desbloqueados por cada usuario
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id VARCHAR(36) NOT NULL,
      achievement_id VARCHAR(64) NOT NULL,
      unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
    )
  `);
  logMySQL('[MYSQL] Tabla user_achievements verificada');

  // Totales de escucha por usuario (una fila por usuario)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS user_listening_stats (
      user_id VARCHAR(36) PRIMARY KEY,
      total_listening_seconds BIGINT NOT NULL DEFAULT 0,
      total_songs_played INT NOT NULL DEFAULT 0,
      night_seconds BIGINT NOT NULL DEFAULT 0,
      weekend_seconds BIGINT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  logMySQL('[MYSQL] Tabla user_listening_stats verificada');

  // Segundos escuchados por usuario y día (para racha y gráfica diaria)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS user_daily_listening (
      user_id VARCHAR(36) NOT NULL,
      day DATE NOT NULL,
      seconds INT NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  logMySQL('[MYSQL] Tabla user_daily_listening verificada');

  // Nº de veces que cada usuario ha reproducido cada canción
  // (se guarda título/artista "congelados" en el momento de la
  // reproducción para que la estadística sobreviva aunque la
  // canción se borre o se resuba con otro id más adelante).
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS user_song_plays (
      user_id VARCHAR(36) NOT NULL,
      song_id VARCHAR(50) NOT NULL,
      song_title VARCHAR(500) NOT NULL DEFAULT '',
      song_artist VARCHAR(255) NOT NULL DEFAULT '',
      play_count INT NOT NULL DEFAULT 0,
      last_played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, song_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  logMySQL('[MYSQL] Tabla user_song_plays verificada');

  // Nº de veces que cada usuario ha reproducido cada playlist
  // (manual o de carpeta)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS user_playlist_plays (
      user_id VARCHAR(36) NOT NULL,
      playlist_id VARCHAR(64) NOT NULL,
      playlist_type VARCHAR(10) NOT NULL DEFAULT 'manual',
      playlist_name VARCHAR(255) NOT NULL DEFAULT '',
      play_count INT NOT NULL DEFAULT 0,
      last_played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, playlist_id, playlist_type),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  logMySQL('[MYSQL] Tabla user_playlist_plays verificada');
}

// Siembra el catálogo de logros (INSERT IGNORE => idempotente:
// no pisa logros ya editados a mano desde el panel web, y permite
// añadir logros nuevos en el código en el futuro sin duplicar).
async function seedAchievements(connection) {
  try {
    for (const a of ACHIEVEMENTS_CATALOG) {
      await connection.execute(
        `INSERT IGNORE INTO achievements
          (id, icon, title, description, category, metric, threshold, client_reported, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [a.id, a.icon, a.title, a.description, a.category, a.metric, a.threshold, a.client_reported, a.sort_order]
      );
    }
    logMySQL(`[MYSQL] Catálogo de logros sembrado (${ACHIEVEMENTS_CATALOG.length} logros base)`);
  } catch (error) {
    console.error('[MYSQL] Error sembrando catálogo de logros:', error.message);
  }
}

export async function closeConnection() {
  if (pool) {
    await pool.end();
    console.log('[MYSQL] Conexión cerrada');
  }
}