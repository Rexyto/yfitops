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
- [Rate limiting y protección anti-spam](#rate-limiting-y-protección-anti-spam)
- [Rutas no disponibles](#rutas-no-disponibles)

---

## Base URL

```
http://localhost:6666
```

Usa la URL HTTPS de la instalación. `http://localhost:6666` solo sirve como ejemplo local. Las rutas que no sean API pueden devolver la web; no asumas que todas las respuestas de error tienen el mismo formato JSON.

---

## Autenticación

Cada plataforma usa su propio mecanismo de autenticación. Los tokens de `/api`, `/pc` y `/web` no son intercambiables.

| Plataforma | Prefijo | Método | Header / Cookie |
|---|---|---|---|
| Móvil | `/api/` | JWT Bearer | `Authorization: Bearer <token>` |
| PC | `/pc/` | JWT Bearer o Cookie | `Authorization: Bearer <token>` · Cookie: `pc_token` |
| Web | `/web/` | Cookie | Cookie: `web_token` (duración 3 días) |
| Bot | `/bot/` | API Key | `X-Bot-Key: <clave>` |

`POST /pc/login` devuelve el JWT en el cuerpo y no establece por sí mismo la cookie `pc_token`; la cookie solo es una alternativa aceptada por el middleware si el cliente la establece. El panel web usa `web_token`, `HttpOnly`, `SameSite=Lax`, duración de 3 días y no marca la cookie `Secure`. En peticiones cross-origin del navegador hay que enviar credenciales (`credentials: 'include'`); el servidor refleja el origen y permite credenciales. Una cookie `SameSite=Lax` no se envía en todas las solicitudes cross-site; el frontend y API deben estar en un contexto compatible con esa política. Usa HTTPS para proteger la sesión en tránsito.

Los permisos se indican en cada grupo. Las rutas administrativas que lo requieren responden `403` si la cuenta no tiene permisos.

### Guía rápida para clientes

No hay endpoints públicos de registro: `/api/login`, `/pc/login` y `/web/login` autentican cuentas ya creadas por el operador del servidor.

Los ejemplos usan JSON UTF-8 y la raíz del servidor como origen. Sustituye `https://tu-servidor.example` por tu URL real. Las apps móviles/de PC deben usar su prefijo de API de forma consistente: los JWT de `/api` y `/pc` usan secretos distintos, por lo que no son intercambiables.

```bash
BASE_URL="https://tu-servidor.example"
curl -i "$BASE_URL/api/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"usuario","password":"contraseña"}'

curl -i "$BASE_URL/api/songs?search=artista" \
  -H 'Authorization: Bearer <token-devuelto-por-login>'
```

Para endpoints JSON con cuerpo, envía `Content-Type: application/json`; el límite del cuerpo JSON es 100 KiB. El servidor no parsea `application/x-www-form-urlencoded`. Para subir archivos, usa `multipart/form-data` con el nombre de campo indicado en el endpoint y deja que la herramienta HTTP genere el boundary. Las respuestas de error no tienen un formato global uniforme; consulta los status documentados por endpoint y conserva el cuerpo de error recibido.

Los valores `url` y `coverUrl` de canción/playlist son rutas relativas al origen, no URLs absolutas. Resuélvelas contra `BASE_URL` (por ejemplo, `/canciones/archivo.mp3`). Los endpoints de medios estáticos no requieren token:

| Ruta pública | Contenido |
|---|---|
| `GET /canciones/:archivo` | Audio de biblioteca y portadas derivadas de metadatos/subidas |
| `GET /playlist/:carpeta/:archivo` | Audio y portadas de una playlist de carpeta |
| `GET /portadas/:archivo` | Carátulas personalizadas; puede incluir subdirectorios como `admin-playlists/` |
| `GET /downloads/:archivo` | Descargas estáticas publicadas por el servidor |

`GET /app.apk` es distinto: requiere la cookie `web_token` y descarga el APK configurado en el servidor. No hay una API paginada ni un parámetro `limit`/`offset`; las rutas de listado devuelven el conjunto completo.

### Formatos comunes

#### Canción de biblioteca (`Song`)
```json
{
  "id": "1712345678901",
  "title": "Título",
  "artist": "Artista",
  "album": "Álbum",
  "duration": 213.4,
  "filename": "1712345678901-cancion.mp3",
  "url": "/canciones/1712345678901-cancion.mp3",
  "coverUrl": "/canciones/1712345678901.jpg",
  "uploadDate": "2026-09-26T10:00:00.000Z"
}
```

`coverUrl` puede ser `null`; `duration` se expresa en segundos. `uploadDate` es una fecha serializada como texto. Una canción dentro de una playlist de carpeta usa los mismos campos principales pero no siempre incluye `uploadDate`.

#### Playlist manual (`Playlist`)
```json
{
  "id": "id-generado-por-el-servidor",
  "name": "Favoritas",
  "songs": ["1712345678901"],
  "coverColor": "#1DB954",
  "coverUrl": null,
  "userId": "uuid-del-usuario",
  "createdAt": "2026-09-26T10:00:00.000Z"
}
```

En playlists manuales, `songs` es un array de IDs tanto al enviar como al recibir. `coverUrl` puede faltar en datos antiguos. Las playlists de carpeta tienen `id`, `name`, `folderName`, `songs` (objetos Song), `coverUrl`, `totalDuration`, `source`, `createdAt` y `updatedAt`; su ID no tiene formato contractual UUID.

**Errores de autenticación y rate limit**

| Status | Significado habitual |
|---|---|
| `400` | Faltan campos, archivo obligatorio ausente o reclamo de logro no válido |
| `401` | Falta token/clave, credenciales incorrectas o token inválido/expirado |
| `403` | Rol insuficiente, clave de bot inactiva o bloqueo temporal por rate limit |
| `404` | Recurso no encontrado en rutas que comprueban existencia |
| `409` | Nombre de usuario duplicado o canción repetida donde se valida |
| `429` | Límite de solicitudes superado; puede incluir `Retry-After` en segundos |
| `500` | Error interno; la forma del cuerpo de error depende de la ruta |

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

`GET /status` y `GET /api/status` son públicos. `status: "OK"` indica que la ruta respondió; no es una comprobación completa de todos los servicios.

---

## API Móvil `/api/`

Las rutas privadas requieren `Authorization: Bearer <token>` salvo el login. Excepciones: `GET /api/status` es público y `GET /api/stats` usa la cookie web y exige rol `superadmin`.

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

El token expira en 30 días. `400` si faltan username/password; `401` si las credenciales no coinciden; `429` si se excede el rate limit. No hay refresh token ni endpoint para registrar usuario.

---

#### `GET /api/verify`

Valida el token actual.

**Respuesta**
```json
{ "valid": true, "username": "user", "id": "uuid" }
```

`401` si falta `Authorization` o el token está mal formado, vencido o firmado con otro secreto.

---

### Información

#### `GET /api/version`

```json
{ "version": "1.0.0", "apkUrl": "https://..." }
```

Devuelve toda la configuración de versiones; puede contener también `pc`. Requiere JWT móvil. Si no hay configuración, los valores por defecto son `{ "version": "1.0.0", "apkUrl": "" }`.

#### `GET /api/changelog`

```json
{ "version": "1.0.1", "notes": "..." }
```

Devuelve el objeto completo de notas de actualización, requiere JWT móvil y usa valores vacíos si no hay configuración.

#### `GET /api/ping`

```json
{ "pong": 1681234567890 }
```

`pong` es la hora Unix actual en milisegundos. Requiere JWT móvil.

---

### Canciones

#### `GET /api/songs`

Devuelve las canciones de la biblioteca principal. Acepta `?search=query`; filtra por título y artista (no por álbum).

**Respuesta** — Array de objetos canción con `id`, `title`, `artist`, `album`, `duration`, `filename`, `url`, `coverUrl` y `uploadDate`.

---

#### `GET /api/mysongs`

Devuelve las canciones guardadas por el usuario autenticado.

**Respuesta** — Array de objetos `Song`.

Solo incluye IDs del array `users.songs` que también estén en la biblioteca principal; las canciones que existen únicamente en playlists de carpeta no aparecen. Si el usuario autenticado ya no existe en BD, responde `404`.

---

#### `POST /api/upload`

Sube un archivo de audio.

**Body** — `multipart/form-data` con campo `audio`. Extensiones admitidas: `.mp3`, `.m4a`, `.wav`, `.flac` y `.ogg`. El servidor extrae metadatos/duración, asocia la canción al usuario y evalúa sus logros. No hay límite de tamaño configurado para esta subida.

**Respuesta** — Objeto `Song`. Si ya hay una canción con el mismo nombre de archivo, responde con la canción existente. Si falta el archivo, devuelve `400`.

No hay límite de tamaño configurado para esta subida. Si el tipo de archivo no es aceptado, la respuesta de error depende del servidor.

---

#### `PUT /api/songs/:id`

Edita los metadatos de una canción.

**Body**
```json
{ "title": "string?", "artist": "string?", "album": "string?" }
```

**Respuesta** — Objeto `Song` actualizado.

`404` si la canción no existe. Cualquier usuario con JWT móvil puede editar canciones globales; los campos no se validan por tipo.

---

#### `DELETE /api/songs/:id`

Elimina una canción.

También quita su ID de favoritos y de la lista de canciones subidas de todos los usuarios. No elimina ese ID de playlists manuales.

**Respuesta**
```json
{ "success": true }
```

`404` si la canción no existe. La eliminación limpia también favoritos y asociaciones `users.songs` de todos los usuarios.

---

#### `POST /api/songs/:id/cover`

Actualiza la portada de una canción.

**Body** — `multipart/form-data` con campo `cover` (PNG, JPG, JPEG o WEBP; máximo 8 MiB). El servidor convierte la imagen a WebP (máximo 1200 px por lado), la guarda en `portadas/` como `Título - Artista.webp` y actualiza `coverUrl`, para que canciones con el mismo título y artista puedan reutilizarla. Requiere `ffmpeg`; si la conversión falla, responde `500` y conserva la portada anterior.

**Respuesta** — Objeto `Song` actualizado.

Responde `400` si falta el archivo y `404` si no existe la canción. No valida el contenido real de la imagen ni limita su tamaño.

---

### Favoritos

#### `GET /api/favorites`

**Respuesta** — `string[]` con los IDs de canciones favoritas.

Si no se encuentra el usuario en la consulta, responde `[]`.

#### `POST /api/favorites/:id`

Agrega la canción a favoritos.

**Respuesta**
```json
{ "success": true }
```

No valida que el ID corresponda a una canción existente. `404` solo si no existe la cuenta autenticada.

#### `DELETE /api/favorites/:id`

Elimina la canción de favoritos.

**Respuesta**
```json
{ "success": true }
```

`404` si no se encuentra la cuenta; eliminar un ID que no estaba en favoritos es idempotente.

---

### Playlists

#### `GET /api/playlists`

Devuelve las playlists creadas por el usuario.

#### `POST /api/playlists`

Crea una playlist propiedad del usuario autenticado. La ruta no valida que `name` sea no vacío ni comprueba que los IDs de `songs` existan.

**Body**
```json
{ "name": "string", "songs": ["id1", "id2"], "coverColor": "#RRGGBB" }
```

**Respuesta** — Objeto playlist creado.

En `/api`, `id` se genera con `Date.now().toString()` (no es UUID) y `createdAt` es ISO 8601. El cliente debe mandar `songs` como un array de IDs; el servidor no comprueba que existan. `name` se debería mandar como string no vacío y `coverColor` como color CSS, aunque la ruta no los valida.

#### `PUT /api/playlists/:id`

Actualiza una playlist existente.

**Body** — JSON con cualquier combinación de `name`, `songs`, `coverColor` o `coverUrl`. La ruta fija `id` y `userId` al recurso/usuario autenticado, aunque se envíen en el cuerpo.

**Respuesta** — Objeto playlist actualizado.

`404` si no existe o pertenece a otra cuenta.

#### `DELETE /api/playlists/:id`

```json
{ "success": true }
```

La respuesta es `{ "success": true }` aunque el ID no exista o la playlist pertenezca a otro usuario.

---

#### `GET /api/folderplaylists`

Devuelve playlists de carpeta generadas automáticamente. Cada elemento contiene `id`, `name`, `folderName`, `songs`, `coverUrl`, `totalDuration`, `source`, `createdAt` y `updatedAt`; cada elemento de `songs` es un objeto canción.

#### `POST /api/folderplaylists/sync`

Sincroniza las playlists de carpeta.

**Respuesta**
```json
{ "success": true, "count": 12 }
```

La sincronización actualiza el inventario de playlists de carpeta a partir de las colecciones disponibles en el servidor. No crea colecciones ni sube audio.

---

### Sincronización

#### `POST /api/sync`

Vuelve a sincronizar la biblioteca de canciones con el contenido disponible en el servidor.

**Respuesta**
```json
{ "success": true, "added": 3, "removed": 1, "total": 42 }
```

`removed` cuenta filas quitadas del inventario porque ya no tienen un archivo de audio coincidente. El endpoint no elimina playlists manuales ni archivos físicos.

---

#### `POST /api/recalculate-durations`

Recalcula la duración de canciones que no la tienen registrada.

**Respuesta**
```json
{ "success": true, "updated": 2 }
```

Solo recalcula canciones cuya duración sea cero, nula o menor que un segundo.

---

#### `POST /api/refresh-covers`

Actualiza las carátulas personalizadas de canciones de biblioteca y playlists de carpeta. Puede usarse después de cambiar carátulas en el servidor.

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

`songId` puede ser `null` al detener la reproducción; `isPlaying` debe ser booleano. El cuerpo no se valida campo a campo. `elapsedMs` debe ser el tiempo transcurrido desde el heartbeat anterior, no la posición total de la canción. Solo se acumula si es un número mayor que `0` y menor que `7.200.000`; se redondea a segundos. El servidor lo suma incluso si `isPlaying` es `false`, así que envía `0` cuando el intervalo fue una pausa. Una canción cuenta como nueva reproducción cuando `isPlaying` es verdadero y el `songId` difiere del último heartbeat conocido para ese usuario. Pausar/reanudar la misma canción no vuelve a incrementar reproducciones.

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

`newAchievements` casi siempre es un array vacío `[]`; sólo trae contenido en el heartbeat exacto donde se desbloquea un logro nuevo, para que el cliente pueda mostrar una notificación sin hacer polling aparte. `warning` normalmente no aparece en la respuesta; solo se incluye cuando este usuario se está acercando al límite de peticiones (ver [Rate limiting y protección anti-spam](#rate-limiting-y-protección-anti-spam)), como aviso antes de un bloqueo real.

`activeListeners` cuenta cuentas con un `songId` recibido en los últimos 180 segundos; un estado pausado con `songId` también cuenta durante ese intervalo. Es un conteo de cuentas, no de conexiones/dispositivos.

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

Solo registra `latencyMs` si es un número mayor que `0` y menor que `30000`. Los valores fuera de ese rango se ignoran y responden igualmente `200` con `{ "ok": true }`.

Solo registra `latencyMs` si es un número entre `1` y `29999` milisegundos. Un valor fuera de ese rango se ignora y aun así responde `{ "ok": true }`.

---

#### `GET /api/listeners`

Devuelve el número de cuentas con un heartbeat que incluía `songId` en los últimos 120 segundos. No cuenta conexiones individuales.

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

El reclamo no válido responde `400`; si ocurre un error al procesarlo, responde `500`.

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

`dailyListening` consulta desde la fecha de hace 30 días hasta hoy, por lo que puede incluir hasta 31 fechas contando ambos extremos. `mostPlayedSong` y `mostPlayedPlaylist` son `null` si el usuario todavía no tiene reproducciones registradas. `currentStreak` son los días consecutivos con algo de escucha (no se rompe sólo porque hoy aún no hayas abierto la app).

---

#### `GET /api/stats`

> Requiere cookie web válida (`web_token`) y rol `superadmin`, no JWT móvil.

Devuelve totales globales y muestras recientes de latencia/procesamiento.

**Respuesta**
```json
{
  "totalHours": 12.6,
  "totalListeningSeconds": 45230,
  "totalSongsPlayed": 312,
  "avgLatencyMs": 42,
  "latencySamples": [40, 42],
  "avgProcessingMs": 1200,
  "processingTimes": [1000, 1400],
  "dailyChart": [{ "date": "2026-09-26", "seconds": 1800 }]
}
```

`dailyChart` contiene los últimos 7 días.

`401` si falta o expiró `web_token`; `403` si la sesión no tiene rol `superadmin`.

---

#### `GET /api/status`

No requiere autenticación. Métricas generales del servidor, equivalente al `GET /status` global (ver [Rutas globales](#rutas-globales)) pero bajo el prefijo `/api`.

**Respuesta**
```json
{ "songs": 123, "playlists": 12, "users": 5, "activeListeners": 2, "status": "OK" }
```

`songs` suma biblioteca principal y canciones de playlists de carpeta; puede contar una canción más de una vez si está presente en ambas.

---

## API PC `/pc/`

Todos los endpoints salvo `POST /pc/login` requieren autenticación. Aceptan `Authorization: Bearer <token>` o la cookie `pc_token`. El login devuelve un JWT válido durante 30 días, pero no establece esa cookie.

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

El token dura 30 días y solo autentica rutas `/pc/*`. `400` si faltan campos, `401` si las credenciales no coinciden y `500` ante error de servidor.

#### `GET /pc/verify`

```json
{ "valid": true, "username": "user", "id": "uuid" }
```

`401` si falta el token o no es válido.

---

### Versiones y changelog

#### `GET /pc/version`

```json
{ "version": "1.0.0", "exeUrl": "https://..." }
```

Devuelve el objeto de versión PC configurado; si no está definido, los campos son `version: "1.0.0"` y `exeUrl: ""`.

#### `GET /pc/changelog`

```json
{ "version": "1.0.1", "notes": "..." }
```

Devuelve las notas PC configuradas; si no existen, responde `{ "version": "1.0.0", "notes": "" }`.

---

### Canciones

#### `GET /pc/songs`

Acepta `?search=query`, buscando sin distinguir mayúsculas en título, artista y álbum. Devuelve un array de objetos `Song` de la biblioteca.

#### `GET /pc/mysongs`

Canciones asociadas al usuario PC. Devuelve array de canciones.

Las canciones personales se resuelven desde `users.songs` y se filtran contra la biblioteca principal, no contra playlists de carpeta.

Devuelve `404` si no se encuentra la cuenta autenticada y `500` ante error de servidor.

---

### Favoritos

#### `GET /pc/favorites`

Devuelve array de IDs de canciones favoritas.

#### `POST /pc/favorites/:id`

```json
{ "success": true }
```

Agregar un ID repetido es idempotente. `404` si no se encuentra la cuenta autenticada; no valida que el ID pertenezca a una canción existente.

#### `DELETE /pc/favorites/:id`

```json
{ "success": true }
```

Eliminar un ID ausente no produce error. `404` si no se encuentra la cuenta autenticada.

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

El servidor genera un ID UUID, usa `Mi Playlist`, `[]` y `#1DB954` como valores por defecto para `name`, `songs` y `coverColor`. `songs` es una lista de IDs; `createdAt` se devuelve como fecha.

#### `PUT /pc/playlists/:id`

**Body**
```json
{ "name": "string?", "songs": []?, "coverColor": "string?" }
```

Acepta una combinación de campos de playlist. El servidor conserva el ID y el propietario originales. `404` si no existe o pertenece a otro usuario.

**Respuesta** — Objeto playlist actualizado.

#### `DELETE /pc/playlists/:id`

```json
{ "success": true }
```

La respuesta no confirma si se encontró una playlist propiedad del usuario; un ID inexistente o ajeno también devuelve éxito.

---

#### `GET /pc/folderplaylists`

Devuelve playlists automáticas, cada una con `id`, `name`, `folderName`, `songs` (objetos Song), `coverUrl`, `totalDuration` en segundos, `source`, `createdAt` y `updatedAt`.

#### `POST /pc/folderplaylists/sync`

```json
{ "success": true, "count": 12 }
```

No hay endpoint PC para subir canciones ni para sincronizar la biblioteca principal.

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

`warning` solo aparece cuando este usuario se está acercando al límite de peticiones (ver [Rate limiting y protección anti-spam](#rate-limiting-y-protección-anti-spam)).

`elapsedMs` debe ser el delta desde el heartbeat anterior, no el tiempo total de la pista. Se suma solo cuando es un número entre 1 y 7.199.999, y se redondea a segundos; envía `0` durante pausas. Una reproducción nueva se cuenta al cambiar a un `songId` distinto con `isPlaying: true`; reanudar la misma canción no incrementa el total.

`activeListeners` cuenta usuarios con `songId` en un heartbeat recibido durante los últimos 180 segundos; un estado pausado con `songId` también cuenta durante ese intervalo.

#### `POST /pc/latency`

**Body**
```json
{ "latencyMs": 42 }
```

**Respuesta**
```json
{ "ok": true }
```

Solo registra `latencyMs` si es un número mayor que `0` y menor que `30000`. Los valores fuera del intervalo se ignoran y responden igualmente `200` con `{ "ok": true }`.

#### `GET /pc/status`

```json
{ "songs": 123, "playlists": 12, "users": 5, "activeListeners": 2, "status": "OK" }
```

`activeListeners` cuenta usuarios vistos en reproducción durante los últimos 120 segundos.

---

#### `POST /pc/refresh-covers`

Igual que `POST /api/refresh-covers`: actualiza carátulas personalizadas de canciones existentes.

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

#### `GET /pc/achievements`

Devuelve los logros activos y el progreso/desbloqueo del usuario autenticado. Tiene la misma estructura que [`GET /api/achievements`](#logros).

#### `POST /pc/achievements/:id/claim`

Reclama un logro activo marcado `clientReported`. Tiene el mismo contrato que [`POST /api/achievements/:id/claim`](#logros).

#### `GET /pc/stats/me`

Devuelve estadísticas personales del usuario autenticado. Tiene la misma estructura que [`GET /api/stats/me`](#estadísticas-personales).

---

## API Web `/web/`

Todos los endpoints salvo `POST /web/login` y `POST /web/logout` requieren la cookie `web_token`. La sesión expira a los 3 días. Las operaciones marcadas como administrativas requieren el rol correspondiente.

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

Establece la cookie `web_token` (HttpOnly, `SameSite=Lax`, duración 3 días). `400` si faltan credenciales; `401` si no coinciden.

#### `POST /web/logout`

```json
{ "success": true }
```

No requiere una sesión válida; elimina la cookie si existe.

#### `GET /web/me`

```json
{ "username": "admin", "role": "superadmin" }
```

`401` si falta o expiró la cookie.

---

### Versiones

#### `GET /web/version`

Devuelve el objeto completo de versión configurado, por ejemplo `{ "version": "1.0.0", "apkUrl": "...", "pc": { "version": "1.0.0", "exeUrl": "..." } }`.

Requiere cualquier sesión web autenticada.

#### `PUT /web/version`

**Body**
```json
{ "version": "1.0.2" }
```

Actualiza la versión general configurada.

Requiere cualquier sesión web autenticada; la ruta no exige rol `superadmin`.

Devuelve el objeto de versión actualizado. Si no se envía `version`, el archivo no cambia.

---

### Usuarios

#### `GET /web/users`

Devuelve `[{ "id": "...", "username": "..." }]`. Requiere sesión web, pero no rol `superadmin`.

#### `POST /web/users`

> Requiere rol `superadmin`.

**Body**
```json
{ "username": "string", "password": "string" }
```

`400` si falta algún campo; `409` si el nombre ya existe; `403` sin rol administrativo. **Respuesta `200`:** `{ "id": "uuid", "username": "..." }`.

#### `DELETE /web/users/:id`

> Requiere rol `superadmin`.

Devuelve `{ "success": true }`, `404` si no existe el usuario o `403` sin rol administrativo. Elimina también los datos asociados a esa cuenta.

---

### Estadísticas web

#### `GET /web/stats/me`

Estadísticas personales del usuario de la cookie web: mismos campos que `GET /api/stats/me` (escucha total y diaria, racha, canción y playlist más escuchadas). Requiere sesión web autenticada.

#### `GET /web/users/:id/stats`

Devuelve estadísticas y progreso de logros de un usuario. Requiere sesión web autenticada; no requiere rol administrativo.

**Respuesta**
```json
{
  "totalListeningSeconds": 45230,
  "totalHours": 12.6,
  "totalSongsPlayed": 312,
  "currentStreak": 5,
  "mostPlayedSong": null,
  "mostPlayedPlaylist": null,
  "achievementsUnlocked": 18,
  "achievementsTotal": 100
}
```

---

### Gestión administrativa de playlists

Todas las rutas de esta sección requieren rol `superadmin`. `:type` solo admite `manual` o `folder`.

#### `GET /web/admin/playlists`

Devuelve playlists manuales y de carpeta. Cada elemento incluye `type` (`manual` o `folder`), `id`, `name`, `coverUrl` y `songs`; las playlists manuales incluyen también `coverColor` y `userId`, y las de carpeta `folderName` y `source`.

#### `PUT /web/admin/playlists/:type/:id`

**Body**
```json
{ "name": "Nuevo nombre" }
```

Renombra una playlist manual. Para `folder`, renombra la colección y actualiza sus URLs asociadas. Devuelve la playlist actualizada.

#### `POST /web/admin/playlists/:type/:id/songs`

**Body** — `multipart/form-data`, campo `audio`. Añade una canción a una playlist. Acepta `.mp3`, `.m4a`, `.wav`, `.flac` y `.ogg`. Responde `201` con el objeto canción; `400` si falta el archivo, `403` sin permisos y `404` si no existe la playlist. Los errores por extensión no admitida dependen del servidor.

#### `POST /web/admin/playlists/:type/:id/cover`

**Body** — `multipart/form-data`, campo `cover` (PNG, JPG, JPEG o WEBP; máximo 8 MiB). El servidor la convierte a WebP (máximo 1200 px por lado), actualiza la portada de la playlist y devuelve la playlist. Requiere `ffmpeg`; si la conversión falla, responde `500`.

#### `PUT /web/admin/playlists/:type/:playlistId/songs/:songId`

**Body**
```json
{ "title": "Nuevo título" }
```

Actualiza el título en el objeto playlist y, para `manual`, también en la tabla `songs`.

#### `POST /web/admin/playlists/:type/:playlistId/songs/:songId/cover`

**Body** — `multipart/form-data`, campo `cover` (PNG, JPG, JPEG o WEBP; máximo 8 MiB). El servidor convierte la imagen a WebP (máximo 1200 px por lado) y sustituye la portada asociada a esa canción. Requiere `ffmpeg`; si la conversión falla, responde `500`.

#### `DELETE /web/admin/playlists/:type/:playlistId/songs/:songId`

Quita la canción de la playlist y borra el archivo de audio/portada. En playlists `manual`, también elimina la fila de `songs`.

---

### Claves de bot

Todos los endpoints de esta sección requieren rol `superadmin`.

El valor de `apiKey` se devuelve al listar, crear o resetear claves; trátalo como secreto. Si hay claves de base de datos, solo las activas autentican. Si la clave presentada no está en la tabla, el middleware también acepta `BOT_API_KEY` como clave legacy configurada en entorno.

#### `GET /web/bot-keys`

Devuelve un array de objetos `BotApiKey`:
```json
[
  {
    "id": "uuid",
    "name": "Mi bot",
    "apiKey": "clave-secreta",
    "active": true,
    "usageCount": 12,
    "avgResponseMs": 34,
    "lastResponseMs": 29,
    "lastUsedAt": "2026-09-26T10:00:00.000Z",
    "createdAt": "2026-09-01T10:00:00.000Z",
    "updatedAt": "2026-09-26T10:00:00.000Z"
  }
]
```

El campo `apiKey` se incluye también al listar; protege la respuesta como un secreto.

#### `POST /web/bot-keys`

Crea una nueva clave de bot.

**Body**
```json
{ "name": "string" }
```

**Respuesta `201`** — Objeto `BotApiKey` con `apiKey` recién generada. Guarda el valor porque es la clave que enviarás como `X-Bot-Key`.

`400` si `name` falta o está vacío; `403` sin rol administrativo.

#### `PUT /web/bot-keys/:id`

Actualiza metadatos de la clave.

**Body**
```json
{ "name": "string?", "active": true }
```

Envía al menos uno de los campos. `active` es booleano. Devuelve el objeto `BotApiKey` actualizado. `404` si no existe la clave o si no envías ningún campo modificable; `403` sin rol administrativo.

#### `POST /web/bot-keys/:id/reset`

Genera una nueva clave secreta para el bot. La clave anterior queda invalidada.

**Respuesta `200`** — Objeto `BotApiKey` con el nuevo `apiKey`; la clave anterior deja de autenticar.
```json
{
  "id": "uuid",
  "name": "Mi bot",
  "apiKey": "nueva_clave_secreta",
  "active": true,
  "usageCount": 12,
  "avgResponseMs": 34,
  "lastResponseMs": 29,
  "lastUsedAt": "2026-09-26T10:00:00.000Z",
  "createdAt": "2026-09-01T10:00:00.000Z",
  "updatedAt": "2026-09-26T10:00:00.000Z"
}
```

`404` si la clave no existe; `403` sin rol administrativo.

#### `DELETE /web/bot-keys/:id`

Elimina la clave permanentemente.

Responde `{ "success": true }`.

Responde `{ "success": true }` incluso si el ID no existía. `403` sin rol administrativo.

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

`id` es opcional (si no se manda, se genera a partir del título). Para que el logro avance, `metric` debe ser `songs_played`, `unique_songs_played`, `song_play_count`, `listening_hours`, `daily_streak`, `favorites_count`, `playlists_created`, `unique_playlists_played`, `playlist_play_count`, `songs_uploaded`, `night_hours`, `weekend_hours`, `account_age_days`, `achievements_unlocked`, `library_size` o `max_daily_hours`. Usa `metric: "client_reported"` y `clientReported: true` para un logro que el cliente reclamará manualmente. La ruta no valida el catálogo de métricas.

Cada objeto devuelto por `GET /web/achievements` incluye `id`, `icon`, `title`, `description`, `category`, `metric`, `threshold`, `clientReported`, `active`, `sortOrder` y `createdAt`.

**Respuesta `201`** — Objeto del logro creado. `400` si falta `title` o `metric`; `403` sin rol administrativo; `500` si no se puede crear (por ejemplo, por ID duplicado).

#### `PUT /web/achievements/:id`

> Requiere rol `superadmin`.

Actualiza cualquier combinación de campos de un logro existente (mismos campos que en la creación).

Devuelve el logro actualizado; `404` si no existe y `403` sin rol administrativo.

#### `DELETE /web/achievements/:id`

> Requiere rol `superadmin`.

Elimina el logro y sus desbloqueos asociados.

Responde `{ "success": true }` también si el ID no existía; `403` sin rol administrativo.

---

### Descarga

#### `GET /app.apk`

Descarga el APK de la app Android si está disponible en el servidor.

Requiere sesión web autenticada. Responde `404` si no hay APK disponible.

---

## API Bot `/bot/`

La API de bots usa una clave, no JWT. Envía la clave en todas las peticiones:

```http
X-Bot-Key: <BOT_API_KEY>
```

La clave bot es distinta del JWT que devuelve `/api/login`, `/pc/login` o `/web/login`. En `/bot/*`, `Authorization: Bearer <jwt>` no sirve: necesitas que el operador te entregue una bot key y debes enviarla como `X-Bot-Key`.

El operador puede proporcionar la clave legacy configurada en `BOT_API_KEY` o crear una clave desde la API web autenticada `POST /web/bot-keys`. Una clave creada en el panel puede activarse, desactivarse, resetearse o eliminarse desde `/web/bot-keys/:id`. Conserva la clave como secreto y no la incluyas en código público.

La creación/rotación desde `/web/bot-keys` requiere cookie `web_token` y permisos administrativos. El valor `apiKey` se devuelve al crear o resetear la clave; guárdalo entonces, porque el bot solo necesita que el operador se lo entregue.

```bash
curl -i -c web-cookies.txt -X POST "$BASE_URL/web/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"<usuario-admin>","password":"<contraseña>"}'

curl -i -b web-cookies.txt -X POST "$BASE_URL/web/bot-keys" \
  -H 'Content-Type: application/json' \
  -d '{"name":"discord-bot"}'
```

La respuesta de creación contiene `apiKey`. El archivo local `web-cookies.txt` contiene la sesión web y debe mantenerse privado. La cuenta que crea claves debe tener permisos administrativos; el bot consumidor no necesita esa cookie, solo recibe y envía `apiKey` como `X-Bot-Key`.

Si la clave coincide con una entrada administrada inactiva, la respuesta es `403`. Si no coincide con una entrada, se compara con `BOT_API_KEY`; una clave ausente o incorrecta responde `401`. Las claves administradas registran número de usos y latencia media. No envíes la clave en query params: el único mecanismo aceptado por `/bot/*` es el header `X-Bot-Key`.

**Ejemplo de conexión**
```bash
BASE_URL="https://tu-servidor.example"
BOT_KEY="<clave-entregada-por-el-operador>"

curl -i "$BASE_URL/bot/songs" -H "X-Bot-Key: $BOT_KEY"
```

**Ejemplo Node.js 18+**
```js
const baseUrl = process.env.YFITOPS_URL;
const botKey = process.env.YFITOPS_BOT_KEY;

async function main() {
  const response = await fetch(`${baseUrl}/bot/playlists`, {
    headers: { 'X-Bot-Key': botKey },
  });

  if (response.status === 429) {
    throw new Error(`Rate limited; retry after ${response.headers.get('retry-after')} seconds`);
  }
  if (!response.ok) {
    throw new Error(`YFitops API returned ${response.status}: ${await response.text()}`);
  }

  const playlists = await response.json();
  console.log(playlists);
}

main().catch(console.error);
```

**Elegir playlist y obtener el audio**

`GET /bot/playlists/:name/songs` devuelve objetos canción. Cada `url` apunta al recurso de audio del servidor y es relativa a `BASE_URL`. La ruta estática de audio no necesita `X-Bot-Key`; la clave se usa en las llamadas `/bot/*`.

```js
const baseUrl = process.env.YFITOPS_URL;
const botKey = process.env.YFITOPS_BOT_KEY;
const playlistName = 'Verano 2026';

const playlistResponse = await fetch(
  `${baseUrl}/bot/playlists/${encodeURIComponent(playlistName)}/songs`,
  { headers: { 'X-Bot-Key': botKey } },
);
if (!playlistResponse.ok) throw new Error(`Playlist request failed: ${playlistResponse.status}`);

const songs = await playlistResponse.json();
const song = songs[0];
if (!song) throw new Error('La playlist no tiene canciones');

const audioUrl = new URL(song.url, baseUrl);
const audioResponse = await fetch(audioUrl);
if (!audioResponse.ok) throw new Error(`Audio request failed: ${audioResponse.status}`);
console.log({ title: song.title, artist: song.artist, audioUrl: audioUrl.href });
// Usa audioResponse.body como stream de audio en tu reproductor.
```

### `GET /bot/songs`

Devuelve las canciones de la biblioteca principal. No incluye canciones que solo estén dentro de playlists de carpeta.

**Query opcional**

| Parámetro | Tipo | Comportamiento |
|---|---|---|
| `search` | string | Búsqueda parcial, sin distinguir mayúsculas, en `title` y `artist` |

**Respuesta `200`** — Array de [`Song`](#canción-de-biblioteca-song).

Los nombres de campo son los del esquema [`Song`](#canción-de-biblioteca-song); `url` y `coverUrl` son rutas relativas al servidor y se pueden convertir a URL absoluta concatenándolas con `BASE_URL`.

```bash
curl -i "$BASE_URL/bot/songs?search=bad%20bunny" \
  -H "X-Bot-Key: $BOT_KEY"
```

### `GET /bot/playlists`

Lista solo playlists de carpeta, no playlists manuales de usuarios.

**Respuesta `200`**
```json
[
  {
    "id": "id-de-playlist",
    "name": "Verano",
    "songCount": 12,
    "coverUrl": "/playlist/Verano/cover.jpg"
  }
]
```

`coverUrl` puede ser `null` y, cuando contiene una ruta, se resuelve contra el origen del servidor.

Para recuperar la lista completa de canciones de una playlist, usa su `name` con `GET /bot/playlists/:name/songs`; `songCount` permite decidir cuáles consultar.

```bash
curl -i "$BASE_URL/bot/playlists" \
  -H "X-Bot-Key: $BOT_KEY"
```

### `GET /bot/playlists/:name/songs`

Devuelve las canciones de la playlist de carpeta cuyo nombre coincida con `:name`, sin distinguir mayúsculas. Codifica el nombre como un segmento de URL (por ejemplo, `Verano 2026` → `Verano%202026`).

**Respuesta `200`** — Array de objetos [`Song`](#canción-de-biblioteca-song). `404` si no hay playlist con ese nombre.

```json
[
  {
    "id": "id-de-cancion",
    "title": "Tema",
    "artist": "Artista",
    "album": "Verano 2026",
    "duration": 213.4,
    "filename": "tema.mp3",
    "url": "/playlist/Verano%202026/tema.mp3",
    "coverUrl": null
  }
]
```

```bash
curl -i "$BASE_URL/bot/playlists/Verano%202026/songs" \
  -H "X-Bot-Key: $BOT_KEY"
```

### `GET /bot/random-playlist`

Devuelve una playlist de carpeta elegida al azar, con metadatos y su array `songs` completo. Cada canción incluye `id`, `title`, `artist`, `album`, `duration`, `filename`, `url` y `coverUrl`.

**Respuesta `200`**
```json
{
  "id": "id-de-playlist",
  "name": "Verano",
  "folderName": "Verano",
  "songs": [
    {
      "id": "id-de-cancion",
      "title": "Tema",
      "artist": "Artista",
      "album": "Verano",
      "duration": 213.4,
      "filename": "tema.mp3",
      "url": "/playlist/Verano/tema.mp3",
      "coverUrl": null
    }
  ],
  "coverUrl": "/playlist/Verano/cover.jpg",
  "totalDuration": 3600,
  "source": "folder",
  "createdAt": "2026-09-26T10:00:00.000Z",
  "updatedAt": "2026-09-26T10:00:00.000Z"
}
```

`404` con `{ "error": "No hay playlists" }` si no hay ninguna.

```bash
curl -i "$BASE_URL/bot/random-playlist" \
  -H "X-Bot-Key: $BOT_KEY"
```

### `POST /bot/sync`

Vuelve a escanear las playlists de carpeta. No requiere cuerpo.

**Respuesta `200`**
```json
{ "success": true, "count": 12 }
```

`count` es el número de playlists sincronizadas.

Llama a esta ruta solo cuando el operador haya cambiado las colecciones disponibles; no hace falta llamarla antes de cada lectura.

```bash
curl -i -X POST "$BASE_URL/bot/sync" \
  -H "X-Bot-Key: $BOT_KEY"
```

### `GET /bot/stats`

**Respuesta `200`**
```json
{ "totalSongs": 123, "totalPlaylists": 12 }
```

`totalSongs` suma biblioteca principal y canciones de carpeta, por lo que una canción representada en ambos sitios puede contarse dos veces. `totalPlaylists` cuenta únicamente playlists de carpeta.

```bash
curl -i "$BASE_URL/bot/stats" \
  -H "X-Bot-Key: $BOT_KEY"
```

### Límites de esta API

`/bot/*` es de solo lectura salvo `POST /bot/sync`, que actualiza el índice de playlists de carpeta. No hay endpoints bot para subir audio, modificar canciones, crear playlists manuales, borrar recursos, paginar listas ni filtrar playlists por ID. Los únicos filtros disponibles son `search` en `/bot/songs` y el nombre exacto (sin distinguir mayúsculas) en `/bot/playlists/:name/songs`.

### Errores de bot

| Status | Causa |
|---|---|
| `401` | Falta `X-Bot-Key` o la clave es inválida |
| `403` | La clave coincide con una clave administrada pero está inactiva, o se ha bloqueado temporalmente por rate limit |
| `404` | Playlist solicitada por nombre no encontrada o no hay playlist aleatoria disponible |
| `429` | Se excedió el límite de peticiones; revisa `Retry-After` |

Para `401`, revisa que el header y la clave estén presentes. Para `403`, la clave puede estar desactivada o la IP/clave temporalmente bloqueada; no repitas en bucle. Para `429`, espera el tiempo indicado en `Retry-After` antes de reintentar. El límite de bots es de 240 peticiones por minuto por clave, además del límite global por IP.

---

## Rate limiting y protección anti-spam

Todos los requests, incluidos archivos estáticos, pasan primero por un limitador global en memoria por IP. Además, las rutas de prefijo pasan por su limitador de plataforma; los limitadores son acumulativos, no alternativos. Si se supera cualquiera, responde `429 Too Many Requests` con `Retry-After` (segundos restantes de esa ventana). Seis excesos en 10 minutos para una identidad provocan un bloqueo `403` de 30 minutos; cada reincidencia duplica la duración hasta 12 horas. El estado se reinicia al reiniciar el servidor.

| Ruta | Ventana | Máximo |
|---|---|---|
| `/api/*` y `/pc/*` | 60 s | 180 por usuario (ID decodificado del JWT, sin verificarlo para este fin) o IP si no hay token |
| `/api/heartbeat`, `/api/latency`, `/pc/heartbeat`, `/pc/latency` (adicional) | 10 s | 60 por usuario/IP; también se aplica el máximo general de 180 por 60 s |
| `/api/upload` (adicional) | 60 s | 20 por usuario/IP; también se aplican los límites `/api` y global |
| `/web/*` | 60 s | 240 por usuario del JWT web o IP si no hay cookie válida decodificable |
| `/bot/*` | 60 s | 240 por valor de `X-Bot-Key` o IP si falta |
| `/api/login`, `/pc/login`, `/web/login` (adicional) | 15 min | 15 por IP; también se aplican los límites del prefijo y global |
| Cualquier ruta, incluidos estáticos (global) | 60 s | 400 por IP |

En práctica, heartbeat está además limitado por 180 solicitudes por minuto del prefijo `/api` o `/pc`; por tanto, el límite general puede activarse antes que el de 60 solicitudes por cada 10 segundos. El login se limita por IP para dificultar fuerza bruta.

Antes del `429`, los limitadores `/api/heartbeat` y `/pc/heartbeat` añaden `warning` al alcanzar el 70% (42/60) de su ventana; `/api` y `/pc` lo hacen al 75% (135/180). Cada limitador envía como máximo un aviso por ventana. Se considera el JWT decodificado sin validar su firma únicamente para repartir el rate limit; la autorización real siempre verifica firma y expiración mediante el middleware de autenticación.

---

## Rutas no disponibles

No existe `GET /web/changelog`. El changelog móvil se obtiene con `GET /api/changelog` y requiere token `/api`; el changelog PC se obtiene con `GET /pc/changelog` y requiere token `/pc`.