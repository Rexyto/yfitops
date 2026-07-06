import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET, WEB_JWT_SECRET, PC_JWT_SECRET } from './config.js';
import { readUsers, writeUsers, findBotApiKeyByKey, recordBotApiKeyUsage } from './storage.js';

export async function initUsers() {
  const users = await readUsers();
  let changed = false;
  for (let i = 0; i < users.length; i++) {
    if (!users[i].id) { users[i].id = crypto.randomUUID(); changed = true; }
    if (users[i].password.length !== 64) {
      users[i].password = hashPassword(users[i].password);
      changed = true;
      console.log(`[AUTH] Password de '${users[i].username}' encriptada`);
    }
    if (!users[i].favorites) { users[i].favorites = []; changed = true; }
    if (!users[i].songs) { users[i].songs = []; changed = true; }
  }
  if (changed) await writeUsers(users);
  console.log(`[AUTH] ${users.length} usuarios inicializados`);
}

export function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain + 'yfitops_salt').digest('hex');
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function webAuthMiddleware(req, res, next) {
  const token = req.cookies?.web_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.webUser = jwt.verify(token, WEB_JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada' });
  }
}

export async function botAuthMiddleware(req, res, next) {
  const key = req.headers['x-bot-key'];
  if (!key) {
    return res.status(401).json({ error: 'Clave de bot inválida' });
  }

  const startTime = Date.now();
  let botKeyEntry = null;
  try {
    botKeyEntry = await findBotApiKeyByKey(key);
  } catch (error) {
    console.error('[AUTH] Error validando clave de bot:', error.message);
  }

  if (!botKeyEntry) {
    if (process.env.BOT_API_KEY !== key) {
      return res.status(401).json({ error: 'Clave de bot inválida' });
    }

    res.on('finish', () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 0) {
        recordBotApiKeyUsage(key, elapsed).catch(() => {});
      }
    });

    return next();
  }

  if (!botKeyEntry.active) {
    return res.status(403).json({ error: 'Clave de bot inactiva' });
  }

  req.botKey = botKeyEntry;

  res.on('finish', () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > 0) {
      recordBotApiKeyUsage(key, elapsed).catch(() => {});
    }
  });

  next();
}

export function pcAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.pc_token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    req.pcUser = jwt.verify(token, PC_JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }}