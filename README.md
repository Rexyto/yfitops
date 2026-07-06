# YFitops

> Ecosistema multiplataforma de música: servidor backend, app de escritorio para Windows, panel web administrativo y bots.

---

## Índice

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Tablas de MySQL](#tablas-de-mysql)
- [Migración a MySQL](#migración-a-mysql)
- [Arranque](#arranque)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Carpeta data/](#carpeta-data)
- [App de Windows (PC)](#app-de-windows-pc)
- [APIs](#apis)
- [Seguridad](#seguridad)
- [Sincronización de carpetas](#sincronización-de-carpetas)
- [Estadísticas](#estadísticas)
- [Scripts disponibles](#scripts-disponibles)
- [Solución de problemas](#solución-de-problemas)
- [Versiones](#versiones)

---

## Resumen

- Almacena usuarios, canciones, playlists y estadísticas en **MySQL**.
- Solo persisten en disco `data/version.json` y `data/actualizacion.json`.
- JWT independiente por plataforma: `/api/`, `/pc/`, `/web/` y `X-Bot-Key` para `/bot/`.
- Panel administrativo React en `servidor/web`.
- Sincronización automática de los directorios `canciones/`, `playlist/` y `portadas/`.
- Documentación completa de todos los endpoints en [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md), en la raíz del repositorio.

---

## Requisitos

- Node.js 18+
- MySQL accesible desde el servidor
- `npm` instalado

---

## Instalación

```bash
cd servidor
npm install
npm run web:install
```

---

## Configuración

Crea `servidor/.env` con los valores de tu entorno:

```env
SERVER_PORT=6666
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=user
MYSQL_PASSWORD=password
MYSQL_DATABASE=yfitops
JWT_SECRET=yfitops_super_secret_key_2026_change_me
WEB_JWT_SECRET=yfitops_web_secret_2026_change_me
PC_JWT_SECRET=yfitops_pc_secret_2026_change_me
BOT_API_KEY=tu_clave_bot_18K2v6GlanhBaY2YVC7TMe9w50l11tYtLjHQ35
```

### Variables de entorno

| Variable | Descripción | Defecto |
|---|---|---|
| `SERVER_PORT` | Puerto de escucha del servidor | `6666` |
| `MYSQL_HOST` | Host de MySQL | — |
| `MYSQL_PORT` | Puerto de MySQL | `3306` |
| `MYSQL_USER` | Usuario de MySQL | — |
| `MYSQL_PASSWORD` | Contraseña de MySQL | — |
| `MYSQL_DATABASE` | Base de datos MySQL | — |
| `JWT_SECRET` | Secreto JWT para `/api/` (móvil) | — |
| `WEB_JWT_SECRET` | Secreto JWT para `/web/` (panel) | — |
| `PC_JWT_SECRET` | Secreto JWT para `/pc/` (Windows) | — |
| `BOT_API_KEY` | Clave legacy para `/bot/` | — |

---

## Tablas de MySQL

El servidor **no crea las tablas por ti** (salvo `bot_api_keys`, que se auto-crea al arrancar si no existe). Antes de arrancar por primera vez, crea la base de datos indicada en `MYSQL_DATABASE` y ejecuta este script para dejar el esquema listo:

> ⚠️ Este es el esquema recomendado a partir de los datos que maneja el servidor (usuarios, canciones, favoritos, playlists y estadísticas). Si tu `lib/storage.js` usa nombres de columna distintos, ajusta el script en consecuencia.

```sql
-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Canciones de la biblioteca
CREATE TABLE IF NOT EXISTS songs (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  artist VARCHAR(255) DEFAULT 'Desconocido',
  album VARCHAR(255) DEFAULT 'Desconocido',
  duration FLOAT DEFAULT 0,
  filename VARCHAR(500) NOT NULL,
  url VARCHAR(700) NOT NULL,
  cover_url VARCHAR(700) NULL,
  upload_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Favoritos por usuario (relación N:M)
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id VARCHAR(36) NOT NULL,
  song_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Canciones subidas por cada usuario ("mis canciones")
CREATE TABLE IF NOT EXISTS user_songs (
  user_id VARCHAR(36) NOT NULL,
  song_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Playlists creadas manualmente por los usuarios
CREATE TABLE IF NOT EXISTS playlists (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cover_color VARCHAR(7) DEFAULT '#1DB954',
  user_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id VARCHAR(64) NOT NULL,
  song_id VARCHAR(50) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, song_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Playlists automáticas generadas desde carpetas de playlist/
CREATE TABLE IF NOT EXISTS folder_playlists (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cover_url VARCHAR(700) NULL,
  total_duration FLOAT DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS folder_playlist_songs (
  folder_playlist_id VARCHAR(64) NOT NULL,
  song_id VARCHAR(50) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (folder_playlist_id, song_id),
  FOREIGN KEY (folder_playlist_id) REFERENCES folder_playlists(id) ON DELETE CASCADE
);

-- Estadísticas globales (una sola fila, id fijo = 1)
CREATE TABLE IF NOT EXISTS stats_summary (
  id TINYINT PRIMARY KEY DEFAULT 1,
  total_listening_seconds BIGINT NOT NULL DEFAULT 0,
  total_songs_played INT NOT NULL DEFAULT 0
);

-- Últimas muestras de latencia de conexión
CREATE TABLE IF NOT EXISTS stats_latency_samples (
  id INT AUTO_INCREMENT PRIMARY KEY,
  latency_ms INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tiempos de procesamiento de subidas
CREATE TABLE IF NOT EXISTS stats_processing_times (
  id INT AUTO_INCREMENT PRIMARY KEY,
  processing_ms INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Segundos escuchados por día
CREATE TABLE IF NOT EXISTS stats_daily_listening (
  day DATE PRIMARY KEY,
  seconds INT NOT NULL DEFAULT 0
);

-- Claves de API para bots (esta la crea el servidor solo al arrancar,
-- se incluye aquí solo como referencia de su estructura real)
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
);
```

**Resumen de tablas:**

| Tabla | Para qué sirve | ¿Se crea sola? |
|---|---|---|
| `users` | Usuarios y contraseñas hasheadas | No, crear a mano |
| `songs` | Biblioteca de canciones | No, crear a mano |
| `user_favorites` | Favoritos por usuario | No, crear a mano |
| `user_songs` | Qué canciones subió cada usuario | No, crear a mano |
| `playlists` / `playlist_songs` | Playlists manuales de cada usuario | No, crear a mano |
| `folder_playlists` / `folder_playlist_songs` | Playlists automáticas desde `playlist/` | No, crear a mano |
| `stats_summary`, `stats_latency_samples`, `stats_processing_times`, `stats_daily_listening` | Estadísticas del panel | No, crear a mano |
| `bot_api_keys` | Claves de acceso para `/bot/*` | **Sí**, el servidor la crea sola al arrancar |

---

## Migración a MySQL

Si vienes de la versión antigua basada en JSON, ejecuta:

```bash
npm run migrate
```

Migra automáticamente `data/users.json`, `data/data.json`, `data/dataplaylist.json` y `data/stats.json` a MySQL.

> Tras la migración solo se conservan en disco `data/version.json` y `data/actualizacion.json`.

---

## Arranque

**Producción**
```bash
cd servidor
npm start
```

**Desarrollo del panel web** (hot-reload)
```bash
npm run web:dev
```

El servidor queda disponible en `http://0.0.0.0:6666` o en el puerto configurado.

---

## Estructura del proyecto

Esta es la ruta real del repositorio, tal cual queda en disco:

```text
yfitops/
├── API_DOCUMENTATION.md        # Documentación detallada de todos los endpoints (ver sección APIs)
├── README.md
├── app/                        # App móvil (Android) —  Próximamente
├── servidor/                   # Backend (Node.js + Express + MySQL)
│   ├── server.js               # Punto de entrada del backend
│   ├── package.json
│   ├── package-lock.json
│   ├── env.example             # Plantilla de variables de entorno (copiar como .env)
│   ├── .env                    # Configuración de entorno real (no versionar)
│   ├── logo.png                # Logo usado por el panel web / app
│   ├── lib/
│   │   ├── config.js           # Variables de entorno y configuración
│   │   ├── auth.js             # Middlewares JWT y autenticación
│   │   ├── storage.js          # Persistencia en MySQL y JSON
│   │   ├── mysql.js            # Conexión y pool de MySQL
│   │   ├── audio.js            # Procesamiento de audio y carátulas
│   │   ├── upload.js           # Manejo de subidas
│   │   ├── startup.js          # Carga inicial de canciones
│   │   ├── watchers.js         # Sincronización de directorios
│   │   └── activeListeners.js  # Conteo de oyentes activos
│   ├── routes/
│   │   ├── api.js              # API móvil  → /api/*
│   │   ├── pc.js                # API PC     → /pc/*
│   │   ├── web.js               # API web    → /web/*
│   │   ├── bot.js               # API bot    → /bot/*
│   │   ├── global.js            # Rutas públicas /health, /status
│   │   └── index.js             # Registro de rutas
│   ├── data/
│   │   ├── version.json         # Versión de apps
│   │   └── actualizacion.json   # Changelog / notas
│   ├── canciones/                # Archivos de audio subidos
│   ├── playlist/                 # Playlists por carpeta
│   ├── portadas/                 # Carátulas .webp/.jpg subidas o recogidas manualmente para las canciones
│   ├── node_modules/              # Dependencias (no versionar)
│   └── web/                       # Panel administrativo React/Vite
│
└── yfitopspc/                   # App de escritorio para Windows (Electron), solo disponible para Windows
    ├── main.js                  # Proceso principal de Electron
    ├── preload.js               # Puente seguro entre Electron y el renderer (contextBridge)
    ├── discordRpc.js            # Discord Rich Presence ("reproduciendo ahora")
    ├── webpack.config.js        # Bundler del renderer (React)
    ├── package.json
    ├── package-lock.json
    ├── assets/                  # Iconos de la app (.ico, etc.)
    ├── public/                  # Estáticos copiados tal cual al build (logo, index.html base)
    ├── dist/                    # Build del renderer generado por webpack (no versionar)
    ├── release/                 # Instaladores/ejecutables generados (no versionar)
    ├── node_modules/            # Dependencias (no versionar)
    └── src/                     # Código fuente del renderer (React)
        ├── index.html
        ├── index.jsx            # Punto de entrada de React
        ├── App.jsx              # Componente raíz, título custom, updates, changelog
        ├── api.js               # Llamadas a la API del servidor → /pc/*
        ├── store/
        │   └── MusicStore.js    # Estado global (zustand): auth, canciones, reproductor, heartbeat, Discord RPC
        └── components/
            ├── LoginScreen.jsx
            ├── Sidebar.jsx
            ├── SongsView.jsx
            ├── FavoritesView.jsx
            ├── PlaylistsView.jsx
            ├── PlayerBar.jsx
            └── PlayerModal.jsx
```

>  **`app/` (Android):** por ahora no se sube el código fuente de la app móvil. Se documentará y publicará más adelante.

> El servidor guarda las carátulas de las canciones en `servidor/portadas/`. Es una carpeta más a tener en cuenta junto a `canciones/` y `playlist/` a la hora de hacer backups o desplegar.

---

## Carpeta `data/`

Esta carpeta se crea sola al arrancar el servidor (`fs.mkdir(DATA_DIR, { recursive: true })`), pero **los archivos de dentro no siempre se generan solos**. Aquí tienes qué meter en cada uno, qué debe contener y si lo tienes que crear tú a mano o lo hace el servidor.

| Archivo | ¿Quién lo crea? | ¿Qué debe contener? |
|---|---|---|
| `version.json` | **Tú, a mano** (el servidor no rellena valores reales por ti) | JSON con la versión actual de cada plataforma y el link de descarga. Ejemplo: `{"version": "2.0.0", "apkUrl": "", "pc": {"version": "1.0.0", "exeUrl": ""}}`. Rellena `apkUrl` y `exeUrl` con las URLs reales del APK/EXE cuando los tengas subidos. |
| `actualizacion.json` | **Tú, a mano** | Notas de la versión (changelog) que se muestran al actualizar la app. Debe tener `version`, `notes` (texto con saltos de línea `\n` para cada punto) y opcionalmente `pc.version` / `pc.notes` para el changelog de la app de Windows. |
| `users.json` | **Solo si migras** desde la versión antigua basada en JSON | Array de usuarios: `username`, `password` (hash), `id`, `favorites` (array de IDs) y `songs` (array de IDs). Tras ejecutar `npm run migrate` este archivo ya no hace falta, los usuarios pasan a estar en MySQL. Si arrancas de cero (sin migración), **no hace falta crearlo**: los usuarios se gestionan directamente en MySQL desde el primer momento. |
| `data.json` | **Solo si migras** | Objeto con `songs` (array de canciones con `id`, `title`, `artist`, `album`, `duration`, `filename`, `url`, `coverUrl`, `uploadDate`), `playlists` (array, puede ir vacío `[]`) y `favorites`. Igual que `users.json`, solo es necesario para `npm run migrate`; en una instalación nueva no hay que crearlo. |
| `dataplaylist.json` | **Solo si migras** | Datos de las playlists automáticas generadas a partir de las carpetas dentro de `playlist/`. Tampoco hace falta crearlo a mano en una instalación nueva: se reconstruye solo al sincronizar `playlist/` (`syncPlaylistDir`). |
| `stats.json` | **Solo si migras** | Estadísticas antiguas: `totalListeningSeconds`, `totalSongsPlayed`, `latencySamples` (array), `processingTimes` (array) y `dailyListening` (objeto `fecha: segundos`). En una instalación nueva no es necesario, las estadísticas se guardan en MySQL desde el arranque. |

**Resumen rápido:**
- Instalación **nueva** (sin datos previos): solo necesitas crear `version.json` y `actualizacion.json` a mano antes de arrancar. Todo lo demás (usuarios, canciones, playlists, estadísticas) vive en MySQL y se gestiona solo.
- Instalación que **viene de una versión vieja en JSON**: coloca los 4 archivos legacy (`users.json`, `data.json`, `dataplaylist.json`, `stats.json`) en `data/` junto a `version.json` y `actualizacion.json`, y luego ejecuta `npm run migrate`. Una vez migrados, puedes borrar los 4 archivos legacy; ya no se vuelven a leer.

---

## App de Windows (PC)

>  Solo disponible para **Windows**.

La app de escritorio (`yfitopspc/`) es una aplicación **Electron + React** que vive justo al lado de `servidor/`, dentro de la misma ruta del proyecto. Se conecta al backend a través de las rutas `/pc/*` documentadas en [APIs](#apis).

### Requisitos

- Node.js 18+
- Windows 10/11 (target de compilación)

### Instalación y arranque en desarrollo

```bash
cd yfitopspc
npm install
npm run start      # o el script equivalente de tu package.json (dev con webpack + electron)
```

### Build / generar instalador

El build del renderer se genera con `webpack.config.js` hacia `dist/`, y el empaquetado final del `.exe`/instalador se genera en `release/` (normalmente vía `electron-builder` o similar, según lo que tengas configurado en `package.json`).

```bash
npm run build       # compila el renderer (React) a dist/
npm run dist        # empaqueta el ejecutable/instalador en release/
```

> Los nombres exactos de estos scripts dependen de lo que tengas definido en `yfitopspc/package.json`; ajusta los comandos según corresponda.

### Piezas clave

| Archivo/carpeta | Función |
|---|---|
| `main.js` | Proceso principal de Electron: crea la ventana (frameless, sin barra de título nativa), gestiona minimizar/maximizar/cerrar, persiste la sesión en disco (`session.json` dentro de `userData`) y expone los handlers IPC. |
| `preload.js` | Puente seguro (`contextBridge`) entre el proceso principal y el renderer: expone `window.electronAPI` con controles de ventana, sesión y Discord RPC. |
| `discordRpc.js` | Integración con Discord Rich Presence: muestra la canción que estás escuchando en tu perfil de Discord. |
| `src/api.js` | Cliente HTTP hacia el backend, todo apuntando a `/pc/*` (login, canciones, favoritos, playlists, heartbeat, latencia, estado). |
| `src/store/MusicStore.js` | Estado global de la app (zustand): sesión, reproductor de audio, cola de reproducción, favoritos, heartbeat cada 30s y sincronización con Discord RPC. |
| `src/components/` | Vistas y componentes de la interfaz: login, sidebar, biblioteca, favoritos, colecciones, barra y modal del reproductor. |

### Notas de la app de PC

- La sesión se guarda cifrada... bueno, en texto plano en `session.json` dentro de la carpeta `userData` de Electron; al abrir la app se valida el token contra `/pc/verify` y si no es válido se limpia sola.
- El changelog que se ve al actualizar sale de `/pc/changelog`, que a su vez lee `data/actualizacion.json` → campo `pc` en el servidor.
- La comprobación de versión (`/pc/version`) actualmente **no bloquea** el uso de la app si la versión local y la del servidor no coinciden; solo lo haría si se reactiva el bloqueo comentado en `App.jsx`.

---

## APIs

La documentación completa de cada endpoint, con parámetros, cuerpos de petición y ejemplos de respuesta, está en [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

| Prefijo | Plataforma | Autenticación | Duración de sesión |
|---|---|---|---|
| `/api/` | Android | Bearer token | 30 días |
| `/pc/` | Windows | Bearer token | 30 días |
| `/web/` | Panel admin | Cookie JWT | 3 días |
| `/bot/` | Bots | API key | — |

### Flujo de autenticación

1. El cliente envía credenciales al endpoint de login de su plataforma.
2. El servidor verifica el hash de la contraseña.
3. El servidor emite un JWT (o cookie `web_token` para el panel web).
4. El cliente incluye el token en cada petición: `Authorization: Bearer <token>`.
5. El middleware valida el token antes de ejecutar el handler.

---

## Seguridad

- Contraseñas hasheadas con SHA-256 + salt.
- Tokens JWT con expiración configurable.
- CORS habilitado para múltiples orígenes.
- Validación de tipo y tamaño de archivo en subidas.
- Middlewares de autenticación en todas las rutas protegidas.
- Acceso al panel web restringido a rol `superadmin`.

---

## Sincronización de carpetas

El servidor vigila automáticamente `/playlist/` y `/canciones/`. Cualquier cambio se detecta en tiempo real sin necesidad de reiniciar.

Para forzar una sincronización manual desde el cliente:

```http
POST /api/sync
```

---

## Estadísticas

El servidor registra automáticamente por usuario:

- Total de horas escuchadas
- Total de canciones reproducidas
- Latencia promedio de conexión
- Tiempo de procesamiento de subidas
- Escuchas diarias

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm start` | Inicia el servidor en modo producción |
| `npm run dev` | Desarrollo con nodemon (reinicio automático) |
| `npm run validate` | Valida la configuración del entorno |
| `npm run migrate` | Migra datos JSON heredados a MySQL |
| `npm run web:install` | Instala dependencias del panel web |
| `npm run web:dev` | Panel web en modo desarrollo con hot-reload |
| `npm run web:build` | Build del panel web para producción |

---

## Solución de problemas

**El servidor no inicia**

```bash
npm install         # Verificar dependencias
npm run validate    # Validar configuración
# Asegurarse de que el puerto 6666 esté disponible
```

**Errores de autenticación**

- Verificar que el token no haya expirado.
- Comprobar que el header sea exactamente `Authorization: Bearer <token>`.
- Para el panel web, verificar que la cookie `web_token` sea válida.

**Las canciones no se sincronizan**

```bash
# Forzar sincronización manual
POST /api/sync
```

---

## Versiones

| Componente | Versión |
|---|---|
| Servidor | 2.0.0 |
| API Móvil | 2.0.0 |
| API PC | 1.0.0 |
| Web | 2.0.0 |

---

## Licencia

Privada — YFitops 2026

*Última actualización: 6 de julio de 2026*