# YFitops API Documentation

> Servidor multiplataforma de música para Android, Windows, Linux, Samsung Smart TV, panel web administrativo y bots.

---

## Índice

- [Base URL](#base-url)
- [Autenticación](#autenticación)
- [Rutas globales](#rutas-globales)
- [API Móvil `/api/`](#api-móvil-api)
- [API PC `/pc/`](#api-pc-pc)
- [API Web `/web/`](#api-web-web)
- [API Bot `/bot/`](#api-bot-bot)
- [Rate limiting / protección anti-spam](#rate-limiting--protección-anti-spam)
- [Notas técnicas](#notas-técnicas)

---

## Base URL

```
http://localhost:6666
```

---

## Autenticación

Cada plataforma usa su propio mecanismo de autenticación y su propio secreto definido en `servidor/.env`.

| Plataforma | Prefijo | Método | Header / Cookie |
|---|---|---|---|
| Móvil | `/api/` | JWT Bearer | `Authorization: Bearer <token>` |
| PC | `/pc/` | JWT Bearer o Cookie | `Authorization: Bearer <token>` · Cookie: `pc_token` |
| Web | `/web/` | Cookie HttpOnly | Cookie: `web_token` (duración 3 días) |
| Bot | `/bot/` | API Key | `X-Bot-Key: <clave>` |

---

## Rutas globales

### `GET /health`

Comprueba que el servidor está activo.

**Respuesta**
```json
{ "status": "OK" }
```

---

### `GET /status`

Devuelve métricas generales del servidor.

**Respuesta**
```json
{
  "songs": 123,
  "playlists": 12,
  "users": 5,
  "activeListeners": 2,
  "status": "OK"
}
```

---

## API Móvil `/api/`

Todos los endpoints requieren `Authorization: Bearer <token>` salvo `/api/login`.

---

### Autenticación

#### `POST /api/login`

Inicia sesión y devuelve un JWT.

**Body**
```json
{ "username": "string", "password": "string" }
```

**Respuesta**
```json
{ "token": "...", "username": "user", "id": "uuid" }
```

---

#### `GET /api/verify`

Valida el token actual.

**Respuesta**
```json
{ "valid": true, "username": "user", "id": "uuid" }
```

---

### Información

#### `GET /api/version`

```json
{ "version": "1.0.0", "apkUrl": "https://..." }
```

#### `GET /api/changelog`

```json
{ "version": "1.0.1", "notes": "..." }
```

#### `GET /api/ping`

```json
{ "pong": 1681234567890 }
```

---

### Canciones

#### `GET /api/songs`

Devuelve todas las canciones. Acepta `?search=query` para filtrar.

**Respuesta** — Array de objetos `Song`.

---

#### `GET /api/mysongs`

Devuelve las canciones guardadas por el usuario autenticado.

**Respuesta** — Array de objetos `Song`.

---

#### `POST /api/upload`

Sube un archivo de audio.

**Body** — `multipart/form-data` con campo `audio`.

**Respuesta** — Objeto `Song`.

---

#### `PUT /api/songs/:id`

Edita los metadatos de una canción.

**Body**
```json
{ "title": "string?", "artist": "string?", "album": "string?" }
```

**Respuesta** — Objeto `Song` actualizado.

---

#### `DELETE /api/songs/:id`

Elimina una canción.

**Respuesta**
```json
{ "success": true }
```

---

#### `POST /api/songs/:id/cover`

Actualiza la portada de una canción.

**Body** — `multipart/form-data` con campo `cover`.

**Respuesta** — Objeto `Song` actualizado.

---

### Favoritos

#### `GET /api/favorites`

**Respuesta** — `string[]` con los IDs de canciones favoritas.

#### `POST /api/favorites/:id`

Agrega la canción a favoritos.

**Respuesta**
```json
{ "success": true }
```

#### `DELETE /api/favorites/:id`

Elimina la canción de favoritos.

**Respuesta**
```json
{ "success": true }
```

---

### Playlists

#### `GET /api/playlists`

Devuelve las playlists creadas por el usuario.

#### `POST /api/playlists`

Crea una nueva playlist.

**Body**
```json
{ "name": "string", "songs": ["id1", "id2"], "coverColor": "#RRGGBB" }
```

**Respuesta** — Objeto playlist creado.

#### `PUT /api/playlists/:id`

Actualiza una playlist existente.

**Body** — Cualquier combinación de campos de playlist.

**Respuesta** — Objeto playlist actualizado.

#### `DELETE /api/playlists/:id`

```json
{ "success": true }
```

---

#### `GET /api/folderplaylists`

Devuelve playlists generadas automáticamente desde la carpeta `playlist/`.

#### `POST /api/folderplaylists/sync`

Sincroniza las playlists de carpeta.

**Respuesta**
```json
{ "success": true, "count": 12 }
```

---

### Sincronización

#### `POST /api/sync`

Escanea `servidor/canciones/` y actualiza el inventario de la base de datos. Útil al añadir archivos directamente al sistema de archivos.

**Respuesta**
```json
{ "success": true, "added": 3, "removed": 1, "total": 42 }
```

---

#### `POST /api/recalculate-durations`

Recalcula la duración de canciones que no la tienen registrada.

**Respuesta**
```json
{ "success": true, "updated": 2 }
```

---

#### `POST /api/refresh-covers`

Empareja por nombre de archivo las carátulas dejadas manualmente en `servidor/portadas/` con canciones que ya existían en la biblioteca (subidas o sincronizadas antes de colocar la imagen). Las canciones nuevas a partir de ahora recogen su carátula sola si el nombre coincide, sin necesitar esta llamada.

**Respuesta**
```json
{ "success": true, "updatedLibrary": 5, "matchedInPlaylists": 12, "updated": 17 }
```

---

### Monitoreo y estadísticas

#### `POST /api/heartbeat`

Informa del estado de reproducción del cliente. Mantiene el conteo de oyentes activos, actualiza las estadísticas de escucha del usuario y evalúa si se desbloquea algún logro nuevo.

**Body**
```json
{
  "songId": "uuid?",
  "isPlaying": true,
  "elapsedMs": 12400,
  "playlistId": "uuid?",
  "playlistType": "manual"
}
```

`playlistId` y `playlistType` son **opcionales** (compatibles con clientes antiguos que no los manden). Si se incluyen mientras suena una canción de esa playlist, se registra para las estadísticas de "playlist más escuchada". `playlistType` acepta `"manual"` (playlist creada por el usuario, por defecto) o `"folder"` (colección automática de `playlist/`).

**Respuesta**
```json
{
  "activeListeners": 3,
  "newAchievements": [
    { "id": "songs_played_3", "icon": "note", "title": "Reproductor Oro", "description": "Reproduce 25 canciones en total." }
  ],
  "warning": "Estás mandando peticiones muy seguido..."
}
```

`newAchievements` casi siempre es un array vacío `[]`; sólo trae contenido en el heartbeat exacto donde se desbloquea un logro nuevo, para que el cliente pueda mostrar una notificación sin hacer polling aparte. `warning` normalmente no aparece en la respuesta; solo se incluye cuando este usuario se está acercando al límite de peticiones (ver [Rate limiting / protección anti-spam](#rate-limiting--protección-anti-spam)), como aviso antes de un bloqueo real.

---

#### `POST /api/latency`

Reporta la latencia del cliente.

**Body**
```json
{ "latencyMs": 42 }
```

**Respuesta**
```json
{ "ok": true }
```

---

#### `GET /api/listeners`

Devuelve el número actual de oyentes activos.

**Respuesta**
```json
{ "count": 4 }
```

---

### Logros

#### `GET /api/achievements`

Devuelve el catálogo completo de logros activos junto con el estado de desbloqueo y el progreso actual del usuario autenticado.

**Respuesta**
```json
[
  {
    "id": "songs_played_3",
    "icon": "note",
    "title": "Reproductor Oro",
    "description": "Reproduce 25 canciones en total.",
    "category": "listening",
    "threshold": 25,
    "clientReported": false,
    "unlocked": true,
    "unlockedAt": "2026-06-01T10:00:00.000Z",
    "progress": 25
  }
]
```

`progress` está siempre acotado entre `0` y `threshold`, así que sirve directamente para pintar una barra de progreso (`progress / threshold`).

---

#### `POST /api/achievements/:id/claim`

Reclama manualmente un logro marcado como `clientReported` en el catálogo (cosas que sólo el cliente puede saber, como una descarga offline). Para logros normales (evaluados con datos del servidor) esta ruta devuelve error: no sirve para "hacer trampa".

**Respuesta (éxito)**
```json
{ "ok": true, "alreadyUnlocked": false, "achievement": { "id": "offline_first", "...": "..." } }
```

**Respuesta (logro no reclamable o inexistente)**
```json
{ "ok": false, "error": "Logro no reclamable" }
```

---

### Estadísticas personales

#### `GET /api/stats/me`

Devuelve las estadísticas de escucha del usuario autenticado.

**Respuesta**
```json
{
  "totalListeningSeconds": 45230,
  "totalHours": 12.6,
  "totalSongsPlayed": 312,
  "currentStreak": 5,
  "dailyListening": [
    { "date": "2026-06-10", "seconds": 1800 },
    { "date": "2026-06-11", "seconds": 2400 }
  ],
  "mostPlayedSong": { "id": "...", "title": "...", "artist": "...", "playCount": 42 },
  "mostPlayedPlaylist": { "id": "...", "type": "manual", "name": "...", "playCount": 12 }
}
```

`dailyListening` cubre los últimos 30 días. `mostPlayedSong` y `mostPlayedPlaylist` son `null` si el usuario todavía no tiene reproducciones registradas. `currentStreak` son los días consecutivos con algo de escucha (no se rompe sólo porque hoy aún no hayas abierto la app).

---

#### `GET /api/stats`

> Requiere autenticación web (`web_token`), no JWT móvil.

Devuelve métricas de uso y latencia.

---

#### `GET /api/status`

No requiere autenticación. Métricas generales del servidor, equivalente al `GET /status` global (ver [Rutas globales](#rutas-globales)) pero bajo el prefijo `/api`.

**Respuesta**
```json
{ "songs": 123, "playlists": 12, "users": 5, "activeListeners": 2, "status": "OK" }
```

---

## API PC `/pc/`

Todos los endpoints requieren `Authorization: Bearer <token>`. También acepta la cookie `pc_token`.

---

### Autenticación

#### `POST /pc/login`

**Body**
```json
{ "username": "string", "password": "string" }
```

**Respuesta**
```json
{ "token": "...", "username": "user", "id": "uuid" }
```

#### `GET /pc/verify`

```json
{ "valid": true, "username": "user", "id": "uuid" }
```

---

### Versiones y changelog

#### `GET /pc/version`

```json
{ "version": "1.0.0", "exeUrl": "https://..." }
```

#### `GET /pc/changelog`

```json
{ "version": "1.0.1", "notes": "..." }
```

---

### Canciones

#### `GET /pc/songs`

Acepta `?search=query`. Devuelve array de canciones.

#### `GET /pc/mysongs`

Canciones asociadas al usuario PC. Devuelve array de canciones.

---

### Favoritos

#### `GET /pc/favorites`

Devuelve array de IDs de canciones favoritas.

#### `POST /pc/favorites/:id`

```json
{ "success": true }
```

#### `DELETE /pc/favorites/:id`

```json
{ "success": true }
```

---

### Playlists

#### `GET /pc/playlists`

Devuelve array de playlists del usuario.

#### `POST /pc/playlists`

**Body**
```json
{ "name": "string", "songs": [], "coverColor": "#RRGGBB" }
```

**Respuesta** — Objeto playlist creado.

#### `PUT /pc/playlists/:id`

**Body**
```json
{ "name": "string?", "songs": []?, "coverColor": "string?" }
```

**Respuesta** — Objeto playlist actualizado.

#### `DELETE /pc/playlists/:id`

```json
{ "success": true }
```

---

#### `GET /pc/folderplaylists`

Playlists automáticas desde las carpetas sincronizadas en el servidor.

#### `POST /pc/folderplaylists/sync`

```json
{ "success": true, "count": 12 }
```

---

### Telemetría

#### `POST /pc/heartbeat`

**Body**
```json
{
  "songId": "uuid",
  "isPlaying": true,
  "elapsedMs": 12400,
  "playlistId": "uuid?",
  "playlistType": "manual"
}
```

`playlistId`/`playlistType` opcionales, igual que en `/api/heartbeat` (ver esa sección para el detalle).

**Respuesta**
```json
{
  "activeListeners": 2,
  "newAchievements": [{ "id": "...", "icon": "note", "title": "...", "description": "..." }],
  "warning": "Estás mandando peticiones muy seguido..."
}
```

`warning` solo aparece cuando este usuario se está acercando al límite de peticiones (ver [Rate limiting / protección anti-spam](#rate-limiting--protección-anti-spam)).

#### `POST /pc/latency`

**Body**
```json
{ "latencyMs": 42 }
```

**Respuesta**
```json
{ "ok": true }
```

#### `GET /pc/status`

```json
{ "songs": 123, "playlists": 12, "users": 5, "activeListeners": 2, "status": "OK" }
```

---

#### `POST /pc/refresh-covers`

Igual que `POST /api/refresh-covers` (ver esa sección en la API móvil): empareja por nombre de archivo las carátulas de `servidor/portadas/` con canciones que ya existían en la biblioteca.

**Respuesta**
```json
{ "success": true, "updatedLibrary": 5, "matchedInPlaylists": 12, "updated": 17 }
```

---

#### `GET /pc/ping`

```json
{ "pong": 1681234567890 }
```

---

### Logros y estadísticas (PC)

Idénticos a sus equivalentes de la API móvil (ver [Logros](#logros) y [Estadísticas personales](#estadísticas-personales) más arriba), sólo que autenticados con el token de PC:

- `GET /pc/achievements`
- `POST /pc/achievements/:id/claim`
- `GET /pc/stats/me`

---

## API Web `/web/`

Todos los endpoints requieren la cookie `web_token` salvo `/web/login`.

---

### Autenticación

#### `POST /web/login`

**Body**
```json
{ "username": "string", "password": "string" }
```

**Respuesta**
```json
{ "success": true, "username": "admin" }
```

Establece la cookie `web_token` (HttpOnly, duración 3 días).

#### `POST /web/logout`

```json
{ "success": true }
```

#### `GET /web/me`

```json
{ "username": "admin", "role": "superadmin" }
```

---

### Versiones

#### `GET /web/version`

Devuelve el contenido completo de `version.json`.

#### `PUT /web/version`

**Body**
```json
{ "version": "1.0.2" }
```

Actualiza `data/version.json`.

---

### Usuarios

#### `GET /web/users`

Devuelve la lista de usuarios.

#### `POST /web/users`

> Requiere rol `superadmin`.

**Body**
```json
{ "username": "string", "password": "string" }
```

#### `DELETE /web/users/:id`

> Requiere rol `superadmin`.

---

### Claves de bot

Todos los endpoints de esta sección requieren rol `superadmin`.

#### `GET /web/bot-keys`

Devuelve lista de claves de bot y métricas de uso.

#### `POST /web/bot-keys`

Crea una nueva clave de bot.

**Body**
```json
{ "name": "string" }
```

**Respuesta** — Objeto con la nueva clave y su valor secreto.

#### `PUT /web/bot-keys/:id`

Actualiza metadatos de la clave.

**Body**
```json
{ "name": "string?", "active": true }
```

#### `POST /web/bot-keys/:id/reset`

Genera una nueva clave secreta para el bot. La clave anterior queda invalidada.

**Respuesta**
```json
{ "apiKey": "nueva_clave_secreta" }
```

#### `DELETE /web/bot-keys/:id`

Elimina la clave permanentemente.

---

### Logros (catálogo)

Lectura disponible para cualquier usuario web autenticado. Crear, editar y borrar requiere rol `superadmin`.

#### `GET /web/achievements`

Devuelve el catálogo **completo** (incluye logros inactivos), para gestionarlo desde el panel.

#### `POST /web/achievements`

> Requiere rol `superadmin`.

Crea un logro nuevo.

**Body**
```json
{
  "id": "mi_logro_custom",
  "icon": "guitar",
  "title": "Rockstar",
  "description": "Sube 10 canciones de rock.",
  "category": "library",
  "metric": "songs_uploaded",
  "threshold": 10,
  "clientReported": false,
  "active": true,
  "sortOrder": 999
}
```

`id` es opcional (si no se manda, se genera a partir del título). `metric` debe ser una de las métricas soportadas por el motor de logros (ver la tabla de métricas en el [README](./README.md#logros-y-estadísticas-por-usuario)), o `client_reported` si el logro se va a desbloquear a mano desde el cliente.

**Respuesta** — Objeto del logro creado.

#### `PUT /web/achievements/:id`

> Requiere rol `superadmin`.

Actualiza cualquier combinación de campos de un logro existente (mismos campos que en la creación).

#### `DELETE /web/achievements/:id`

> Requiere rol `superadmin`.

Elimina el logro del catálogo (y sus desbloqueos asociados, por `ON DELETE CASCADE`).

---

### Estadísticas de un usuario (soporte/admin)

#### `GET /web/users/:id/stats`

Estadísticas de escucha y progreso de logros de un usuario concreto, útil para soporte o revisión desde el panel.

**Respuesta**
```json
{
  "totalListeningSeconds": 45230,
  "totalHours": 12.6,
  "totalSongsPlayed": 312,
  "currentStreak": 5,
  "mostPlayedSong": { "id": "...", "title": "...", "artist": "...", "playCount": 42 },
  "mostPlayedPlaylist": { "id": "...", "type": "manual", "name": "...", "playCount": 12 },
  "achievementsUnlocked": 18,
  "achievementsTotal": 100
}
```

---

### Descarga

#### `GET /app.apk`

Descarga el APK de la app Android si está disponible en el servidor.

---

## API Bot `/bot/`

Todos los endpoints requieren el header `X-Bot-Key: <clave>`.

Las claves se validan contra la tabla `bot_api_keys`. Si no existe ninguna clave en la base de datos, se acepta la clave legacy definida en la variable de entorno `BOT_API_KEY`.

---

#### `GET /bot/songs`

Acepta `?search=query`. Devuelve array de canciones.

---

#### `GET /bot/playlists`

**Respuesta**
```json
[
  {
    "id": "uuid",
    "name": "Playlist Name",
    "songCount": 10,
    "coverUrl": "https://..."
  }
]
```

---

#### `GET /bot/playlists/:name/songs`

Devuelve el array de canciones de la playlist indicada por nombre.

---

#### `GET /bot/random-playlist`

Devuelve un objeto playlist completo seleccionado al azar.

---

#### `POST /bot/sync`

Sincroniza las playlists de carpeta.

**Respuesta**
```json
{ "success": true, "count": 12 }
```

---

#### `GET /bot/stats`

```json
{ "totalSongs": 123, "totalPlaylists": 12 }
```

---

## Rate limiting / protección anti-spam

Todas las rutas están protegidas contra flood/spam mediante limitadores en memoria (sin tablas MySQL; ver el porqué en el [README](./README.md#protección-anti-spam--rate-limiting)). Si se supera el límite, el servidor responde `429 Too Many Requests` con cabecera `Retry-After`. Si una misma clave (usuario, clave de bot o IP) insiste repetidamente, se le aplica un bloqueo temporal (`403 Forbidden`) que se alarga si reincide.

| Ruta | Ventana | Máximo |
|---|---|---|
| `/api/login`, `/pc/login`, `/web/login` | 15 min | 15 intentos |
| `/api/heartbeat`, `/api/latency`, `/pc/heartbeat`, `/pc/latency` | 10 s | 60 peticiones |
| Resto de `/api/*` | 60 s | 180 peticiones |
| `/api/upload` (además del límite anterior) | 60 s | 20 peticiones |
| Resto de `/pc/*` | 60 s | 180 peticiones |
| `/web/*` | 60 s | 240 peticiones |
| `/bot/*` | 60 s | 240 peticiones |
| Cualquier ruta (backstop global por IP) | 60 s | 400 peticiones |

El límite de heartbeat es deliberadamente generoso para no penalizar a usuarios que cambian de canción o pausan/reanudan muy seguido; sólo se activa ante tráfico claramente anómalo (varias peticiones por segundo sostenidas).

Antes del bloqueo real, `/api/heartbeat`, `/pc/heartbeat` y el resto de `/api/*`/`/pc/*` mandan un aviso amistoso: al llegar al 70-75% del límite dentro de la misma ventana de tiempo, la petición se sirve con normalidad pero la respuesta incluye un campo `warning` (texto) para que el cliente muestre una notificación de "vas muy rápido" antes de que llegue el `429`. Se manda como mucho una vez por ventana y por clave. Detalle completo de la implementación en el [README](./README.md#protección-anti-spam--rate-limiting).

---

## Notas técnicas

| Aspecto | Detalle |
|---|---|
| **Persistencia principal** | MySQL |
| **Archivos JSON en disco** | `data/version.json` · `data/actualizacion.json` |
| **Autenticación `/api/` y `/pc/`** | JWT con secreto por plataforma definido en `.env` |
| **Autenticación `/web/`** | Cookie `web_token` HttpOnly |
| **Autenticación `/bot/`** | Header `X-Bot-Key` validado contra BD; fallback a `BOT_API_KEY` env |
| **Escaneo manual de canciones** | `POST /api/sync` tras añadir archivos a `servidor/canciones/` |
| **Logros** | Catálogo editable en `achievements` (MySQL), sembrado con 100 logros base. Ver [README](./README.md#logros-y-estadísticas-por-usuario) |
| **Estadísticas por usuario** | Tablas `user_listening_stats`, `user_daily_listening`, `user_song_plays`, `user_playlist_plays`. Ver [README](./README.md#logros-y-estadísticas-por-usuario) |
| **Rate limiting** | En memoria del proceso Node, ver sección anterior y `lib/rateLimit.js` |