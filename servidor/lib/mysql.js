import mysql from 'mysql2/promise';

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
    logMySQL('[MYSQL] Base de datos conectada correctamente');
  } catch (error) {
    console.error('[MYSQL] Error conectando a base de datos:', error.message);
    throw error;
  }
}

export async function closeConnection() {
  if (pool) {
    await pool.end();
    console.log('[MYSQL] Conexión cerrada');
  }
}