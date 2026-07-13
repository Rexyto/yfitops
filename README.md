# YFitops

> Ecosistema multiplataforma de música: servidor backend, app de escritorio para Windows y Linux, app móvil para Android, para televisores Samsung Smart TV, panel web administrativo y bots.

---

## Índice

- [Resumen](#resumen)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Tablas de MySQL](#tablas-de-mysql)
- [Migración a MySQL](#migración-a-mysql)
- [Arranque](#arranque)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Carpeta data/](#carpeta-data)
- [App de escritorio (Windows y Linux)](#app-de-escritorio-windows-y-linux)
- [App de Samsung TV Tizen](#app-de-samsung-tv-tizen)
- [App móvil (Android)](#app-móvil-android)
- [APIs](#apis)
- [Logros y estadísticas por usuario](#logros-y-estadísticas-por-usuario)
- [Protección anti-spam / rate limiting](#protección-anti-spam--rate-limiting)
- [Seguridad](#seguridad)
- [Sincronización de carpetas](#sincronización-de-carpetas)
- [Canciones, portadas y playlists](#canciones-portadas-y-playlists)
- [Estadísticas](#estadísticas)
- [Scripts disponibles](#scripts-disponibles)
- [Solución de problemas](#solución-de-problemas)
- [Licencia](#licencia)

---

## Resumen

- Almacena usuarios, canciones, playlists y estadísticas en **MySQL**.
- Solo persisten en disco `data/version.json` y `data/actualizacion.json`.
- JWT independiente por plataforma: `/api/`, `/pc/`, `/web/` y `X-Bot-Key` para `/bot/`.
- Sistema de **logros** (100 de base, ampliables desde el panel web) y **estadísticas reales por usuario** (horas escuchadas, racha, canción/playlist más escuchada). Ver [Logros y estadísticas por usuario](#logros-y-estadísticas-por-usuario).
- **Rate limiting** con baneo progresivo en todas las APIs, sin penalizar el uso normal (cambios de canción rápidos, etc.). Ver [Protección anti-spam / rate limiting](#protección-anti-spam--rate-limiting).
- Panel administrativo React en `servidor/web`.
- Sincronización automática de los directorios `canciones/`, `playlist/` y `portadas/`.
- Documentación completa de todos los endpoints en [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md), en la raíz del repositorio. El detalle de logros, estadísticas por usuario y rate limiting está en este mismo README, en las secciones [Logros y estadísticas por usuario](#logros-y-estadísticas-por-usuario) y [Protección anti-spam / rate limiting](#protección-anti-spam--rate-limiting).

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

El servidor **no crea todas las tablas por ti**. Se dividen en dos grupos:

- **Tablas principales** (usuarios, canciones, playlists, estadísticas globales): hay que crearlas a mano antes del primer arranque, con el script de más abajo.
- **Tablas de `bot_api_keys`, logros y estadísticas por usuario**: se crean **solas** al arrancar el servidor (`initializeDatabase()` en `lib/mysql.js`), no hay que tocar nada.

> Si tu `lib/storage.js` usa nombres de columna distintos a los de aquí abajo, ajusta el script en consecuencia.

<details>
<summary><strong>Ver script SQL — tablas principales (crear a mano)</strong></summary>

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

-- Segundos escuchados por día (global, todos los usuarios sumados)
CREATE TABLE IF NOT EXISTS stats_daily_listening (
  day DATE PRIMARY KEY,
  seconds INT NOT NULL DEFAULT 0
);
```

</details>

<details>
<summary><strong>Ver script SQL — logros y estadísticas por usuario (se crean solas, solo de referencia)</strong></summary>

```sql
-- Claves de API para bots (se crea sola al arrancar)
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

-- Catálogo de logros (editable desde /web/achievements). Se siembra sola
-- con 100 logros base la primera vez que arranca el servidor.
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(64) PRIMARY KEY,
  icon VARCHAR(10) NOT NULL DEFAULT '',
  title VARCHAR(255) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  metric VARCHAR(50) NOT NULL,
  threshold INT NOT NULL DEFAULT 1,
  client_reported TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Qué logros ha desbloqueado cada usuario y cuándo
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id VARCHAR(36) NOT NULL,
  achievement_id VARCHAR(64) NOT NULL,
  unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

-- Totales acumulados de escucha por usuario (una fila por usuario)
CREATE TABLE IF NOT EXISTS user_listening_stats (
  user_id VARCHAR(36) PRIMARY KEY,
  total_listening_seconds BIGINT NOT NULL DEFAULT 0,
  total_songs_played INT NOT NULL DEFAULT 0,
  night_seconds BIGINT NOT NULL DEFAULT 0,
  weekend_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Segundos escuchados por usuario y día (racha + gráfica diaria personal)
CREATE TABLE IF NOT EXISTS user_daily_listening (
  user_id VARCHAR(36) NOT NULL,
  day DATE NOT NULL,
  seconds INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Nº de veces que cada usuario ha reproducido cada canción (con snapshot
-- de título/artista para que la estadística sobreviva a borrados)
CREATE TABLE IF NOT EXISTS user_song_plays (
  user_id VARCHAR(36) NOT NULL,
  song_id VARCHAR(50) NOT NULL,
  song_title VARCHAR(500) NOT NULL DEFAULT '',
  song_artist VARCHAR(255) NOT NULL DEFAULT '',
  play_count INT NOT NULL DEFAULT 0,
  last_played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Nº de veces que cada usuario ha reproducido cada playlist (manual o de carpeta)
CREATE TABLE IF NOT EXISTS user_playlist_plays (
  user_id VARCHAR(36) NOT NULL,
  playlist_id VARCHAR(64) NOT NULL,
  playlist_type VARCHAR(10) NOT NULL DEFAULT 'manual', -- 'manual' | 'folder'
  playlist_name VARCHAR(255) NOT NULL DEFAULT '',
  play_count INT NOT NULL DEFAULT 0,
  last_played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, playlist_id, playlist_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

</details>

**Resumen de tablas:**

| Tabla | Para qué sirve | ¿Se crea sola? |
|---|---|---|
| `users` | Usuarios y contraseñas hasheadas | No, crear a mano |
| `songs` | Biblioteca de canciones | No, crear a mano |
| `user_favorites` | Favoritos por usuario | No, crear a mano |
| `user_songs` | Qué canciones subió cada usuario | No, crear a mano |
| `playlists` / `playlist_songs` | Playlists manuales de cada usuario | No, crear a mano |
| `folder_playlists` / `folder_playlist_songs` | Playlists automáticas desde `playlist/` | No, crear a mano |
| `stats_summary`, `stats_latency_samples`, `stats_processing_times`, `stats_daily_listening` | Estadísticas globales del panel | No, crear a mano |
| `bot_api_keys` | Claves de acceso para `/bot/*` | **Sí** |
| `achievements` | Catálogo de logros (editable desde el panel web) | **Sí**, y se siembra con 100 logros base |
| `user_achievements` | Logros desbloqueados por cada usuario | **Sí** |
| `user_listening_stats` | Totales de escucha por usuario (horas, canciones, noche, fin de semana) | **Sí** |
| `user_daily_listening` | Segundos escuchados por usuario y día (racha) | **Sí** |
| `user_song_plays` | Reproducciones por usuario y canción (canción más escuchada) | **Sí** |
| `user_playlist_plays` | Reproducciones por usuario y playlist (playlist más escuchada) | **Sí** |

No hace falta migrar nada para vincular a los usuarios ya existentes con las tablas nuevas: todas usan `user_id` con `FOREIGN KEY` a `users(id)`, la misma clave primaria que ya tienen. Las filas se crean solas (upsert) en cuanto ese usuario hace login o manda su primer heartbeat. Detalle completo en [Logros y estadísticas por usuario](#logros-y-estadísticas-por-usuario).

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
├── yfitops-android/                         # App móvil (Android/iOS) — Expo + React Native
│   ├── App.js                   # Componente raíz: sesión, splash, modal de novedades/actualización
│   ├── app.json                 # Configuración de Expo (nombre, iconos, permisos, plugins)
│   ├── eas.json                 # Perfiles de build de EAS (development/preview/production)
│   ├── package.json
│   ├── package-lock.json
│   ├── .env                     # EXPO_PUBLIC_SERVER_URL y secretos locales (no versionar)
│   ├── assets/                  # icon.png, splash.png, adaptive-icon.png, favicon.png
│   ├── plugins/
│   │   └── withMusicForegroundService.js   # Config plugin: servicio en primer plano + botón de medios en Android
│   └── src/
│       ├── theme.js             # Los 11 temas de color (mismos que la app de PC) + contexto
│       ├── i18n/
│       │   ├── translations.js  # Textos ES/EN de toda la interfaz
│       │   └── index.js         # Hook useT()
│       ├── context/
│       │   ├── MusicContext.js    # Estado global: sesión, biblioteca, reproductor (expo-av), notificación, heartbeat
│       │   └── SettingsContext.js # Tema, idioma, foto de perfil, conectividad, descargas offline y caché
│       ├── screens/
│       │   ├── LoginScreen.js
│       │   ├── MainScreen.js      # Tab bar: Inicio, Favoritos, Colecciones, Ajustes
│       │   ├── SongsScreen.js
│       │   ├── FavoritesScreen.js
│       │   ├── PlaylistsScreen.js
│       │   └── SettingsScreen.js  # Perfil, apariencia, descargas offline, almacenamiento, créditos, versión
│       └── components/
│           ├── Icon.js            # Iconos por emoji/texto (sin dependencias nativas de iconografía)
│           ├── MarqueeText.js
│           ├── PlayerBar.js
│           ├── PlayerModal.js
│           └── SongItem.js
│
├── servidor/                   # Backend (Node.js + Express + MySQL)
│   ├── server.js               # Punto de entrada del backend (monta rate limiting + rutas)
│   ├── package.json
│   ├── package-lock.json
│   ├── env.example             # Plantilla de variables de entorno (copiar como .env)
│   ├── .env                    # Configuración de entorno real (no versionar)
│   ├── logo.png                # Logo usado por el panel web / app
│   ├── lib/
│   │   ├── config.js           # Variables de entorno y configuración
│   │   ├── auth.js             # Middlewares JWT y autenticación
│   │   ├── storage.js          # Persistencia en MySQL y JSON
│   │   ├── mysql.js            # Conexión, pool de MySQL, creación de tablas y siembra del catálogo de logros
│   │   ├── audio.js            # Procesamiento de audio y carátulas
│   │   ├── upload.js           # Manejo de subidas
│   │   ├── startup.js          # Carga inicial de canciones
│   │   ├── watchers.js         # Sincronización de directorios
│   │   ├── activeListeners.js  # Conteo de oyentes activos
│   │   ├── achievementsCatalog.js # Genera el catálogo de 100 logros base (semilla de la tabla `achievements`)
│   │   ├── achievements.js     # Motor de logros: catálogo, métricas por usuario, evaluación y CRUD admin
│   │   ├── userStats.js        # Estadísticas de escucha por usuario (horas, racha, más escuchado...)
│   │   └── rateLimit.js        # Limitadores anti-spam y baneo progresivo (ver Protección anti-spam)
│   ├── routes/
│   │   ├── api.js              # API móvil  → /api/*  (incluye logros y estadísticas personales)
│   │   ├── pc.js                # API PC     → /pc/*  (incluye logros y estadísticas personales)
│   │   ├── web.js               # API web    → /web/* (incluye CRUD de logros y stats de usuario para admin)
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
│   └── web/                       # Panel administrativo React/Vite (incluye gestión de logros en /achievements)
│
├── yfitopspc/                   # App de escritorio Electron — genera tanto el instalador de Windows como el binario de Linux
│   ├── main.js                  # Proceso principal de Electron
│   ├── preload.js               # Puente seguro entre Electron y el renderer (contextBridge)
│   ├── discordRpc.js            # Discord Rich Presence ("reproduciendo ahora")
│   ├── localData.js             # Datos solo-locales: foto de perfil, canciones/playlists descargadas, caché
│   ├── autostart.js             # Inicio automático con el sistema (Windows/macOS nativo, Linux vía .desktop)
│   ├── webpack.config.js        # Bundler del renderer (React)
│   ├── package.json
│   ├── package-lock.json
│   ├── assets/                  # Iconos de la app (.ico, etc.)
│   ├── public/                  # Estáticos copiados tal cual al build (logo, index.html base)
│   ├── dist/                    # Build del renderer generado por webpack (no versionar)
│   ├── release/                 # Instaladores/ejecutables generados (no versionar)
│   ├── node_modules/            # Dependencias (no versionar)
│   └── src/                     # Código fuente del renderer (React)
│       ├── index.html           # Variables CSS de los 11 temas de color
│       ├── index.jsx             # Punto de entrada de React
│       ├── App.jsx               # Componente raíz, título custom, updates, changelog, aviso sin conexión, toasts de logros y de aviso de rate limit
│       ├── api.js                # Llamadas a la API del servidor → /pc/* (incluye logros y estadísticas)
│       ├── i18n/
│       │   ├── translations.js  # Textos ES/EN de toda la interfaz (incluye logros/estadísticas)
│       │   └── index.js         # Hook useT()
│       ├── store/
│       │   ├── MusicStore.js    # Estado global (zustand): auth, canciones, reproductor, heartbeat con contexto de playlist, logros/estadísticas, Discord RPC
│       │   └── SettingsStore.js # Tema, idioma, foto de perfil, conectividad, descargas offline, autoarranque, reclamo del logro "Modo Avión"
│       └── components/
│           ├── LoginScreen.jsx
│           ├── Sidebar.jsx
│           ├── SongsView.jsx
│           ├── FavoritesView.jsx
│           ├── PlaylistsView.jsx
│           ├── SettingsView.jsx # Perfil, apariencia (11 temas), idioma, descargas offline, caché, créditos, versión
│           ├── PlayerBar.jsx
│           ├── PlayerModal.jsx
│           ├── QueueView.jsx
│           ├── ProfileView.jsx     # Perfil, estadísticas reales y catálogo de logros (100% dinámico, viene del servidor)
│           ├── AchievementToast.jsx # Notificación emergente al desbloquear un logro nuevo
│           └── RateLimitWarningToast.jsx # Aviso amistoso cuando el servidor detecta que se están mandando peticiones muy seguido
│
└── yfitops-samsungtv/            # App para Samsung Smart TV (Tizen)
    ├── config.xml                # Manifiesto del widget Tizen (versión, permisos, orientación, feature de pantalla 1920x1080)
    ├── webpack.config.js         # Bundler (target 'web', Babel con preset-env apuntado a Chrome 56 — motor real de Tizen 4.x)
    ├── package.json
    ├── package-lock.json
    ├── .gitignore
    ├── public/
    │   └── logo.png              # Única fuente del logo: también genera icon.png del paquete .wgt
    └── src/                      # Código fuente del renderer (React), sin proceso Node/Electron
        ├── index.html            # Variables CSS de los 11 temas de color + tamaños de fuente "10 pies" (sofá)
        ├── index.jsx             # Punto de entrada de React: instala captura de consola y bridge antes de montar
        ├── App.jsx               # Componente raíz, versión fija de la app, changelog, aviso sin conexión
        ├── api.js                # Llamadas a la API del servidor → /pc/* (comparte backend con la app de PC)
        ├── i18n/
        │   ├── translations.js   # Textos ES/EN de toda la interfaz (+ nombres de los 11 temas)
        │   └── index.js          # Hook useT()
        ├── store/
        │   ├── MusicStore.js     # Estado global (zustand): auth, canciones, reproductor, cola, heartbeat
        │   └── SettingsStore.js  # Tema (11 disponibles), idioma, foto de perfil, conectividad
        ├── tv/                   # Todo lo específico de "vivir dentro de una TV con mando"
        │   ├── tvBridge.js       # window.electronAPI simulado con localStorage (sesión, versión, foto de perfil)
        │   ├── tvNavigation.js   # Navegación espacial con flechas/OK/Atrás del mando + teclas de multimedia
        │   ├── backStack.js      # Pila de "capas" (modales/paneles) que la tecla Atrás va cerrando una a una
        │   ├── ErrorBoundary.jsx # Pantalla de error a pantalla completa en vez de quedarse en negro
        │   ├── logger.js         # Registro de logs/errores en memoria + localStorage (Ajustes → Registro)
        │   └── format.js         # Utilidades de formato de tiempo (sin padStart, no existe en Chromium 56)
        └── components/
            ├── LoginScreen.jsx
            ├── Sidebar.jsx
            ├── SongsView.jsx
            ├── FavoritesView.jsx
            ├── PlaylistsView.jsx   # Tarjetas con flexbox (no CSS grid) por compatibilidad con Tizen 4.x
            ├── SettingsView.jsx    # Perfil, apariencia (11 temas), idioma, registro de logs, créditos, versión
            ├── PlayerBar.jsx
            ├── PlayerModal.jsx
            ├── QueueView.jsx
            └── LogsModal.jsx       # Visor del registro de logs (Ajustes → Registro)
```

> El servidor guarda las carátulas de las canciones en `servidor/portadas/`. Es una carpeta más a tener en cuenta junto a `canciones/` y `playlist/` a la hora de hacer backups o desplegar.
>
> Nota: los logros y estadísticas reales (backend + `ProfileView.jsx`/`AchievementToast.jsx`) están implementados en **servidor** y en la **app de PC**. La app móvil (Android) y la de Samsung TV todavía no consumen estos endpoints nuevos, usan las rutas `/api/*` y `/pc/*` de siempre, así que seguirán funcionando igual, simplemente no muestran logros/estadísticas por ahora.

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
- Instalación **nueva** (sin datos previos): solo necesitas crear `version.json` y `actualizacion.json` a mano antes de arrancar. Todo lo demás (usuarios, canciones, playlists, estadísticas, logros) vive en MySQL y se gestiona solo.
- Instalación que **viene de una versión vieja en JSON**: coloca los 4 archivos legacy (`users.json`, `data.json`, `dataplaylist.json`, `stats.json`) en `data/` junto a `version.json` y `actualizacion.json`, y luego ejecuta `npm run migrate`. Una vez migrados, puedes borrar los 4 archivos legacy; ya no se vuelven a leer. Las tablas de logros/estadísticas por usuario no forman parte de esta migración: se rellenan solas a partir de ese momento, según los usuarios vayan usando la app (ver [Logros y estadísticas por usuario](#logros-y-estadísticas-por-usuario)).

---

## App de escritorio (Windows y Linux)

La app de escritorio (`yfitopspc/`) es una aplicación **Electron + React** que vive justo al lado de `servidor/`, dentro de la misma ruta del proyecto. Se conecta al backend a través de las rutas `/pc/*` documentadas en [APIs](#apis).

Electron es multiplataforma: el mismo `src/`, `main.js`, `preload.js` y `discordRpc.js` funcionan igual en Windows y en Linux. Lo único que cambia es **cómo se empaqueta** el resultado final (`.exe`/instalador para Windows, `AppImage`/`.deb` para Linux), no el código fuente. Por eso no se crea una carpeta `yfitopslinux/` aparte: todo sigue viviendo en `yfitopspc/`.

### Requisitos

- Node.js 18+
- Para compilar el `.exe`: Windows 10/11.
- Para compilar el binario de Linux: una máquina/VM/WSL2 con Linux (ver el porqué más abajo).

### Instalación y arranque en desarrollo

```bash
cd yfitopspc
npm install
npm run start      # o el script equivalente de tu package.json (dev con webpack + electron)
```

### Configurar los targets de build (una sola vez)

`electron-builder` (o el bundler que tengas en `release/`) soporta definir varios targets en el mismo `package.json`, sin tocar el código:

```json
"build": {
  "appId": "com.yfitops.app",
  "productName": "YFitops",
  "files": ["dist/**/*", "main.js", "preload.js", "discordRpc.js"],
  "win": {
    "target": "nsis",
    "icon": "assets/icon.ico"
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "icon": "assets/icon.png",
    "category": "Music"
  }
}
```

> Necesitas un icono `.png` (512x512 recomendado) además del `.ico`; Linux no usa `.ico`.

### Compilar el `.exe` (Windows)

```bash
cd yfitopspc
npm run build                     # compila el renderer (React) a dist/
npx electron-builder --win        # genera el instalador en release/
```

### Compilar para Linux, paso a paso

`electron-builder` puede intentar generar el paquete de Linux desde Windows, pero en la práctica falla bastante (dependencias nativas como `fpm`, permisos de symlink, etc.). Lo fiable es compilar **desde una máquina Linux** (nativa, VM o WSL2), apuntando a la misma carpeta `yfitopspc/` del proyecto (por ejemplo, vía un recurso compartido de red, `git clone`, o copiando la carpeta):

1. **Entra a una máquina/VM/WSL2 con Linux** y sitúate en la carpeta del proyecto:
   ```bash
   cd yfitopspc
   ```

2. **Instala Node.js 18+** si no lo tienes (ejemplo con `nvm`):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   ```

3. **Instala las dependencias nativas que pide `electron-builder` para empaquetar Linux** (Debian/Ubuntu):
   ```bash
   sudo apt update
   sudo apt install -y build-essential fakeroot rpm
   ```
   (`fakeroot` hace falta para el target `deb`; `rpm` solo si además vas a generar target `.rpm`.)

4. **Instala las dependencias del proyecto** (igual que en Windows, pero aquí se compilan los módulos nativos para Linux):
   ```bash
   npm install
   ```

5. **Compila el renderer** (React → `dist/`):
   ```bash
   npm run build
   ```

6. **Genera el paquete de Linux**:
   ```bash
   npx electron-builder --linux AppImage deb
   ```
   Esto deja los ficheros generados en `release/`, por ejemplo:
   ```text
   release/
   ├── YFitops-2.0.0.AppImage
   └── yfitops_2.0.0_amd64.deb
   ```

7. **(Opcional) Compilar también el `.exe` desde la misma máquina Linux** con Wine, si quieres tener ambos binarios en un solo paso:
   ```bash
   sudo apt install -y wine
   npx electron-builder --win --linux
   ```

> Si usas GitHub Actions o similar, lo más cómodo es tener un job con runner `ubuntu-latest` que compile el target Linux y otro con `windows-latest` que compile el `.exe`, ambos apuntando al mismo `yfitopspc/`.

### Instalar el binario en Linux

**AppImage** (no necesita instalación, es un ejecutable portable):
```bash
chmod +x YFitops-2.0.0.AppImage
./YFitops-2.0.0.AppImage
```
Si quieres que aparezca en el menú de aplicaciones con icono, usa una herramienta como [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) (lo integra automáticamente al primer doble clic).

**Paquete .deb** (Debian, Ubuntu y derivados):
```bash
sudo dpkg -i yfitops_2.0.0_amd64.deb
# Si faltan dependencias:
sudo apt install -f
```
Una vez instalado, la app queda disponible en el menú de aplicaciones como cualquier otro programa, y se puede desinstalar con:
```bash
sudo apt remove yfitops
```

### Cosas a revisar al pasar la app a Linux

- **Ventana sin marco (`frame: false`)**: funciona en Linux, pero el arrastre de la ventana puede comportarse algo distinto según el gestor de ventanas (GNOME/KDE, X11/Wayland) — conviene probarlo visualmente.
- **Discord Rich Presence**: `@xhayper/discord-rpc` gestiona el socket IPC de Linux (`~/.config/discord-ipc-0`) automáticamente, no requiere cambios en `discordRpc.js`.
- **Sesión persistida** (`app.getPath('userData')` en `main.js`): es multiplataforma, en Linux guarda el `session.json` normalmente en `~/.config/YFitops/`.
- **Permisos de audio**: el `setPermissionRequestHandler` de `main.js` ya autoriza `media`, no hace falta tocar nada para reproducir audio en Linux.

### Piezas clave

| Archivo/carpeta | Función |
|---|---|
| `main.js` | Proceso principal de Electron: crea la ventana (frameless, sin barra de título nativa), gestiona minimizar/maximizar/cerrar, persiste la sesión en disco (`session.json` dentro de `userData`) y expone los handlers IPC. |
| `preload.js` | Puente seguro (`contextBridge`) entre el proceso principal y el renderer: expone `window.electronAPI` con controles de ventana, sesión, Discord RPC, foto de perfil, descargas offline, caché y autoarranque. |
| `discordRpc.js` | Integración con Discord Rich Presence: muestra la canción que estás escuchando en tu perfil de Discord. |
| `localData.js` | Todo lo que vive solo en el dispositivo: foto de perfil (nunca se sube al servidor), canciones y metadatos de playlists descargadas para offline, y gestión de esa caché. |
| `autostart.js` | Registra o quita la app del arranque del sistema operativo (API nativa de Electron en Windows/macOS; archivo `.desktop` en `~/.config/autostart` en Linux). Activado por defecto la primera vez. |
| `src/api.js` | Cliente HTTP hacia el backend, todo apuntando a `/pc/*` (login, canciones, favoritos, playlists, heartbeat con contexto de playlist, latencia, estado, logros y estadísticas personales). |
| `src/i18n/` | Diccionario de textos ES/EN y hook `useT()` para toda la interfaz (nombres de canciones/playlists nunca se traducen; los títulos/descripciones de los logros tampoco, porque vienen tal cual del servidor). |
| `src/store/MusicStore.js` | Estado global de la app (zustand): sesión, reproductor de audio (con reproducción desde disco si la canción está descargada), cola de reproducción, favoritos, heartbeat cada 30s (con el contexto de playlist activo) y sincronización con Discord RPC. También guarda el catálogo de logros y las estadísticas del usuario, gestiona la cola de notificaciones de logros recién desbloqueados y el aviso de rate limit, y evita mandar un heartbeat duplicado al cambiar de canción. |
| `src/store/SettingsStore.js` | Tema (11 colores), idioma, foto de perfil, conectividad, descargas offline/caché y autoarranque. Al completar una descarga offline reclama el logro "Modo Avión" en el servidor. |
| `src/components/` | Vistas y componentes de la interfaz: login, sidebar, biblioteca, favoritos, colecciones, ajustes, barra y modal del reproductor, cola de reproducción, perfil (estadísticas + logros reales), el toast de logro desbloqueado y el aviso de rate limit. |

### Notas de la app de escritorio

- La sesión se guarda cifrada... bueno, en texto plano en `session.json` dentro de la carpeta `userData` de Electron; al abrir la app se valida el token contra `/pc/verify` y si no es válido se limpia sola.
- El changelog que se ve al actualizar sale de `/pc/changelog`, que a su vez lee `data/actualizacion.json` → campo `pc` en el servidor.
- La comprobación de versión (`/pc/version`) actualmente **no bloquea** el uso de la app si la versión local y la del servidor no coinciden; solo lo haría si se reactiva el bloqueo comentado en `App.jsx`.
- La foto de perfil, las descargas offline y el idioma/tema elegidos son **solo locales**: viven en `userData` (Electron) o `localStorage`, nunca se sincronizan con el servidor ni con otros dispositivos.
- El indicador de "sin conexión" usa los eventos `online`/`offline` del navegador (Chromium embebido), sin necesidad de hacer polling al servidor.
- Los **logros y estadísticas** (pestaña Perfil) sí se sincronizan con el servidor — es la única sección de esta lista que no es solo-local. Ver [Logros y estadísticas por usuario](#logros-y-estadísticas-por-usuario).

---

## App de Samsung TV (Tizen)

La app de Samsung Smart TV (`yfitops-samsungtv/`) es un puerto de la app de escritorio adaptado a **Tizen** (el sistema de las Smart TV de Samsung). A diferencia de `yfitopspc/`, aquí **no hay Electron ni proceso Node**: es una app web pura (React + webpack) que corre dentro del navegador Tizen integrado en la TV, empaquetada como `.wgt`. Se conecta al mismo backend, por las mismas rutas `/pc/*`.

Probado sobre una Samsung serie N de 2018 (`required_version="4.0"` en `config.xml`); para modelos más nuevos con Tizen 5.5/6.0 no debería hacer falta tocar nada.

### Diferencias respecto a `yfitopspc/`

No tiene sentido llevar 1:1 todo lo de la app de PC a una TV, así que en `yfitops-samsungtv/` se ha quitado:

- **Discord Rich Presence** (`discordRpc.js` no existe en esta versión).
- **Inicio automático con el sistema** (una Smart TV no tiene "inicio de sesión de SO" al que engancharse).
- **Descargas para escuchar sin conexión**: se asume que la TV siempre está conectada por red, así que siempre reproduce en streaming.
- **Barra de título / minimizar / maximizar / cerrar**: las apps de Tizen TV van siempre a pantalla completa.

Y se ha añadido:

- **Navegación espacial con el mando** (`tv/tvNavigation.js`): las flechas mueven el foco entre botones, filas de canciones, tarjetas, etc.; "OK/Enter" activa lo enfocado.
- **Tecla Atrás/Volver del mando** (`tv/backStack.js`): cierra el reproductor grande, la cola o el editor de canción, o vuelve de una colección a la lista; si no hay nada abierto, cierra la app.
- **Botones multimedia del mando** (play/pausa/siguiente/anterior, si el mando los tiene), enganchados directamente a la reproducción.
- **`tv/tvBridge.js`**: sustituye a `window.electronAPI` (que en PC expone `preload.js`) por una versión que guarda sesión y foto de perfil en `localStorage` en vez de en disco, ya que aquí no hay proceso Electron que escriba archivos.

> Todavía no incorpora la pestaña de logros/estadísticas de la app de PC; sigue usando `/pc/*` solo para lo de siempre (login, canciones, favoritos, playlists, heartbeat básico).

### Requisitos

- Node.js 18+.
- [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) con el paquete **TV Extensions** instalado desde el Package Manager (trae las herramientas de línea de comandos `tizen` y `sdb` en `tools\ide\bin\`).
- Un certificado de firma de Samsung (Tizen Studio → Certificate Manager) para instalar en una TV real fuera del modo de solo-emulador.
- La TV en la misma red local que el PC, y en **modo desarrollador** (Apps → pulsar `12345` con el mando → Developer mode → ON → IP del PC).

### Compilar el bundle web

```bash
cd yfitops-samsungtv
npm install
npm run build
```

Esto genera `dist/` con `index.html`, `bundle.js`, `config.xml` e `icon.png` — un proyecto Tizen completo, listo para empaquetar.

### Empaquetar con la CLI de Tizen (`tizen package`)

En vez de pasar por la GUI de Tizen Studio (`Import` → `Run As`), se puede empaquetar directamente por línea de comandos apuntando al binario dentro de la instalación de Tizen Studio:

```bat
cd yfitops-samsungtv\dist
C:\tizen-studio\tools\ide\bin\tizen package -t wgt
```

Esto firma el paquete (con el certificado por defecto si no has configurado uno propio) y genera `YFitops.wgt` dentro de `dist/`. Si ves este aviso:

```text
WARNING: Default profile is used for sign. This signed package is valid for emulator test only.
```

significa que se ha firmado con el certificado temporal (`tempMobile.p12`) que trae Tizen Studio por defecto — vale para emulador, pero para instalarlo en la TV real de forma consistente conviene crear tu propio perfil de autor en `Certificate Manager` (cuenta Samsung → `Create` → author certificate) y volver a empaquetar pasándole el perfil:

```bat
C:\tizen-studio\tools\ide\bin\tizen package -t wgt -s NOMBRE_DE_TU_PERFIL
```

> Tip: añade `C:\tizen-studio\tools\ide\bin` a tu `PATH` de Windows para no tener que escribir la ruta completa cada vez.

### Conectar con la TV e instalar

```bat
C:\tizen-studio\tools\ide\bin\sdb connect IP_DE_LA_TV
```

Por ejemplo:

```bat
C:\tizen-studio\tools\ide\bin\sdb connect 192.168.1.120
```

Comprueba que aparece en la lista de dispositivos:

```bat
C:\tizen-studio\tools\ide\bin\sdb devices
```

Y, cuando la TV aparezca ahí, instala el `.wgt` generado:

```bat
C:\tizen-studio\tools\ide\bin\tizen install -n YFitops.wgt
```

La app queda instalada y lista para abrirse desde el menú **Apps** de la TV. Para reinstalar tras cambios, repite: `npm run build` → `tizen package -t wgt` → `tizen install -n YFitops.wgt` (no hace falta reconectar con `sdb` si la conexión sigue activa).

### Piezas clave

| Archivo/carpeta | Función |
|---|---|
| `config.xml` | Manifiesto Tizen: id de la app (10 caracteres del certificado + nombre), versión, `required_version` (4.0 para TVs de 2018), permisos de red (`<access origin="*" .../>`) y ajustes de pantalla completa. |
| `webpack.config.js` | Igual que en `yfitopspc/` pero con `target: 'web'` (no `electron-renderer`) y copiando `config.xml` + `icon.png` a `dist/` para dejarlo listo como proyecto Tizen. |
| `src/tv/tvBridge.js` | Sustituye `window.electronAPI`: sesión y foto de perfil en `localStorage` en vez de archivos en disco. |
| `src/tv/tvNavigation.js` | Navegación espacial por mando (flechas → foco más cercano en esa dirección), atajo `focusableProps()` para convertir `<div onClick>` en algo enfocable, y enganche de las teclas multimedia del mando. |
| `src/tv/backStack.js` | Pila de "capas" (modales/vistas) que se registran con `useTvBack(onClose)`; la tecla Atrás cierra siempre la de más arriba, o sale de la app si no hay ninguna abierta. |
| `src/store/MusicStore.js` | Igual que en PC pero sin las llamadas a Discord RPC y sin la rama de reproducción desde archivo local descargado (aquí siempre se hace streaming desde el servidor). |
| `src/store/SettingsStore.js` | Igual que en PC pero sin `launchOnStartup`, sin caché ni descargas offline (`downloadPlaylist`, `clearCache`, etc. no existen). |

### Notas de la app de TV

- El `id`/`package` de `tizen:application` en `config.xml` viene con un placeholder de 10 caracteres; hay que sustituirlo por el que te asigne tu propio certificado de autor antes de firmar para un uso más allá de pruebas puntuales.
- La foto de perfil vive en el `localStorage` del navegador Tizen de esa TV en concreto (no en un archivo ni en el servidor); si restauras la TV a fábrica, se pierde igual que se perdería la sesión.

---

## App móvil (Android)

La app móvil (`yfitops-android/`) es una aplicación **Expo + React Native** que vive junto a `servidor/` y `yfitopspc/`, dentro de la misma ruta del proyecto. Se conecta al backend a través de las rutas `/api/*` documentadas en [APIs](#apis) y en [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).

Comparte la misma filosofía que la app de PC: mismos 11 temas de color, mismo sistema de idiomas (ES/EN), descargas offline y foto de perfil solo-local. La única diferencia real de plataforma es que no tiene sentido un "inicio con el sistema" en un móvil, así que esa función no existe aquí.

> Al igual que la app de Samsung TV, todavía no tiene la pantalla de logros/estadísticas reales que sí tiene la app de PC — usa `/api/*` solo para lo de siempre.

### Requisitos

- Node.js 18+
- Una cuenta de [Expo](https://expo.dev) (gratuita) para compilar con EAS Build
- Para probar en desarrollo: la app **Expo Go** en tu móvil, o un emulador/dispositivo Android

### Configuración

Crea `app/.env` con la URL de tu servidor:

```env
EXPO_PUBLIC_SERVER_URL=https://tu-servidor.com
```

### Instalación y arranque en desarrollo

```bash
cd yfitops-android
npm install
npx expo start
```

Escanea el QR con la app **Expo Go** (Android) o pulsa `a` en la terminal para abrir en un emulador Android.

### Compilar el `.apk`

La forma recomendada es **EAS Build**, el servicio de compilación en la nube de Expo — no necesitas Android Studio ni SDKs instalados localmente:

```bash
cd yfitops-android
npm install -g eas-cli   # una sola vez
eas login                # inicia sesión con tu cuenta de Expo
eas build --platform android --profile preview
```

El perfil `preview` (definido en `eas.json`) genera directamente un **`.apk`** instalable, en vez del `.aab` que pide la Play Store:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": { "EXPO_PUBLIC_SERVER_URL": "https://tu-servidor.com" }
}
```

Cuando termina (se compila en los servidores de Expo, no en tu máquina), la terminal te da un enlace de descarga directo del `.apk`. Súbelo a donde tengas alojado el resto de instaladores y actualiza `data/version.json` (`apkUrl`) para que la app avise sola de la actualización.

**Perfiles disponibles en `eas.json`:**

| Perfil | Uso | Salida |
|---|---|---|
| `development` | Development client, para depurar con Metro conectado | Cliente de desarrollo instalable |
| `preview` | Distribución interna, para probar sin pasar por Play Store | `.apk` |
| `production` | Build final | `.aab` (formato que pide Google Play) |

```bash
# Build de producción para subir a Google Play
eas build --platform android --profile production
```

> Si en algún momento quieres compilar **localmente** sin depender de los servidores de Expo, necesitas Android Studio + el SDK de Android instalados, y entonces `eas build --platform android --profile preview --local` compila en tu propia máquina en vez de en la nube. Es más lento de preparar la primera vez, pero no depende de la cola de builds de Expo.

### Publicar la actualización

Igual que con el `.exe`/`AppImage` de PC: sube el `.apk` generado a donde lo sirvas (por ejemplo, `GET /app.apk` del panel web, ver [API web](#api-web-web) en `API_DOCUMENTATION.md`), y actualiza a mano:

- `data/version.json` → campo `apkUrl` (y `version`, para que la app detecte que hay una nueva).
- `data/actualizacion.json` → notas de la versión que se muestran en el modal "Novedades" al abrir la app.

### Piezas clave

| Archivo/carpeta | Función |
|---|---|
| `App.js` | Componente raíz: splash screen, verificación de sesión guardada, comprobación de versión/changelog contra `/api/version` y `/api/changelog`, banner de sin conexión. |
| `app.json` | Configuración de Expo: nombre, iconos, permisos de Android (notificaciones, servicio en primer plano, arranque al encender), plugins. |
| `eas.json` | Perfiles de compilación (`development`/`preview`/`production`) usados por EAS Build. |
| `plugins/withMusicForegroundService.js` | Config plugin que añade al `AndroidManifest.xml` el servicio en primer plano de reproducción y el receptor de botones de medios (auriculares, notificación). |
| `src/context/MusicContext.js` | Estado global del reproductor (`expo-av`): cola, favoritos, heartbeat, notificación con controles de reproducción, reacciona al estado real de reproducción (interrupciones, llamadas, otras apps) en vez de fiarse de temporizadores manuales, y reproduce desde disco si la canción está descargada. |
| `src/context/SettingsContext.js` | Tema (11 colores), idioma, foto de perfil (solo local, vía `expo-file-system`), conectividad (`@react-native-community/netinfo`) y descargas offline/caché. |
| `src/theme.js` | Las 11 paletas de color, iguales a las de la app de PC. |
| `src/i18n/` | Textos ES/EN de toda la interfaz. |
| `src/screens/` | Pantallas: login, biblioteca, favoritos, colecciones, ajustes. |
| `src/components/` | Barra y modal del reproductor, fila de canción, texto con marquesina para títulos largos, iconos. |

### Notas de la app móvil

- La foto de perfil y las canciones/playlists descargadas para offline se guardan con `expo-file-system` en el almacenamiento propio de la app — nunca se suben al servidor ni son visibles para otras apps.
- El reproductor comprueba primero si la canción está descargada en disco antes de hacer streaming; si no lo está, sigue funcionando igual que siempre mientras haya conexión.
- La notificación de reproducción (con los controles de anterior/pausa/siguiente) se mantiene sincronizada con el estado real del audio nativo, así que también refleja correctamente pausas provocadas por el sistema (una llamada entrante, otra app tomando el audio, etc.), no solo las que inicia el usuario desde la app.
- El indicador de "sin conexión" usa `@react-native-community/netinfo`, que reacciona a cambios de red en tiempo real sin necesidad de peticiones de comprobación.

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

## Logros y estadísticas por usuario

Cada usuario tiene un catálogo de **logros** (100 de base) y unas **estadísticas de escucha reales**, calculadas por el servidor a partir del historial de reproducción, nada mockeado ni hardcodeado en los clientes. No se ha tocado el comportamiento de nada que ya existía: todo esto es aditivo, y los clientes antiguos que no manden los campos nuevos siguen funcionando exactamente igual que antes.

### Vincular usuarios ya existentes

No hace falta ninguna migración de datos. Todas las tablas nuevas (ver [Tablas de MySQL](#tablas-de-mysql)) usan `user_id VARCHAR(36)` con `FOREIGN KEY ... REFERENCES users(id)`, la misma clave primaria que ya tiene cada usuario. Como esa tabla y esos IDs ya existen, todos los usuarios actuales quedan vinculados automáticamente en el momento en que:

- Hacen login (`/api/login`, `/pc/login`): se evalúan sus logros por primera vez (verá los que ya cumple, por ejemplo por antigüedad de cuenta).
- Mandan un heartbeat reproduciendo algo: se crea su fila en `user_listening_stats` (con `INSERT ... ON DUPLICATE KEY UPDATE`, no hace falta crearla a mano antes).

En cuanto se actualiza el servidor y un usuario existente abre la app y reproduce una canción, sus estadísticas y logros empiezan a contar desde cero de forma transparente. No hay errores ni huecos por usuarios "no migrados": simplemente no tienen filas todavía en las tablas nuevas hasta su primera reproducción, y las consultas devuelven 0 / `null` para esos casos (todas las lecturas de `lib/userStats.js` tienen su valor por defecto).

### Sistema de logros

Cómo funciona:

- El catálogo de 100 logros base vive en `lib/achievementsCatalog.js` y se siembra en la tabla `achievements` al arrancar.
- El catálogo se puede añadir, editar o desactivar sin tocar código, desde el panel web con `/web/achievements` (rol `superadmin`). Ahí se pueden crear logros propios con su icono, título, descripción, categoría, métrica y umbral.
- Cada logro tiene una `metric` (qué se mide) y un `threshold` (a partir de qué valor se desbloquea). El servidor calcula las métricas de cada usuario (`computeUserMetrics()` en `lib/achievements.js`) y compara.
- La evaluación (`evaluateUserAchievements()`) se dispara automáticamente en los puntos donde tiene sentido que cambien las métricas: login, cada vez que empieza a sonar una canción nueva (heartbeat), al subir una canción, al añadir un favorito y al crear una playlist. Es barata e idempotente, así que no hay problema en llamarla seguido.
- Una vez desbloqueado, un logro se queda desbloqueado para siempre (se guarda en `user_achievements` con la fecha), aunque luego la métrica baje (por ejemplo si se borran canciones de la biblioteca).

Métricas disponibles:

| metric | Qué mide |
|---|---|
| `songs_played` | Número total de reproducciones (cambios de canción) |
| `unique_songs_played` | Número de canciones distintas reproducidas |
| `song_play_count` | Máximo de veces que ha repetido la misma canción |
| `listening_hours` | Horas totales de escucha acumuladas |
| `daily_streak` | Días seguidos escuchando música |
| `favorites_count` | Número de canciones en favoritos |
| `playlists_created` | Número de playlists propias creadas |
| `unique_playlists_played` | Número de playlists/colecciones distintas reproducidas |
| `playlist_play_count` | Máximo de veces que ha repetido la misma playlist |
| `songs_uploaded` | Número de canciones subidas por el usuario |
| `night_hours` | Horas escuchadas entre las 00:00 y las 05:59 |
| `weekend_hours` | Horas escuchadas en fin de semana |
| `account_age_days` | Días desde que se creó la cuenta |
| `achievements_unlocked` | Número de logros ya desbloqueados (logro "meta") |
| `library_size` | Tamaño de la biblioteca global del servidor (igual para todos) |
| `max_daily_hours` | Máximo de horas escuchadas en un solo día |
| `client_reported` | No se evalúa en servidor; el cliente lo reclama a mano (ver siguiente apartado) |

Logros "reclamados por el cliente": hay cosas que solo el cliente sabe (por ejemplo, qué playlists tiene descargadas para modo offline, ya que eso vive en el dispositivo, no en el servidor). Para esos casos, un logro se marca `client_reported = 1` en el catálogo y el cliente lo desbloquea explícitamente llamando a `POST /api/achievements/:id/claim` o `POST /pc/achievements/:id/claim`. El servidor valida que ese `id` exista, esté activo y esté marcado como `client_reported` antes de desbloquearlo: no se puede usar esta ruta para desbloquear logros normales a mano, eso sigue requiriendo cumplir la métrica de verdad. Ahora mismo solo hay un logro así en el catálogo base (`offline_first`, "descarga tu primera playlist offline"), pensado para que el cliente lo reclame cuando el usuario complete su primera descarga.

Los 100 logros se generan por niveles (Bronce a Infinito) sobre las métricas de la tabla anterior, más 4 logros especiales (dos hitos de biblioteca global, un "maratón" de más de 4 horas en un día, y el de offline). La lista completa se puede consultar con `GET /web/achievements` una vez el servidor esté arrancado, o leyendo `lib/achievementsCatalog.js`.

Seguridad ante condiciones de carrera: si dos peticiones del mismo usuario llegan casi a la vez (por ejemplo, un cliente que por error manda el mismo heartbeat dos veces, dos dispositivos con la misma cuenta abierta a la vez, o un reintento de red), nada se cuenta ni se desbloquea por duplicado. Esto se consigue en dos frentes:

- `evaluateUserAchievements()` usa un candado en memoria por usuario (`lib/achievements.js`): si ya hay una evaluación en curso para ese usuario, cualquier llamada que llegue mientras tanto espera a que termine esa en vez de lanzar otra en paralelo, así el mismo logro nunca se devuelve dos veces en dos respuestas casi simultáneas.
- `claimClientAchievement()` (usado por `POST /api/achievements/:id/claim` y `POST /pc/achievements/:id/claim`) no comprueba primero si el logro ya estaba desbloqueado para decidir si insertarlo: intenta insertarlo directamente con `INSERT IGNORE` y mira `affectedRows` para saber si esta llamada en concreto ha sido la que lo ha desbloqueado. La clave primaria compuesta `(user_id, achievement_id)` de `user_achievements` hace que MySQL sólo dé por buena una de dos inserciones concurrentes idénticas; la otra se ignora sola. Antes se comprobaba primero y se insertaba después, lo que permitía que dos llamadas casi a la vez (típicamente el reclamo automático al terminar una descarga offline y el reintento silencioso de la pantalla de Perfil) se creyeran ambas "la primera" y mostraran el mismo logro desbloqueado dos veces.

### Estadísticas por usuario

`GET /api/stats/me` (y su equivalente `GET /pc/stats/me`) devuelve:

```json
{
  "totalListeningSeconds": 12345,
  "totalHours": 3.4,
  "totalSongsPlayed": 210,
  "currentStreak": 5,
  "dailyListening": [{ "date": "2026-07-01", "seconds": 1800 }],
  "mostPlayedSong": { "id": "...", "title": "...", "artist": "...", "playCount": 42 },
  "mostPlayedPlaylist": { "id": "...", "type": "manual", "name": "...", "playCount": 12 }
}
```

Notas de implementación:

- Horas totales y diarias: se acumulan a partir del `elapsedMs` que ya mandaba el cliente en cada heartbeat (no cambia el contrato, solo se suma también a la tabla del usuario además de a la global).
- Canción / playlist más escuchada: se cuenta como "reproducción" cada vez que `songId` cambia y `isPlaying` es `true`, el mismo criterio que ya usaba el contador global `totalSongsPlayed`. Para que se registre la playlist, el cliente debe mandar `playlistId` (y opcionalmente `playlistType: 'folder'`) en el heartbeat mientras suena esa playlist; si no lo manda, solo se pierde la estadística de playlist, todo lo demás sigue funcionando igual. El buscador de título/artista de la canción reproducida mira tanto la biblioteca principal como las canciones dentro de las colecciones por carpeta, para que no salga "Desconocido" en canciones que solo viven en una colección.
- Racha (`currentStreak`): días consecutivos con algo de escucha registrada. Si hoy todavía no se ha escuchado nada, la racha no se rompe (cuenta desde ayer) para no penalizar a alguien que aún no ha abierto la app hoy.
- Noche / fin de semana: se aproxima con la hora del servidor en el momento del heartbeat (no reparte el tramo si cruza medianoche). Es intencionalmente simple: para logros/estadísticas no hace falta más precisión.
- Pausar y reanudar la misma canción no cuenta como una reproducción nueva: solo se registra una reproducción nueva cuando cambia el `songId` respecto al heartbeat anterior (o es la primera vez que se ve reproducir algo a ese usuario).

### Cambios en `/heartbeat`

Body antes:
```json
{ "songId": "...", "isPlaying": true, "elapsedMs": 12400 }
```

Body ahora (los dos campos nuevos son opcionales):
```json
{ "songId": "...", "isPlaying": true, "elapsedMs": 12400, "playlistId": "...", "playlistType": "manual" }
```

- `playlistId`: el id de la playlist que está sonando (propia o de carpeta), si la hay.
- `playlistType`: `"manual"` (por defecto) o `"folder"`.

Respuesta antes:
```json
{ "activeListeners": 3 }
```

Respuesta ahora:
```json
{
  "activeListeners": 3,
  "newAchievements": [{ "id": "...", "icon": "...", "title": "...", "description": "..." }],
  "warning": "..."
}
```

`newAchievements` casi siempre viene vacío (`[]`); solo trae contenido justo en el heartbeat donde se desbloquea algo nuevo, para que el cliente pueda mostrar una notificación sin tener que hacer polling aparte. `warning` normalmente no aparece; solo se incluye cuando el limitador de peticiones detecta que este usuario se está acercando al límite (ver [Protección anti-spam / rate limiting](#protección-anti-spam--rate-limiting)), como aviso amistoso antes de bloquear de verdad. Un cliente viejo que ignore estos campos sigue funcionando exactamente igual que antes.

Además, el servidor actualiza el registro de "qué está sonando ahora" (`activeListeners`, usado también para saber si una reproducción es nueva) de forma síncrona, antes de cualquier operación de base de datos dentro del propio handler. Esto cierra la ventana en la que dos heartbeats casi simultáneos del mismo usuario podían leer el mismo estado desactualizado y contarse los dos como "nueva reproducción" (lo que antes duplicaba el contador de reproducciones de una canción y podía disparar el mismo logro dos veces). El cliente de PC, por su parte, ya no manda un heartbeat duplicado al cambiar de canción (antes lo hacía: uno explícito y otro desde el propio evento `play` del elemento de audio).

### Resumen de endpoints nuevos

Todos siguen el mismo esquema de autenticación que el resto de rutas de su prefijo (JWT Bearer para `/api` y `/pc`, cookie `web_token` para `/web`). El detalle completo de cada uno está en [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

| Método y ruta | Para qué sirve |
|---|---|
| `GET /api/achievements` | Catálogo completo de logros activos con el estado de desbloqueo y el progreso actual del usuario autenticado |
| `POST /api/achievements/:id/claim` | Reclama un logro `client_reported` |
| `GET /api/stats/me` | Estadísticas personales del usuario: horas totales/diarias, racha, canción y playlist más escuchadas |
| `GET /pc/achievements` | Igual que `/api/achievements` pero para la app de PC |
| `POST /pc/achievements/:id/claim` | Igual que `/api/achievements/:id/claim` pero para PC |
| `GET /pc/stats/me` | Igual que `/api/stats/me` pero para PC |
| `GET /web/achievements` | Ver el catálogo completo (incluye logros inactivos), para el panel de admin |
| `POST /web/achievements` | Crear un logro nuevo (requiere `superadmin`) |
| `PUT /web/achievements/:id` | Editar un logro: icono, título, descripción, métrica, umbral, activo... (requiere `superadmin`) |
| `DELETE /web/achievements/:id` | Borrar un logro del catálogo (requiere `superadmin`) |
| `GET /web/users/:id/stats` | Ver desde el panel las estadísticas y el número de logros de un usuario concreto (soporte/administración) |

Actualmente esto está implementado en el **servidor** y en la **app de PC** (`ProfileView.jsx` + `AchievementToast.jsx`); Android y Samsung TV siguen sin esta pantalla, ver las notas de sus secciones respectivas más arriba.

---

## Protección anti-spam / rate limiting

Implementado en `servidor/lib/rateLimit.js`, aplicado en `server.js`. Todas las APIs (`/api/`, `/pc/`, `/web/`, `/bot/` y las rutas públicas) están protegidas contra flood con limitadores en memoria, sin tablas MySQL adicionales, por dos motivos: es más rápido (no añade una consulta a MySQL en cada petición de la API) y los baneos son de corta/media duración (minutos-horas), así que no merece la pena persistirlos en disco; si el servidor se reinicia, simplemente se limpian y se empieza de cero, lo cual es aceptable para este caso de uso. Si en el futuro se necesitan bans permanentes por abuso grave, se puede añadir una tabla `blocked_keys` y consultarla solo en el paso de "¿está baneada esta clave?" (una única query barata), pero de momento no hacía falta para un nivel razonable de seguridad.

Cómo funciona:

1. Ventana fija por clave. Cada limitador cuenta peticiones en una ventana de tiempo (`windowMs`) para una "clave" (`keyFn`). Si se pasa de `max`, responde `429 Too Many Requests` con `Retry-After`.
2. Baneo progresivo. Si una misma clave dispara el límite muchas veces seguidas (6 veces en 10 minutos), se le aplica un bloqueo de 30 minutos con `403 Forbidden`. Si reincide después de cumplir el bloqueo, el siguiente baneo dura el doble (60 min, 120 min...) hasta un tope de 12 horas.
3. La clave no siempre es la IP. Para `/api`, `/pc` y `/web` se intenta identificar al usuario decodificando su JWT (sin verificar firma, solo para repartir el contador de forma justa; la autenticación real la sigue haciendo el middleware de auth de siempre) y, si no hay token, se cae a IP. Para `/bot` se usa la cabecera `X-Bot-Key`. Así, varios usuarios detrás del mismo router no se penalizan entre ellos, y un usuario que también entra desde el móvil y el PC no agota su propio límite el doble de rápido de forma injusta, aunque sí comparte límite entre ambos si usa la misma cuenta en los dos a la vez, lo cual es razonable.

Límites configurados:

| Limitador | Ventana | Máximo | Aplica a |
|---|---|---|---|
| `globalIpLimiter` | 60 s | 400 | Todo el servidor (backstop por IP) |
| `loginLimiter` | 15 min | 15 | `/api/login`, `/pc/login`, `/web/login` |
| `heartbeatLimiter` | 10 s | 60 | `/api/heartbeat`, `/api/latency`, `/pc/heartbeat`, `/pc/latency` |
| `apiLimiter` | 60 s | 180 | Resto de `/api/*` |
| `pcLimiter` | 60 s | 180 | Resto de `/pc/*` |
| `webLimiter` | 60 s | 240 | `/web/*` |
| `botLimiter` | 60 s | 240 | `/bot/*` |
| `uploadLimiter` | 60 s | 20 | `/api/upload` (además del límite general) |

El límite de heartbeat es deliberadamente generoso para no penalizar a quien cambia de canción o pausa/reanuda muy seguido, y es independiente del límite general de `/api`. Solo entra en juego si algo manda heartbeats de forma claramente anómala (varias peticiones por segundo de forma sostenida, típico de un bug de cliente o un ataque). Si en algún momento se notan falsos positivos con usuarios legítimos, los números están todos centralizados al principio de `servidor/lib/rateLimit.js` (`createRateLimiter({ windowMs, max, ... })`) y son fáciles de ajustar. Como los baneos viven solo en memoria, reiniciar el servidor libera al momento a cualquier clave bloqueada, sin tener que esperar a que expire el bloqueo.

Aviso amistoso antes del bloqueo: `heartbeatLimiter`, `apiLimiter` y `pcLimiter` tienen activado un aviso previo (`warnAt`) al 70-75% de su límite. Al cruzar ese umbral por primera vez dentro de la ventana de tiempo, la petición se deja pasar con normalidad (no es un bloqueo), pero la respuesta incluye un campo `warning` con un mensaje en texto, para que el cliente muestre una notificación tipo "estás yendo muy rápido, tómatelo con calma" antes de que el bloqueo real (429, y más adelante el baneo temporal) llegue a activarse. En la app de PC este aviso lo muestra el componente `RateLimitWarningToast.jsx`. El aviso se manda como mucho una vez por ventana de tiempo por clave, para no ser pesado si la persona sigue al límite un rato largo.

---

## Seguridad

- Contraseñas hasheadas con SHA-256 + salt.
- Tokens JWT con expiración configurable.
- CORS habilitado para múltiples orígenes.
- Validación de tipo y tamaño de archivo en subidas.
- Middlewares de autenticación en todas las rutas protegidas.
- Acceso al panel web restringido a rol `superadmin`.
- Rate limiting con baneo progresivo en todas las APIs (ver [Protección anti-spam / rate limiting](#protección-anti-spam--rate-limiting)).

---

## Sincronización de carpetas

El servidor vigila automáticamente `/playlist/` y `/canciones/`. Cualquier cambio se detecta en tiempo real sin necesidad de reiniciar.

Para forzar una sincronización manual desde el cliente:

```http
POST /api/sync
```

---

## Canciones, portadas y playlists

### Subir canciones a la biblioteca

Dos formas de meter canciones nuevas:

**1. Desde la app (móvil o PC), subida directa:**
```http
POST /api/upload
Content-Type: multipart/form-data
campo: audio  (archivo de audio)
```
El servidor genera un `id` único, procesa el archivo (`processAudioFile`) para sacar la duración y otros metadatos básicos, lo añade a la biblioteca y lo asocia como "subida" del usuario que hizo la petición (`user.songs`).

**2. Copiando el archivo directamente en el servidor:**
Pega el archivo de audio dentro de:
```text
servidor/canciones/
```
El watcher en tiempo real lo detecta solo, o si prefieres forzarlo:
```http
POST /api/sync
```
Esto compara los archivos físicos de `canciones/` contra la base de datos: añade los que falten y quita de la base los que ya no existan en disco.

> Los formatos de audio aceptados dependen de `AUDIO_EXTS` en `lib/config.js` (normalmente `.mp3`, `.wav`, `.flac`...).

### Editar título, artista y álbum de una canción

```http
PUT /api/songs/:id
Content-Type: application/json

{ "title": "Nuevo título", "artist": "Nuevo artista", "album": "Nuevo álbum" }
```
Cualquier campo que no envíes se queda tal cual estaba. En la app de PC esto se hace pulsando el icono de editar sobre cualquier canción de "Mi Biblioteca".

### Subir o cambiar la portada de una canción

Hay dos formas, según si es una canción suelta o un lote entero:

**A) Portada individual, subida manual (una canción a la vez):**
```http
POST /api/songs/:id/cover
Content-Type: multipart/form-data
campo: cover  (imagen)
```
El servidor la guarda como `canciones/{id}.jpg` (o la extensión que subas) y actualiza el `coverUrl` de esa canción. En la app de PC se hace desde el modal de edición de canción (icono de cámara) o desde la pantalla grande del reproductor.

**B) Carátulas en lote, dejándolas en `servidor/portadas/`:**

>  Esto es **100% manual**: el servidor no descarga ni genera ninguna carátula por su cuenta. Tienes que conseguir tú la imagen (descargarla, recortarla, etc.) y subirla tú mismo a `servidor/portadas/` con el nombre correcto — el servidor solo se encarga de **emparejarla** con la canción que ya tienes, no de buscarla ni crearla.

Si tienes muchas carátulas ya descargadas (por ejemplo, junto a las canciones al bajarlas de YouTube), puedes meterlas todas en:
```text
servidor/portadas/
```
y el servidor las empareja automáticamente con la canción correspondiente **por nombre de archivo**.

>  **Clave para que funcione:** el nombre del archivo de la portada debe coincidir con el nombre del archivo de audio (mismo nombre base, cambiando solo la extensión). Ejemplo:
> ```text
> canciones/ejemplo.mp3
> portadas/ejemplo.webp
> ```


Después de colocar las imágenes, llama a:
```http
POST /api/refresh-covers
```
(o `POST /pc/refresh-covers` desde la app de PC) para que relacione las carátulas nuevas con canciones que **ya existían** en la biblioteca. Las canciones que subas o sincronices **a partir de ahora** recogen su carátula sola si el nombre coincide, sin necesidad de este paso extra.

### Crear playlists

Hay dos tipos, y se crean de formas totalmente distintas:

**1. Playlists manuales** (privadas, ligadas a un usuario, se gestionan desde la app):
```http
POST /api/playlists
Content-Type: application/json

{ "name": "Mi playlist", "songs": ["id1", "id2"], "coverColor": "#1DB954" }
```
Se pueden editar (`PUT /api/playlists/:id`) o borrar (`DELETE /api/playlists/:id`) después, y solo las ve el usuario que las creó.

**2. Playlists automáticas por carpetas** (públicas para todos, no se crean por API):

>  Esto también es **100% manual**: no hay ningún botón ni endpoint que cree la carpeta, suba las canciones o ponga la portada por ti. Tienes que hacer tú, a mano, en el sistema de archivos del servidor: **1)** crear la carpeta, **2)** meter dentro los archivos de audio, y **3)** si quieres portada, subir tú la imagen con el nombre exacto. El servidor solo detecta lo que ya has puesto ahí y lo convierte en playlist.

Se crean **poniendo una carpeta** dentro de `servidor/playlist/`. El nombre de la carpeta pasa a ser el nombre de la playlist, y cualquier archivo de audio que metas dentro forma parte de ella automáticamente:

```text
servidor/playlist/
└── Mis Favoritas de Verano/       ← se convierte en la playlist "Mis Favoritas de Verano"
    ├── cancion1.mp3
    ├── cancion2.mp3
    └── cancion3.mp3
```

> Si la Carpeta (Playlist) se llama, NUEVAYOL/, la portada ha de ser NUEVAYOL.png y estar dentro de la carpeta NUEVAYOL/ en este caso solo se admite **formato png**

El watcher en tiempo real la detecta sola, o puedes forzar la sincronización con:
```http
POST /api/folderplaylists/sync
```

---

## Estadísticas

El servidor registra automáticamente, a nivel **global**:

- Total de horas escuchadas
- Total de canciones reproducidas
- Latencia promedio de conexión
- Tiempo de procesamiento de subidas
- Escuchas diarias

Y, a nivel **por usuario** (ver [Logros y estadísticas por usuario](#logros-y-estadísticas-por-usuario) para el detalle completo):

- Horas totales y diarias de escucha
- Racha de días consecutivos escuchando música
- Canción más escuchada
- Playlist/colección más escuchada
- Progreso hacia cada uno de los 100 logros del catálogo

---

## Scripts disponibles

> **Importante:** Todos los comandos deben ejecutarse desde la carpeta de la aplicación correspondiente, **no desde la raíz del proyecto**.

# Servidor (`yfitops-server`)

| Script | Descripción |
| --- | --- |
| `npm start` | Inicia el servidor. |
| `npm run dev` | Inicia el servidor en modo desarrollo. |
| `npm run migrate` | Ejecuta la migración de datos a MySQL. |
| `npm run final-fix` | Ejecuta el script de corrección final de la base de datos. |
| `npm run web:install` | Instala las dependencias del panel web. |
| `npm run web:dev` | Inicia el panel web en modo desarrollo. |
| `npm run web:build` | Genera la versión de producción del panel web. |

---

# Aplicación de escritorio (`yfitops-pc`)

| Script | Descripción |
| --- | --- |
| `npm start` | Compila la aplicación en modo desarrollo y la inicia con Electron. |
| `npm run watch` | Inicia la aplicación en modo desarrollo con recompilación automática (Webpack Watch). |
| `npm run build` | Genera la compilación de producción. |
| `npm run dist` | Genera el instalador de Windows (`.exe`). |
| `npm run dist:linux` | Genera los instaladores para Linux (`AppImage` y `.deb`). |
| `npm run dist:all` | Genera los instaladores para Windows y Linux. |

---

# Aplicación de Samsung TV (`yfitops-samsungtv`)

| Script | Descripción |
| --- | --- |
| `npm run build` | Compila el renderer (React) a `dist/`, dejando ahí un proyecto Tizen completo (junto a `config.xml` e `icon.png`). |

Empaquetado e instalación en la TV: no son scripts de `npm`, se hacen con la CLI de Tizen Studio (`tizen package`, `sdb connect`, `tizen install`) — ver la sección [App de Samsung TV (Tizen)](#app-de-samsung-tv-tizen).

---

# Aplicación móvil (`yfitops-android`)

| Script | Descripción |
| --- | --- |
| `npm start` | Inicia el proyecto con Expo (Metro Bundler). |
| `npm run android` | Compila e inicia la aplicación en un emulador o dispositivo Android conectado. |
| `npm run ios` | Compila e inicia la aplicación en un simulador o dispositivo iOS conectado. |
| `npm run web` | Inicia la aplicación en modo web mediante Expo. |

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

**No se desbloquean logros / no aparecen estadísticas**

- Comprueba que el servidor arrancó sin errores de MySQL (las tablas de logros/estadísticas se crean solas al arrancar, revisa los logs de `[MYSQL]`).
- Los logros se evalúan en el heartbeat solo cuando cambia de canción (`isPlaying: true` y `songId` distinto al anterior); si dejas la misma canción sonando en bucle, la mayoría de logros de "reproducciones" no avanzan hasta el siguiente cambio.
- El catálogo puede estar vacío si has desactivado logros desde `/web/achievements` sin querer — revisa `active` en la tabla `achievements`.

---

## Licencia

Privada — YFitops 2026

*Última actualización: 13 de julio de 2026*