import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { hashPassword, pcAuthMiddleware } from '../lib/auth.js';
import { readUsers, writeUsers, readVersion, readChangelog, readData, writeData, readDataPl, readStats, writeStats } from '../lib/storage.js';
import { listPortadaFiles, matchCustomCover } from '../lib/audio.js';
import { CANCIONES_DIR, PLAYLIST_DIR, AUDIO_EXTS, PC_JWT_SECRET } from '../lib/config.js';
import { activeListeners } from '../lib/activeListeners.js';
import { syncPlaylistDir } from '../lib/watchers.js';
import { addListeningSeconds, recordSongPlay, recordPlaylistPlay, getUserDailyListening, getMostPlayedSong, getMostPlayedPlaylist, getCurrentStreak, getUserListeningStats } from '../lib/userStats.js';
import { evaluateUserAchievements, getUserAchievementsView, claimClientAchievement } from '../lib/achievements.js';

// Busca una canción por id tanto en la biblioteca principal (data.songs)
// como en las canciones de las playlists de carpeta (dataPl.playlists[].songs).
// Sin esto, cualquier reproducción de una canción que sólo vive dentro de
// una colección de carpeta (que puede ser la inmensa mayoría de la
// biblioteca) no encontraba título/artista y se guardaba como "Desconocido".
function findSongMeta(songId, data, dataPl) {
  const inLibrary = data.songs.find(s => s.id === songId);
  if (inLibrary) return inLibrary;
  for (const playlist of dataPl.playlists || []) {
    const found = (playlist.songs || []).find(s => s.id === songId);
    if (found) return found;
  }
  return null;
}

