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

### Monitoreo y estadísticas

#### `POST /api/heartbeat`

Informa del estado de reproducción del cliente. Mantiene el conteo de oyentes activos.

**Body**
```json
{ "songId": "uuid?", "isPlaying": true, "elapsedMs": 12400 }
```

**Respuesta**
```json
{ "activeListeners": 3 }
```

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

#### `GET /api/stats`

> ⚠️ Requiere autenticación web (`web_token`), no JWT móvil.

Devuelve métricas de uso y latencia.

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
{ "songId": "uuid", "isPlaying": true, "elapsedMs": 12400 }
```

**Respuesta**
```json
{ "activeListeners": 2 }
```

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

#### `GET /pc/ping`

```json
{ "pong": 1681234567890 }
```

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

> 🔒 Requiere rol `superadmin`.

**Body**
```json
{ "username": "string", "password": "string" }
```

#### `DELETE /web/users/:id`

> 🔒 Requiere rol `superadmin`.

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

## Notas técnicas

| Aspecto | Detalle |
|---|---|
| **Persistencia principal** | MySQL |
| **Archivos JSON en disco** | `data/version.json` · `data/actualizacion.json` |
| **Autenticación `/api/` y `/pc/`** | JWT con secreto por plataforma definido en `.env` |
| **Autenticación `/web/`** | Cookie `web_token` HttpOnly |
| **Autenticación `/bot/`** | Header `X-Bot-Key` validado contra BD; fallback a `BOT_API_KEY` env |
| **Escaneo manual de canciones** | `POST /api/sync` tras añadir archivos a `servidor/canciones/` |