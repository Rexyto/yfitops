import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { webAuthMiddleware, hashPassword } from '../lib/auth.js';
import {
  readUsers,
  writeUsers,
  readVersion,
  writeVersion,
  readBotApiKeys,
  createBotApiKey,
  updateBotApiKey,
  resetBotApiKey,
  deleteBotApiKey
} from '../lib/storage.js';
import { ROOT_DIR, WEB_JWT_SECRET } from '../lib/config.js';
import { getFullCatalog, createAchievement, updateAchievement, deleteAchievement, getUserAchievementsView } from '../lib/achievements.js';
import { getUserListeningStats, getMostPlayedSong, getMostPlayedPlaylist, getCurrentStreak } from '../lib/userStats.js';

export default function webRoutes(app) {
  app.post('/web/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
    const users = await readUsers();
    const user = users.find(u => u.username === username);
    if (!user || hashPassword(password) !== user.password) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const role = user.username === 'rexy' ? 'superadmin' : 'user';
    const token = jwt.sign({ username, id: user.id, role }, WEB_JWT_SECRET, { expiresIn: '3d' });
    res.cookie('web_token', token, { httpOnly: true, secure: false, maxAge: 3 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ success: true, username });
  });

  app.post('/web/logout', (req, res) => {
    res.clearCookie('web_token');
    res.json({ success: true });
  });

  app.get('/web/me', webAuthMiddleware, (req, res) => {
    res.json({ username: req.webUser.username, role: req.webUser.role });
  });

  app.get('/web/version', webAuthMiddleware, async (req, res) => {
    res.json(await readVersion());
  });

  app.put('/web/version', webAuthMiddleware, async (req, res) => {
    const v = await readVersion();
    if (req.body.version) v.version = req.body.version;
    await writeVersion(v);
    res.json(v);
  });

  app.get('/web/users', webAuthMiddleware, async (req, res) => {
    const users = await readUsers();
    res.json(users.map(u => ({ id: u.id, username: u.username })));
  });

  app.post('/web/users', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
    const users = await readUsers();
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Usuario ya existe' });
    const newUser = { id: crypto.randomUUID(), username, password: hashPassword(password), favorites: [], songs: [] };
    users.push(newUser);
    await writeUsers(users);
    res.json({ id: newUser.id, username: newUser.username });
  });

  app.delete('/web/users/:id', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    const users = await readUsers();
    const filtered = users.filter(u => u.id !== req.params.id);
    if (filtered.length === users.length) return res.status(404).json({ error: 'No encontrado' });
    await writeUsers(filtered);
    res.json({ success: true });
  });

  app.get('/web/bot-keys', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    const keys = await readBotApiKeys();
    res.json(keys);
  });

  app.post('/web/bot-keys', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const key = await createBotApiKey(name.trim());
    res.status(201).json(key);
  });

  app.put('/web/bot-keys/:id', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    const { name, active } = req.body;
    const updated = await updateBotApiKey(req.params.id, { name, active });
    if (!updated) return res.status(404).json({ error: 'Clave no encontrada' });
    res.json(updated);
  });

  app.post('/web/bot-keys/:id/reset', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    const key = await resetBotApiKey(req.params.id);
    if (!key) return res.status(404).json({ error: 'Clave no encontrada' });
    res.json(key);
  });

  app.delete('/web/bot-keys/:id', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    await deleteBotApiKey(req.params.id);
    res.json({ success: true });
  });

  // ── Logros (catálogo) ─────────────────────────────────────
  // Lectura disponible para cualquier usuario web autenticado;
  // crear/editar/borrar requiere superadmin (mismo patrón que
  // las claves de bot).
  app.get('/web/achievements', webAuthMiddleware, async (req, res) => {
    try {
      const achievements = await getFullCatalog();
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener logros' });
    }
  });

  app.post('/web/achievements', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    const { icon, title, description, category, metric, threshold, clientReported, active, sortOrder, id } = req.body;
    if (!title || !metric) return res.status(400).json({ error: 'Faltan campos requeridos (title, metric)' });
    try {
      const achievement = await createAchievement({ id, icon, title, description, category, metric, threshold, clientReported, active, sortOrder });
      res.status(201).json(achievement);
    } catch (error) {
      res.status(500).json({ error: 'Error al crear el logro (¿id duplicado?)' });
    }
  });

  app.put('/web/achievements/:id', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    try {
      const achievement = await updateAchievement(req.params.id, req.body);
      if (!achievement) return res.status(404).json({ error: 'Logro no encontrado' });
      res.json(achievement);
    } catch (error) {
      res.status(500).json({ error: 'Error al actualizar el logro' });
    }
  });

  app.delete('/web/achievements/:id', webAuthMiddleware, async (req, res) => {
    if (req.webUser.role !== 'superadmin') return res.status(403).json({ error: 'Sin permisos' });
    try {
      await deleteAchievement(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar el logro' });
    }
  });

  // ── Estadísticas y logros de un usuario concreto (soporte/admin) ──
  app.get('/web/users/:id/stats', webAuthMiddleware, async (req, res) => {
    try {
      const [listening, mostPlayedSong, mostPlayedPlaylist, streak, achievements] = await Promise.all([
        getUserListeningStats(req.params.id),
        getMostPlayedSong(req.params.id),
        getMostPlayedPlaylist(req.params.id),
        getCurrentStreak(req.params.id),
        getUserAchievementsView(req.params.id),
      ]);
      res.json({
        totalListeningSeconds: listening.totalListeningSeconds,
        totalHours: Math.round((listening.totalListeningSeconds / 3600) * 10) / 10,
        totalSongsPlayed: listening.totalSongsPlayed,
        currentStreak: streak,
        mostPlayedSong,
        mostPlayedPlaylist,
        achievementsUnlocked: achievements.filter(a => a.unlocked).length,
        achievementsTotal: achievements.length,
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener estadísticas del usuario' });
    }
  });

  app.get('/app.apk', webAuthMiddleware, async (req, res) => {
    const apkPath = path.join(ROOT_DIR, 'app.apk');
    try {
      await fs.promises.access(apkPath);
      res.download(apkPath, 'YFitops.apk');
    } catch {
      res.status(404).json({ error: 'APK no disponible' });
    }
  });
}