export default function pcRoutes(app) {
  /**
   * LOGIN - Autenticación para PC
   */
  app.post('/pc/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
      const users = await readUsers();
      const user = users.find(u => u.username === username);

      if (!user || hashPassword(password) !== user.password) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const token = jwt.sign(
        { username: user.username, id: user.id },
        PC_JWT_SECRET,
        { expiresIn: '30d' }
      );

      activeListeners.set(user.id, { songId: null, isPlaying: false, timestamp: Date.now() });
      evaluateUserAchievements(user.id).catch(() => {});

      res.json({ token, username: user.username, id: user.id });
    } catch (error) {
      res.status(500).json({ error: 'Error en el servidor' });
    }
  });

  /**
   * VERIFICACIÓN - Verifica que el token sea válido
   */
  app.get('/pc/verify', pcAuthMiddleware, (req, res) => {
    res.json({ valid: true, username: req.pcUser.username, id: req.pcUser.id });
  });

  /**
   * VERSIÓN - Obtiene versión de PC
   */
  app.get('/pc/version', pcAuthMiddleware, async (req, res) => {
    try {
      const version = await readVersion();
      res.json(version.pc || { version: '1.0.0', exeUrl: '' });
    } catch (error) {
      res.status(500).json({ error: 'Error al leer versión' });
    }
  });

  /**
   * CHANGELOG/NOTAS - Obtiene actualizaciones de PC
   */
  app.get('/pc/changelog', pcAuthMiddleware, async (req, res) => {
    try {
      const changelog = await readChangelog();
      res.json(changelog.pc || { version: '1.0.0', notes: '' });
    } catch (error) {
      res.status(500).json({ error: 'Error al leer actualizaciones' });
    }
  });

  /**
   * CANCIONES - Lista todas las canciones disponibles
   */
  app.get('/pc/songs', pcAuthMiddleware, async (req, res) => {
    try {
      const data = await readData();
      const files = await fs.promises.readdir(CANCIONES_DIR);
      const audioFiles = new Set(files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())));

      // Limpiar canciones eliminadas
      const before = data.songs.length;
      data.songs = data.songs.filter(s => audioFiles.has(s.filename));
      if (data.songs.length < before) await writeData(data);

      const { search } = req.query;
      let songs = data.songs;

      if (search) {
        const s = search.toLowerCase();
        songs = songs.filter(song =>
          song.title.toLowerCase().includes(s) ||
          song.artist.toLowerCase().includes(s) ||
          song.album.toLowerCase().includes(s)
        );
      }

      res.json(songs);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener canciones' });
    }
  });

  /**
   * MIS CANCIONES - Canciones del usuario actual
   */
  app.get('/pc/mysongs', pcAuthMiddleware, async (req, res) => {
    try {
      const users = await readUsers();
      const user = users.find(u => u.id === req.pcUser.id);

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const data = await readData();
      const mySongIds = new Set(user.songs || []);

      res.json(data.songs.filter(s => mySongIds.has(s.id)));
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener tus canciones' });
    }
  });

  /**
   * FAVORITOS - Obtener favoritos
   */
  app.get('/pc/favorites', pcAuthMiddleware, async (req, res) => {
    try {
      const users = await readUsers();
      const user = users.find(u => u.id === req.pcUser.id);
      res.json(user?.favorites || []);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener favoritos' });
    }
  });

  /**
   * AGREGAR FAVORITO
   */
  app.post('/pc/favorites/:id', pcAuthMiddleware, async (req, res) => {
    try {
      const users = await readUsers();
      const idx = users.findIndex(u => u.id === req.pcUser.id);

      if (idx === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!users[idx].favorites) users[idx].favorites = [];
      if (!users[idx].favorites.includes(req.params.id)) {
        users[idx].favorites.push(req.params.id);
        await writeUsers(users);
        evaluateUserAchievements(req.pcUser.id).catch(() => {});
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Error al agregar favorito' });
    }
  });

  /**
   * ELIMINAR FAVORITO
   */
  app.delete('/pc/favorites/:id', pcAuthMiddleware, async (req, res) => {
    try {
      const users = await readUsers();
      const idx = users.findIndex(u => u.id === req.pcUser.id);

      if (idx === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      users[idx].favorites = (users[idx].favorites || []).filter(id => id !== req.params.id);
      await writeUsers(users);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar favorito' });
    }
  });

  /**
   * PLAYLISTS - Obtener playlists
   */
  app.get('/pc/playlists', pcAuthMiddleware, async (req, res) => {
    try {
      const data = await readData();
      res.json((data.playlists || []).filter(p => p.userId === req.pcUser.id));
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener playlists' });
    }
  });

  /**
   * FOLDER PLAYLISTS - Playlists automáticas desde carpetas
   */
  app.get('/pc/folderplaylists', pcAuthMiddleware, async (req, res) => {
    try {
      const data = await readDataPl();
      res.json(data.playlists || []);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener folder playlists' });
    }
  });

  app.post('/pc/folderplaylists/sync', pcAuthMiddleware, async (req, res) => {
    try {
      await syncPlaylistDir();
      const data = await readDataPl();
      res.json({ success: true, count: data.playlists.length });
    } catch (error) {
      res.status(500).json({ error: 'Error al sincronizar folder playlists' });
    }
  });

  /**
   * CREAR PLAYLIST
   */
  app.post('/pc/playlists', pcAuthMiddleware, async (req, res) => {
    try {
      const data = await readData();
      if (!data.playlists) data.playlists = [];

      const playlist = {
        id: crypto.randomUUID(),
        name: req.body.name || 'Mi Playlist',
        songs: req.body.songs || [],
        coverColor: req.body.coverColor || '#1DB954',
        userId: req.pcUser.id,
        createdAt: new Date().toISOString()
      };

      data.playlists.push(playlist);
      await writeData(data);
      evaluateUserAchievements(req.pcUser.id).catch(() => {});
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ error: 'Error al crear playlist' });
    }
  });

  /**
   * ACTUALIZAR PLAYLIST
   */
  app.put('/pc/playlists/:id', pcAuthMiddleware, async (req, res) => {
    try {
      const data = await readData();
      const idx = data.playlists.findIndex(p => p.id === req.params.id && p.userId === req.pcUser.id);

      if (idx === -1) {
        return res.status(404).json({ error: 'Playlist no encontrada' });
      }

      data.playlists[idx] = {
        ...data.playlists[idx],
        ...req.body,
        id: req.params.id,
        userId: req.pcUser.id
      };

      await writeData(data);
      res.json(data.playlists[idx]);
    } catch (error) {
      res.status(500).json({ error: 'Error al actualizar playlist' });
    }
  });

  /**
   * ELIMINAR PLAYLIST
   */
  app.delete('/pc/playlists/:id', pcAuthMiddleware, async (req, res) => {
    try {
      const data = await readData();
      data.playlists = (data.playlists || []).filter(
        p => !(p.id === req.params.id && p.userId === req.pcUser.id)
      );
      await writeData(data);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar playlist' });
    }
  });

  /**
   * HEARTBEAT - Actualiza el estado de reproducción
   */
  app.post('/pc/heartbeat', pcAuthMiddleware, async (req, res) => {
    try {
      // playlistId/playlistType son opcionales (compatibles con clientes viejos).
      const { songId, isPlaying, elapsedMs, playlistId, playlistType } = req.body;
      const prev = activeListeners.get(req.pcUser.id);
      const now = Date.now();
      // Sólo cuenta como "nueva reproducción" si cambia la canción (o es la
      // primera vez que vemos a este usuario reproducir algo). Antes
      // también se disparaba con "!prev.isPlaying", lo que hacía que pausar
      // y reanudar la MISMA canción se contara como una reproducción nueva
      // (inflaba "canciones reproducidas", el contador de "misma canción
      // repetida" y disparaba logros de golpe). Un simple resume ya NO cuenta.
      const isNewPlay = !!(songId && isPlaying && (!prev || songId !== prev.songId));

      // IMPORTANTE: actualizar activeListeners AQUÍ, de forma síncrona y
      // ANTES de cualquier `await` (misma razón que en /api/heartbeat: evita
      // que dos heartbeats casi simultáneos del mismo usuario lean el mismo
      // `prev` desactualizado y ambos se cuenten como "nueva reproducción").
      activeListeners.set(req.pcUser.id, { songId, isPlaying: !!isPlaying, timestamp: now });

      // Registrar tiempo escuchado
      if (typeof elapsedMs === 'number' && elapsedMs > 0 && elapsedMs < 7200000) {
        const elapsedSecs = Math.round(elapsedMs / 1000);
        const stats = await readStats();
        stats.totalListeningSeconds += elapsedSecs;

        const today = new Date().toISOString().slice(0, 10);
        stats.dailyListening[today] = (stats.dailyListening[today] || 0) + elapsedSecs;

        await writeStats(stats);
        addListeningSeconds(req.pcUser.id, elapsedSecs).catch(() => {});
      }

      // Contar canción reproducida
      if (isNewPlay) {
        const stats = await readStats();
        stats.totalSongsPlayed++;
        await writeStats(stats);

        try {
          const data = await readData();
          const dataPl = await readDataPl();
          const song = findSongMeta(songId, data, dataPl);
          await recordSongPlay(req.pcUser.id, { id: songId, title: song?.title, artist: song?.artist });

          if (playlistId) {
            const type = playlistType === 'folder' ? 'folder' : 'manual';
            let name;
            if (type === 'folder') {
              name = dataPl.playlists.find(p => p.id === playlistId)?.name;
            } else {
              name = (data.playlists || []).find(p => p.id === playlistId)?.name;
            }
            await recordPlaylistPlay(req.pcUser.id, { id: playlistId, type, name });
          }
        } catch (e) {
          console.error('[HEARTBEAT PC] Error registrando estadísticas de usuario:', e.message);
        }
      }

      // Limpiar oyentes inactivos
      for (const [uid, data] of activeListeners.entries()) {
        if (now - data.timestamp > 180000) activeListeners.delete(uid);
      }

      const count = [...activeListeners.values()]
        .filter(d => d.songId && now - d.timestamp < 180000)
        .length;

      // evaluateUserAchievements ya se protege sola contra llamadas
      // concurrentes para el mismo usuario (ver lib/achievements.js).
      let newAchievements = [];
      if (isNewPlay) {
        try { newAchievements = await evaluateUserAchievements(req.pcUser.id); } catch {}
      }

      const response = {
        activeListeners: count,
        newAchievements: newAchievements.map(a => ({ id: a.id, icon: a.icon, title: a.title, description: a.description })),
      };
      if (req.rateLimitWarning) response.warning = req.rateLimitWarning;
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Error en heartbeat' });
    }
  });

  /**
   * LATENCIA - Registra latencia de conexión
   */
  app.post('/pc/latency', pcAuthMiddleware, async (req, res) => {
    try {
      const { latencyMs } = req.body;

      if (typeof latencyMs === 'number' && latencyMs > 0 && latencyMs < 30000) {
        const stats = await readStats();
        stats.latencySamples.push(latencyMs);
        if (stats.latencySamples.length > 100) stats.latencySamples.shift();
        await writeStats(stats);
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: 'Error al registrar latencia' });
    }
  });

  /**
   * ESTADO - Obtiene estado general del servidor
   */
  app.get('/pc/status', pcAuthMiddleware, async (req, res) => {
    try {
      const data = await readData();
      const dataPl = await readDataPl();
      const users = await readUsers();
      const now = Date.now();

      const activeCount = [...activeListeners.values()]
        .filter(d => d.songId && now - d.timestamp < 120000)
        .length;

      const folderSongCount = dataPl.playlists.reduce(
        (acc, p) => acc + (p.songs?.length || 0),
        0
      );

      res.json({
        songs: data.songs.length + folderSongCount,
        playlists: (data.playlists || []).length + dataPl.playlists.length,
        users: users.length,
        activeListeners: activeCount,
        status: 'OK'
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener estado' });
    }
  });

  /**
   * REFRESH COVERS - Recoge carátulas .webp de la carpeta portadas/
   * para canciones que ya existían en la base de datos.
   */
  app.post('/pc/refresh-covers', pcAuthMiddleware, async (req, res) => {
    try {
      const portadaFiles = await listPortadaFiles();
      const data = await readData();
      let updatedLibrary = 0;
      for (const song of data.songs) {
        const customCover = matchCustomCover(song.filename, portadaFiles);
        if (customCover && song.coverUrl !== customCover) {
          song.coverUrl = customCover;
          updatedLibrary++;
        }
      }
      await writeData(data);
      await syncPlaylistDir();

      const dataPl = await readDataPl();
      const matchedInPlaylists = dataPl.playlists.reduce(
        (acc, p) => acc + (p.songs || []).filter(s => matchCustomCover(s.filename, portadaFiles)).length,
        0
      );

      res.json({ success: true, updatedLibrary, matchedInPlaylists, updated: updatedLibrary + matchedInPlaylists });
    } catch (error) {
      res.status(500).json({ error: 'Error al actualizar carátulas' });
    }
  });

  /**
   * PING - Verifica conectividad
   */
  app.get('/pc/ping', pcAuthMiddleware, (req, res) => {
    res.json({ pong: Date.now() });
  });

  /**
   * LOGROS - Catálogo con estado de desbloqueo/progreso del usuario
   */
  app.get('/pc/achievements', pcAuthMiddleware, async (req, res) => {
    try {
      const achievements = await getUserAchievementsView(req.pcUser.id);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener logros' });
    }
  });

  /**
   * RECLAMAR LOGRO - Sólo válido para logros "client_reported"
   */
  app.post('/pc/achievements/:id/claim', pcAuthMiddleware, async (req, res) => {
    try {
      const result = await claimClientAchievement(req.pcUser.id, req.params.id);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error al reclamar logro' });
    }
  });

  /**
   * ESTADÍSTICAS PERSONALES
   */
  app.get('/pc/stats/me', pcAuthMiddleware, async (req, res) => {
    try {
      const [listening, daily, mostPlayedSong, mostPlayedPlaylist, streak] = await Promise.all([
        getUserListeningStats(req.pcUser.id),
        getUserDailyListening(req.pcUser.id, 30),
        getMostPlayedSong(req.pcUser.id),
        getMostPlayedPlaylist(req.pcUser.id),
        getCurrentStreak(req.pcUser.id),
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
      res.status(500).json({ error: 'Error al obtener estadísticas personales' });
    }
  });
}