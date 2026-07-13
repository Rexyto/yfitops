import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────
// Protección anti-spam / anti-flood para las APIs.
//
// Estrategia (todo en memoria):
//   1. Ventana fija por "clave" (IP, usuario o clave de bot):
//      si se supera `max` peticiones en `windowMs`, se responde 429.
//   2. Si una clave se pasa de la ventana repetidamente (más de
//      VIOLATION_THRESHOLD veces en VIOLATION_WINDOW_MS), se le
//      aplica un bloqueo temporal (403) que se va alargando si
//      reincide (30 min, 60 min, 120 min... hasta un tope de 12h).
//
// Los límites están pensados para NO penalizar el uso normal de
// la app (cambiar de canción muy seguido, hacer scroll, etc.):
// el endpoint de heartbeat/latency (el que más se llama) tiene su
// propio límite mucho más generoso que el resto.
// ─────────────────────────────────────────────────────────────

const buckets = new Map();      // key -> { count, resetAt }
const violations = new Map();   // key -> { count, windowStart }
const banHistory = new Map();   // key -> número de baneos previos
const bans = new Map();         // key -> timestamp fin del baneo

const VIOLATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const VIOLATION_THRESHOLD = 6;              // 6 bloqueos en la ventana -> ban
const BASE_BAN_MS = 30 * 60 * 1000;         // 30 minutos
const MAX_BAN_MS = 12 * 60 * 60 * 1000;     // tope: 12 horas

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function isBanned(key) {
  const until = bans.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    bans.delete(key);
    return false;
  }
  return true;
}

function recordViolation(key) {
  const now = Date.now();
  const v = violations.get(key);
  if (!v || now - v.windowStart > VIOLATION_WINDOW_MS) {
    violations.set(key, { count: 1, windowStart: now });
    return;
  }
  v.count++;
  if (v.count >= VIOLATION_THRESHOLD) {
    const prevBans = banHistory.get(key) || 0;
    const duration = Math.min(BASE_BAN_MS * Math.pow(2, prevBans), MAX_BAN_MS);
    bans.set(key, now + duration);
    banHistory.set(key, prevBans + 1);
    violations.delete(key);
    console.warn(`[RATE-LIMIT] Bloqueada la clave "${key}" durante ${Math.round(duration / 60000)} min por flood.`);
  }
}

// ── Fábrica de limitadores ─────────────────────────────────
export function createRateLimiter({
  windowMs, max, keyFn = getClientIp, name = 'default',
  warnAt = null, warnMessage = 'Estás mandando peticiones muy seguido. Tómatelo con calma o podrías acabar bloqueado temporalmente.',
}) {
  return function rateLimiter(req, res, next) {
    let baseKey;
    try {
      baseKey = keyFn(req) || getClientIp(req);
    } catch {
      baseKey = getClientIp(req);
    }

    if (isBanned(baseKey)) {
      return res.status(403).json({ error: 'Bloqueado temporalmente por actividad sospechosa. Inténtalo más tarde.' });
    }

    const key = `${name}:${baseKey}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs, warned: false };
      buckets.set(key, bucket);
    }
    bucket.count++;

    if (bucket.count > max) {
      recordViolation(baseKey);
      res.set('Retry-After', Math.ceil((bucket.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: 'Demasiadas solicitudes. Reduce la frecuencia e inténtalo de nuevo en unos segundos.' });
    }

    // Aviso amistoso tipo "estás yendo muy rápido" ANTES de llegar al
    // bloqueo de verdad (parecido a como Discord avisa de rate limit antes
    // de cortar). Se manda como mucho una vez por ventana de tiempo, viaja
    // en `req.rateLimitWarning` para que el propio endpoint lo incluya en
    // su respuesta normal (200 OK), no sustituye ni retrasa la petición.
    if (warnAt && !bucket.warned && bucket.count >= Math.ceil(max * warnAt)) {
      bucket.warned = true;
      req.rateLimitWarning = warnMessage;
    }

    next();
  };
}

// ── Claves de identidad (best-effort, sin verificar firma) ──
// Se usa jwt.decode (NO jwt.verify) sólo para repartir el
// contador por usuario en vez de por IP compartida. No se usa
// nunca para autorizar nada: la autenticación real la sigue
// haciendo authMiddleware/webAuthMiddleware/pcAuthMiddleware más
// abajo en la cadena de middlewares.
function decodeIdFromToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.decode(token);
    return decoded?.id || decoded?.username || null;
  } catch {
    return null;
  }
}

export function jwtIdOrIp({ cookieName } = {}) {
  return (req) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    const cookieToken = cookieName ? req.cookies?.[cookieName] : null;
    const id = decodeIdFromToken(bearer) || decodeIdFromToken(cookieToken);
    return id ? `u:${id}` : getClientIp(req);
  };
}

export function botKeyOrIp(req) {
  const key = req.headers['x-bot-key'];
  return key ? `b:${key}` : getClientIp(req);
}

// ── Limitadores concretos usados por el servidor ─────────────

// Backstop global: cualquier IP, cualquier ruta (incluye estáticos).
export const globalIpLimiter = createRateLimiter({
  windowMs: 60_000, max: 400, keyFn: getClientIp, name: 'global',
});

// Login: pocas peticiones por IP para dificultar fuerza bruta.
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60_000, max: 15, keyFn: getClientIp, name: 'login',
});

// Heartbeat/latencia: se llama muy seguido (cada pocos segundos),
// así que el límite es generoso y NO penaliza cambiar de canción
// varias veces seguidas ni pausar/reanudar repetidamente.
export const heartbeatLimiter = createRateLimiter({
  windowMs: 10_000, max: 60, keyFn: jwtIdOrIp(), name: 'heartbeat', warnAt: 0.7,
  warnMessage: 'Estás pausando/cambiando canciones muy rápido. Relájate un poco.',
});

export const apiLimiter = createRateLimiter({
  windowMs: 60_000, max: 180, keyFn: jwtIdOrIp(), name: 'api', warnAt: 0.75,
});

export const pcLimiter = createRateLimiter({
  windowMs: 60_000, max: 180, keyFn: jwtIdOrIp({ cookieName: 'pc_token' }), name: 'pc', warnAt: 0.75,
});

export const webLimiter = createRateLimiter({
  windowMs: 60_000, max: 240, keyFn: jwtIdOrIp({ cookieName: 'web_token' }), name: 'web',
});

export const botLimiter = createRateLimiter({
  windowMs: 60_000, max: 240, keyFn: botKeyOrIp, name: 'bot',
});

export const uploadLimiter = createRateLimiter({
  windowMs: 60_000, max: 20, keyFn: jwtIdOrIp(), name: 'upload',
});

// ── Limpieza periódica de memoria ────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.resetAt + 60_000) buckets.delete(k);
  for (const [k, v] of violations) if (now - v.windowStart > VIOLATION_WINDOW_MS * 2) violations.delete(k);
  for (const [k, t] of bans) if (now > t) bans.delete(k);
}, 5 * 60_000).unref();