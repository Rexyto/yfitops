import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { webAuthMiddleware, hashPassword } from '../lib/auth.js';
import { upload, uploadMemoryImage } from '../lib/upload.js';
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
import { ROOT_DIR, WEB_JWT_SECRET, CANCIONES_DIR, PLAYLIST_DIR, PORTADAS_DIR } from '../lib/config.js';
import { getConnection } from '../lib/mysql.js';
import { getFullCatalog, createAchievement, updateAchievement, deleteAchievement, getUserAchievementsView } from '../lib/achievements.js';
import { getUserListeningStats, getMostPlayedSong, getMostPlayedPlaylist, getCurrentStreak, getUserDailyListening } from '../lib/userStats.js';
import { processAudioFile } from '../lib/audio.js';

function requireSuperadmin(req, res) {
  if (req.webUser.role !== 'superadmin') {
    res.status(403).json({ error: 'Sin permisos' });
    return false;
  }
  return true;
}

function playlistType(value) {
  return value === 'folder' ? 'folder' : value === 'manual' ? 'manual' : null;
}

function safeFileName(value) {
  return typeof value === 'string' && value && value !== '.' && value !== '..' && !/[\\/]/.test(value) ? value : null;
}

async function readAdminPlaylists() {
  const pool = await getConnection();
  const [manualRows] = await pool.execute('SELECT * FROM playlists ORDER BY created_at DESC');
  const [folderRows] = await pool.execute('SELECT * FROM folder_playlists ORDER BY updated_at DESC');
  const parse = value => {
    try { return typeof value === 'object' ? value : JSON.parse(value || '[]'); } catch { return []; }
  };
  return [
    ...manualRows.map(row => ({
      id: row.id, type: 'manual', name: row.name, coverUrl: row.cover_url || null,
      coverColor: row.cover_color, songs: parse(row.songs), userId: row.user_id,
    })),
    ...folderRows.map(row => ({
      id: row.id, type: 'folder', name: row.name, folderName: row.folder_name,
      coverUrl: row.cover_url || null, songs: parse(row.songs), source: row.source,
    })),
  ];
}

