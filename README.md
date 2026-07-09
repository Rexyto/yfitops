# YFitops

> Ecosistema multiplataforma de música: servidor backend, app de escritorio para Windows y Linux, app móvil para Android, panel web administrativo y bots.

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
- [App móvil (Android)](#app-móvil-android)
- [APIs](#apis)
- [Seguridad](#seguridad)
- [Sincronización de carpetas](#sincronización-de-carpetas)
- [Canciones, portadas y playlists](#canciones-portadas-y-playlists)
- [Estadísticas](#estadísticas)
- [Scripts disponibles](#scripts-disponibles)
- [Solución de problemas](#solución-de-problemas)
- [Versiones](#versiones)
- [Licencia](#licencia)

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

> Este es el esquema recomendado a partir de los datos que maneja el servidor (usuarios, canciones, favoritos, playlists y estadísticas). Si tu `lib/storage.js` usa nombres de columna distintos, ajusta el script en consecuencia.

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
└── yfitopspc/                   # App de escritorio Electron — genera tanto el instalador de Windows como el binario de Linux
    ├── main.js                  # Proceso principal de Electron
    ├── preload.js               # Puente seguro entre Electron y el renderer (contextBridge)
    ├── discordRpc.js            # Discord Rich Presence ("reproduciendo ahora")
    ├── localData.js             # Datos solo-locales: foto de perfil, canciones/playlists descargadas, caché
    ├── autostart.js             # Inicio automático con el sistema (Windows/macOS nativo, Linux vía .desktop)
    ├── webpack.config.js        # Bundler del renderer (React)
    ├── package.json
    ├── package-lock.json
    ├── assets/                  # Iconos de la app (.ico, etc.)
    ├── public/                  # Estáticos copiados tal cual al build (logo, index.html base)
    ├── dist/                    # Build del renderer generado por webpack (no versionar)
    ├── release/                 # Instaladores/ejecutables generados (no versionar)
    ├── node_modules/            # Dependencias (no versionar)
    └── src/                     # Código fuente del renderer (React)
        ├── index.html           # Variables CSS de los 11 temas de color
        ├── index.jsx            # Punto de entrada de React
        ├── App.jsx              # Componente raíz, título custom, updates, changelog, aviso sin conexión
        ├── api.js               # Llamadas a la API del servidor → /pc/*
        ├── i18n/
        │   ├── translations.js  # Textos ES/EN de toda la interfaz
        │   └── index.js         # Hook useT()
        ├── store/
        │   ├── MusicStore.js    # Estado global (zustand): auth, canciones, reproductor, heartbeat, Discord RPC
        │   └── SettingsStore.js # Tema, idioma, foto de perfil, conectividad, descargas offline, autoarranque
        └── components/
            ├── LoginScreen.jsx
            ├── Sidebar.jsx
            ├── SongsView.jsx
            ├── FavoritesView.jsx
            ├── PlaylistsView.jsx
            ├── SettingsView.jsx # Perfil, apariencia (11 temas), idioma, descargas offline, caché, créditos, versión
            ├── PlayerBar.jsx
            ├── PlayerModal.jsx
            └── QueueView.jsx
```

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
| `src/api.js` | Cliente HTTP hacia el backend, todo apuntando a `/pc/*` (login, canciones, favoritos, playlists, heartbeat, latencia, estado). |
| `src/i18n/` | Diccionario de textos ES/EN y hook `useT()` para toda la interfaz (nombres de canciones/playlists nunca se traducen). |
| `src/store/MusicStore.js` | Estado global de la app (zustand): sesión, reproductor de audio (con reproducción desde disco si la canción está descargada), cola de reproducción, favoritos, heartbeat cada 30s y sincronización con Discord RPC. |
| `src/store/SettingsStore.js` | Tema (11 colores), idioma, foto de perfil, conectividad, descargas offline/caché y autoarranque. |
| `src/components/` | Vistas y componentes de la interfaz: login, sidebar, biblioteca, favoritos, colecciones, ajustes, barra y modal del reproductor, cola de reproducción. |

### Notas de la app de escritorio

- La sesión se guarda cifrada... bueno, en texto plano en `session.json` dentro de la carpeta `userData` de Electron; al abrir la app se valida el token contra `/pc/verify` y si no es válido se limpia sola.
- El changelog que se ve al actualizar sale de `/pc/changelog`, que a su vez lee `data/actualizacion.json` → campo `pc` en el servidor.
- La comprobación de versión (`/pc/version`) actualmente **no bloquea** el uso de la app si la versión local y la del servidor no coinciden; solo lo haría si se reactiva el bloqueo comentado en `App.jsx`.
- La foto de perfil, las descargas offline y el idioma/tema elegidos son **solo locales**: viven en `userData` (Electron) o `localStorage`, nunca se sincronizan con el servidor ni con otros dispositivos.
- El indicador de "sin conexión" usa los eventos `online`/`offline` del navegador (Chromium embebido), sin necesidad de hacer polling al servidor.

---

## App móvil (Android)

La app móvil (`yfitops-android/`) es una aplicación **Expo + React Native** que vive junto a `servidor/` y `yfitopspc/`, dentro de la misma ruta del proyecto. Se conecta al backend a través de las rutas `/api/*` documentadas en [APIs](#apis) y en [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).

Comparte la misma filosofía que la app de PC: mismos 11 temas de color, mismo sistema de idiomas (ES/EN), descargas offline y foto de perfil solo-local. La única diferencia real de plataforma es que no tiene sentido un "inicio con el sistema" en un móvil, así que esa función no existe aquí.

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
Cualquier campo que no envíes se queda tal cual estaba. En la app de PC esto se hace pulsando el icono ✎ sobre cualquier canción de "Mi Biblioteca".

### Subir o cambiar la portada de una canción

Hay dos formas, según si es una canción suelta o un lote entero:

**A) Portada individual, subida manual (una canción a la vez):**
```http
POST /api/songs/:id/cover
Content-Type: multipart/form-data
campo: cover  (imagen)
```
El servidor la guarda como `canciones/{id}.jpg` (o la extensión que subas) y actualiza el `coverUrl` de esa canción. En la app de PC se hace desde el modal de edición de canción (📷) o desde la pantalla grande del reproductor.

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

El servidor registra automáticamente por usuario:

- Total de horas escuchadas
- Total de canciones reproducidas
- Latencia promedio de conexión
- Tiempo de procesamiento de subidas
- Escuchas diarias

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

---

## Versiones

| Componente | Versión |
|---|---|
| Servidor | 2.0.0 |
| App Móvil (Android) | 2.0.0 |
| App de escritorio (PC) | 1.1.0 |
| Web | 2.0.0 |

> Estas versiones son las que se comparan contra `data/version.json` para avisar de actualizaciones disponibles, y contra `data/actualizacion.json` para mostrar el changelog correspondiente a cada plataforma.

---

## Licencia

Privada — YFitops 2026

*Última actualización: 9 de julio de 2026*