async function findAdminPlaylist(type, id) {
  const playlists = await readAdminPlaylists();
  return playlists.find(playlist => playlist.type === type && playlist.id === id) || null;
}

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

  app.get('/web/admin/playlists', webAuthMiddleware, async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    try {
      res.json(await readAdminPlaylists());
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener las playlists' });
    }
  });

  app.post('/web/admin/playlists/:type/:id/songs', webAuthMiddleware, upload.single('audio'), async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    const type = playlistType(req.params.type);
    if (!type || !req.file) return res.status(400).json({ error: 'Archivo de audio requerido' });

    try {
      const playlist = await findAdminPlaylist(type, req.params.id);
      if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
      const song = await processAudioFile(req.file.filename);
      const pool = await getConnection();
      let updatedSong = { ...song, album: song.album || playlist.name };

      if (type === 'folder') {
        const folderName = safeFileName(playlist.folderName);
        if (!folderName) return res.status(400).json({ error: 'Carpeta inválida' });
        const sourceAudio = path.join(CANCIONES_DIR, req.file.filename);
        const targetAudio = path.join(PLAYLIST_DIR, folderName, req.file.filename);
        await fsp.rename(sourceAudio, targetAudio);
        const embeddedCover = path.join(CANCIONES_DIR, `${song.id}.jpg`);
        const folderCover = path.join(PLAYLIST_DIR, folderName, `pl_${song.id}.jpg`);
        if (await fsp.access(embeddedCover).then(() => true).catch(() => false)) {
          await fsp.rename(embeddedCover, folderCover);
          updatedSong.coverUrl = `/playlist/${encodeURIComponent(folderName)}/pl_${song.id}.jpg`;
        }
        updatedSong.url = `/playlist/${encodeURIComponent(folderName)}/${encodeURIComponent(req.file.filename)}`;
      } else {
        const [existing] = await pool.execute('SELECT id FROM songs WHERE id = ?', [song.id]);
        if (existing.length) return res.status(409).json({ error: 'La canción ya existe' });
        await pool.execute(
          'INSERT INTO songs (id, title, artist, album, duration, filename, url, cover_url, upload_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [updatedSong.id, updatedSong.title, updatedSong.artist, updatedSong.album, updatedSong.duration, updatedSong.filename, updatedSong.url, updatedSong.coverUrl || null, updatedSong.uploadDate]
        );
      }

      const songs = [...playlist.songs, updatedSong];
      await pool.execute(
        `UPDATE ${type === 'folder' ? 'folder_playlists' : 'playlists'} SET songs = ?${type === 'folder' ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = ?`,
        [JSON.stringify(songs), playlist.id]
      );
      res.status(201).json(updatedSong);
    } catch (error) {
      console.error('[ADMIN] Error subiendo canción a playlist:', error.message);
      res.status(500).json({ error: 'No se pudo añadir la canción' });
    }
  });

  app.put('/web/admin/playlists/:type/:id', webAuthMiddleware, async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    const type = playlistType(req.params.type);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!type || !name) return res.status(400).json({ error: 'Nombre de playlist inválido' });

    try {
      const playlist = await findAdminPlaylist(type, req.params.id);
      if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
      const pool = await getConnection();

      if (type === 'manual') {
        await pool.execute('UPDATE playlists SET name = ? WHERE id = ?', [name, playlist.id]);
      } else {
        const folderName = safeFileName(playlist.folderName);
        const nextFolderName = safeFileName(name);
        if (!folderName || !nextFolderName) return res.status(400).json({ error: 'Nombre de carpeta inválido' });
        if (folderName !== nextFolderName) {
          await fsp.rename(path.join(PLAYLIST_DIR, folderName), path.join(PLAYLIST_DIR, nextFolderName));
        }
        const songs = (playlist.songs || []).map(song => ({
          ...song,
          album: song.album === playlist.name ? name : song.album,
          url: `/playlist/${encodeURIComponent(nextFolderName)}/${encodeURIComponent(song.filename)}`,
          coverUrl: song.coverUrl?.startsWith(`/playlist/${encodeURIComponent(folderName)}/`)
            ? song.coverUrl.replace(`/playlist/${encodeURIComponent(folderName)}/`, `/playlist/${encodeURIComponent(nextFolderName)}/`)
            : song.coverUrl,
        }));
        const coverUrl = playlist.coverUrl?.startsWith(`/playlist/${encodeURIComponent(folderName)}/`)
          ? playlist.coverUrl.replace(`/playlist/${encodeURIComponent(folderName)}/`, `/playlist/${encodeURIComponent(nextFolderName)}/`)
          : playlist.coverUrl;
        await pool.execute(
          'UPDATE folder_playlists SET name = ?, folder_name = ?, songs = ?, cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name, nextFolderName, JSON.stringify(songs), coverUrl || null, playlist.id]
        );
      }

      res.json(await findAdminPlaylist(type, playlist.id));
    } catch (error) {
      console.error('[ADMIN] Error actualizando playlist:', error.message);
      res.status(500).json({ error: 'No se pudo actualizar la playlist' });
    }
  });

  app.post('/web/admin/playlists/:type/:id/cover', webAuthMiddleware, uploadMemoryImage.single('cover'), async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    const type = playlistType(req.params.type);
    if (!type || !req.file) return res.status(400).json({ error: 'Imagen requerida' });

    try {
      const playlist = await findAdminPlaylist(type, req.params.id);
      if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      let coverUrl;
      let filePath;
      if (type === 'folder') {
        const folderName = safeFileName(playlist.folderName);
        if (!folderName) return res.status(400).json({ error: 'Carpeta inválida' });
        filePath = path.join(PLAYLIST_DIR, folderName, `cover${ext}`);
        coverUrl = `/playlist/${encodeURIComponent(folderName)}/cover${ext}`;
      } else {
        filePath = path.join(PORTADAS_DIR, 'admin-playlists', `${playlist.id}${ext}`);
        coverUrl = `/portadas/admin-playlists/${encodeURIComponent(`${playlist.id}${ext}`)}`;
      }
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, req.file.buffer);
      const pool = await getConnection();
      await pool.execute(`UPDATE ${type === 'folder' ? 'folder_playlists' : 'playlists'} SET cover_url = ? WHERE id = ?`, [coverUrl, playlist.id]);
      res.json(await findAdminPlaylist(type, playlist.id));
    } catch (error) {
      console.error('[ADMIN] Error subiendo portada:', error.message);
      res.status(500).json({ error: 'No se pudo subir la portada' });
    }
  });

  app.put('/web/admin/playlists/:type/:playlistId/songs/:songId', webAuthMiddleware, async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    const type = playlistType(req.params.type);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!type || !title) return res.status(400).json({ error: 'Título inválido' });

    try {
      const playlist = await findAdminPlaylist(type, req.params.playlistId);
      const song = playlist?.songs?.find(item => item.id === req.params.songId);
      if (!song) return res.status(404).json({ error: 'Canción no encontrada' });
      const updatedSong = { ...song, title };
      const songs = playlist.songs.map(item => item.id === song.id ? updatedSong : item);
      const pool = await getConnection();
      await pool.execute(
        `UPDATE ${type === 'folder' ? 'folder_playlists' : 'playlists'} SET songs = ?${type === 'folder' ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = ?`,
        [JSON.stringify(songs), playlist.id]
      );
      if (type === 'manual') await pool.execute('UPDATE songs SET title = ? WHERE id = ?', [title, song.id]);
      res.json(updatedSong);
    } catch (error) {
      res.status(500).json({ error: 'No se pudo editar la canción' });
    }
  });

  app.post('/web/admin/playlists/:type/:playlistId/songs/:songId/cover', webAuthMiddleware, uploadMemoryImage.single('cover'), async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    const type = playlistType(req.params.type);
    if (!type || !req.file) return res.status(400).json({ error: 'Imagen requerida' });

    try {
      const playlist = await findAdminPlaylist(type, req.params.playlistId);
      const song = playlist?.songs?.find(item => item.id === req.params.songId);
      if (!song) return res.status(404).json({ error: 'Canción no encontrada' });
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const relativeDir = type === 'folder' ? path.join(playlist.folderName) : '';
      const filePath = path.join(type === 'folder' ? PLAYLIST_DIR : CANCIONES_DIR, relativeDir, `${song.id}${ext}`);
      const coverUrl = type === 'folder'
        ? `/playlist/${encodeURIComponent(playlist.folderName)}/${encodeURIComponent(`${song.id}${ext}`)}`
        : `/canciones/${encodeURIComponent(`${song.id}${ext}`)}`;
      await fsp.writeFile(filePath, req.file.buffer);
      const songs = playlist.songs.map(item => item.id === song.id ? { ...item, coverUrl } : item);
      const pool = await getConnection();
      await pool.execute(
        `UPDATE ${type === 'folder' ? 'folder_playlists' : 'playlists'} SET songs = ?${type === 'folder' ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = ?`,
        [JSON.stringify(songs), playlist.id]
      );
      if (type === 'manual') await pool.execute('UPDATE songs SET cover_url = ? WHERE id = ?', [coverUrl, song.id]);
      res.json(songs.find(item => item.id === song.id));
    } catch (error) {
      res.status(500).json({ error: 'No se pudo subir la portada de la canción' });
    }
  });

  app.delete('/web/admin/playlists/:type/:playlistId/songs/:songId', webAuthMiddleware, async (req, res) => {
    if (!requireSuperadmin(req, res)) return;
    const type = playlistType(req.params.type);
    try {
      const playlist = await findAdminPlaylist(type, req.params.playlistId);
      const song = playlist?.songs?.find(item => item.id === req.params.songId);
      if (!song) return res.status(404).json({ error: 'Canción no encontrada' });
      const pool = await getConnection();
      const remaining = playlist.songs.filter(item => item.id !== song.id);
      await pool.execute(
        `UPDATE ${type === 'folder' ? 'folder_playlists' : 'playlists'} SET songs = ?${type === 'folder' ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = ?`,
        [JSON.stringify(remaining), playlist.id]
      );
      const baseDir = type === 'folder' ? path.join(PLAYLIST_DIR, playlist.folderName) : CANCIONES_DIR;
      if (safeFileName(song.filename)) await fsp.unlink(path.join(baseDir, song.filename)).catch(() => {});
      if (safeFileName(song.id)) {
        for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) await fsp.unlink(path.join(baseDir, `${song.id}${ext}`)).catch(() => {});
      }
      if (type === 'manual') {
        await pool.execute('DELETE FROM songs WHERE id = ?', [song.id]);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'No se pudo eliminar la canción' });
    }
  });

  app.get('/web/version', webAuthMiddleware, async (req, res) => {
    res.json(await readVersion());
  });

  app.get('/web/stats/me', webAuthMiddleware, async (req, res) => {
    try {
      const [listening, daily, mostPlayedSong, mostPlayedPlaylist, streak] = await Promise.all([
        getUserListeningStats(req.webUser.id),
        getUserDailyListening(req.webUser.id, 30),
        getMostPlayedSong(req.webUser.id),
        getMostPlayedPlaylist(req.webUser.id),
        getCurrentStreak(req.webUser.id),
      ]);
      res.json({
        totalListeningSeconds: listening.totalListeningSeconds,
        totalHours: Math.round((listening.totalListeningSeconds / 3600) * 10) / 10,
        totalSongsPlayed: listening.totalSongsPlayed,
        currentStreak: streak,
        dailyListening: daily,
        mostPlayedSong,
        mostPlayedPlaylist,
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener tus estadísticas' });
    }
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
