import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { authMiddleware, webAuthMiddleware, hashPassword } from '../lib/auth.js';
import { upload, uploadImage } from '../lib/upload.js';
import { readData, writeData, readDataPl, writeDataPl, readVersion, readChangelog, readStats, writeStats, readUsers, writeUsers, avg } from '../lib/storage.js';
import { processAudioFile, getAudioDuration, listPortadaFiles, matchCustomCover } from '../lib/audio.js';
import { CANCIONES_DIR, PLAYLIST_DIR, AUDIO_EXTS, JWT_SECRET } from '../lib/config.js';
import { activeListeners } from '../lib/activeListeners.js';
import { syncPlaylistDir } from '../lib/watchers.js';
import { addListeningSeconds, recordSongPlay, recordPlaylistPlay, getUserDailyListening, getMostPlayedSong, getMostPlayedPlaylist, getCurrentStreak, getUserListeningStats } from '../lib/userStats.js';
import { evaluateUserAchievements, getUserAchievementsView, claimClientAchievement } from '../lib/achievements.js';
import { uploadLimiter } from '../lib/rateLimit.js';

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

export default function apiRoutes(app) {
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
    const users = await readUsers();
    const user = users.find(u => u.username === username);
    if (!user || hashPassword(password) !== user.password) return res.status(401).json({ error: 'Usuario o contrase�a incorrectos' });
    const token = jwt.sign({ username: user.username, id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    activeListeners.set(user.id, { songId: null, isPlaying: false, timestamp: Date.now() });
    evaluateUserAchievements(user.id).catch(() => {});
    res.json({ token, username: user.username, id: user.id });
  });

  app.get('/api/verify', authMiddleware, (req, res) => res.json({ valid: true, username: req.user.username, id: req.user.id }));
  app.get('/api/version', authMiddleware, async (req, res) => res.json(await readVersion()));

  app.post('/api/heartbeat', authMiddleware, async (req, res) => {
    // playlistId/playlistType son opcionales: si el cliente los manda,
    // se registra qué playlist está sonando para las estadísticas de
    // "playlist más escuchada". Clientes antiguos que no los manden
    // siguen funcionando exactamente igual que antes.
    const { songId, isPlaying, elapsedMs, playlistId, playlistType } = req.body;
    const prev = activeListeners.get(req.user.id);
    const now = Date.now();
    // Sólo cuenta como "nueva reproducción" si cambia la canción (o es la
    // primera vez que vemos a este usuario reproducir algo). Antes también
    // se disparaba con "!prev.isPlaying", lo que hacía que pausar y
    // reanudar la MISMA canción se contara como una reproducción nueva
    // (inflaba "canciones reproducidas", el contador de "misma canción
    // repetida" y disparaba logros de golpe). Un simple resume ya NO cuenta.
    const isNewPlay = !!(songId && isPlaying && (!prev || songId !== prev.songId));

    // IMPORTANTE: actualizar activeListeners AQUÍ, de forma síncrona y ANTES
    // de cualquier `await`. Si dos heartbeats casi simultáneos del mismo
    // usuario llegan a la vez (por ejemplo, un cliente con un bug que manda
    // el heartbeat dos veces al cambiar de canción), esto evita que ambos
    // lean el mismo `prev` desactualizado y los dos se cuenten como
    // "nueva reproducción" (duplicando el contador de reproducciones y
    // devolviendo el mismo logro dos veces al cliente). Node es de un solo
    // hilo: mientras no haya un `await` de por medio, este tramo se ejecuta
    // entero sin que otra petición pueda colarse.
    activeListeners.set(req.user.id, { songId, isPlaying: !!isPlaying, timestamp: now });

    if (typeof elapsedMs === 'number' && elapsedMs > 0 && elapsedMs < 7200000) {
      const elapsedSecs = Math.round(elapsedMs / 1000);
      const stats = await readStats();
      stats.totalListeningSeconds += elapsedSecs;
      const today = new Date().toISOString().slice(0, 10);
      stats.dailyListening[today] = (stats.dailyListening[today] || 0) + elapsedSecs;
      await writeStats(stats);
      addListeningSeconds(req.user.id, elapsedSecs).catch(() => {});
    }

    if (isNewPlay) {
      const stats = await readStats();
      stats.totalSongsPlayed++;
      await writeStats(stats);

      try {
        const data = await readData();
        const dataPl = await readDataPl();
        const song = findSongMeta(songId, data, dataPl);
        await recordSongPlay(req.user.id, { id: songId, title: song?.title, artist: song?.artist });

        if (playlistId) {
          const type = playlistType === 'folder' ? 'folder' : 'manual';
          let name;
          if (type === 'folder') {
            name = dataPl.playlists.find(p => p.id === playlistId)?.name;
          } else {
            name = (data.playlists || []).find(p => p.id === playlistId)?.name;
          }
          await recordPlaylistPlay(req.user.id, { id: playlistId, type, name });
        }
      } catch (e) {
        console.error('[HEARTBEAT] Error registrando estadísticas de usuario:', e.message);
      }
    }

    for (const [uid, data] of activeListeners.entries()) {
      if (now - data.timestamp > 180000) activeListeners.delete(uid);
    }

    const count = [...activeListeners.values()].filter(d => d.songId && now - d.timestamp < 180000).length;

    // Los logros se evalúan en cada cambio de canción (punto barato y
    // frecuente): así el cliente puede mostrar un toast casi al
    // instante sin tener que hacer polling aparte. evaluateUserAchievements
    // ya se protege sola contra llamadas concurrentes para el mismo
    // usuario (ver lib/achievements.js), así que aunque llegase a haber
    // dos heartbeats a la vez no se duplica el logro devuelto.
    let newAchievements = [];
    if (isNewPlay) {
      try { newAchievements = await evaluateUserAchievements(req.user.id); } catch {}
    }

    // Si el limitador de peticiones detecta que este usuario se está
    // acercando al límite (sin haberlo superado todavía), viaja aquí un
    // aviso amistoso para que el cliente lo muestre y la persona reduzca
    // la frecuencia antes de que le lleguemos a bloquear de verdad.
    const response = {
      activeListeners: count,
      newAchievements: newAchievements.map(a => ({ id: a.id, icon: a.icon, title: a.title, description: a.description })),
    };
    if (req.rateLimitWarning) response.warning = req.rateLimitWarning;
    res.json(response);
  });

  app.get('/api/listeners', authMiddleware, (req, res) => {
    const now = Date.now();
    const count = [...activeListeners.values()].filter(d => d.songId && now - d.timestamp < 120000).length;
    res.json({ count });
  });

  app.post('/api/latency', authMiddleware, async (req, res) => {
    const { latencyMs } = req.body;
    if (typeof latencyMs === 'number' && latencyMs > 0 && latencyMs < 30000) {
      const stats = await readStats();
      stats.latencySamples.push(latencyMs);
      if (stats.latencySamples.length > 100) stats.latencySamples.shift();
      await writeStats(stats);
    }
    res.json({ ok: true });
  });

  app.get('/api/songs', authMiddleware, async (req, res) => {
    const data = await readData();
    const files = await fs.promises.readdir(CANCIONES_DIR);
    const audioFiles = new Set(files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())));
    const before = data.songs.length;
    data.songs = data.songs.filter(s => audioFiles.has(s.filename));
    if (data.songs.length < before) await writeData(data);
    const { search } = req.query;
    let songs = data.songs;
    if (search) {
      const s = search.toLowerCase();
      songs = songs.filter(song => song.title.toLowerCase().includes(s) || song.artist.toLowerCase().includes(s));
    }
    res.json(songs);
  });

  app.get('/api/mysongs', authMiddleware, async (req, res) => {
    const users = await readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const data = await readData();
    const mySongIds = new Set(user.songs || []);
    res.json(data.songs.filter(s => mySongIds.has(s.id)));
  });

  app.post('/api/upload', authMiddleware, uploadLimiter, upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subi� archivo' });
    const data = await readData();
    if (data.songs.some(s => s.filename === req.file.filename)) return res.json(data.songs.find(s => s.filename === req.file.filename));
    const _uploadStart = Date.now();
    const song = await processAudioFile(req.file.filename);

    try {
      const stats = await readStats();
      stats.processingTimes.push(Date.now() - _uploadStart);
      if (stats.processingTimes.length > 100) stats.processingTimes.shift();
      await writeStats(stats);
    } catch {}

    data.songs.push(song);
    await writeData(data);
    const users = await readUsers();
    const userIdx = users.findIndex(u => u.id === req.user.id);
    if (userIdx >= 0) {
      if (!users[userIdx].songs) users[userIdx].songs = [];
      users[userIdx].songs.push(song.id);
      await writeUsers(users);
    }
    evaluateUserAchievements(req.user.id).catch(() => {});
    res.json(song);
  });

  app.put('/api/songs/:id', authMiddleware, async (req, res) => {
    const data = await readData();
    const idx = data.songs.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
    const { title, artist, album } = req.body;
    if (title !== undefined) data.songs[idx].title = title;
    if (artist !== undefined) data.songs[idx].artist = artist;
    if (album !== undefined) data.songs[idx].album = album;
    await writeData(data);
    res.json(data.songs[idx]);
  });

  app.delete('/api/songs/:id', authMiddleware, async (req, res) => {
    const data = await readData();
    const song = data.songs.find(s => s.id === req.params.id);
    if (!song) return res.status(404).json({ error: 'No encontrada' });
    try { await fs.promises.unlink(path.join(CANCIONES_DIR, song.filename)); } catch {}
    try { await fs.promises.unlink(path.join(CANCIONES_DIR, `${req.params.id}.jpg`)); } catch {}
    data.songs = data.songs.filter(s => s.id !== req.params.id);
    const users = await readUsers();
    for (const u of users) {
      u.favorites = (u.favorites || []).filter(id => id !== req.params.id);
      u.songs = (u.songs || []).filter(id => id !== req.params.id);
    }
    await writeUsers(users);
    await writeData(data);
    res.json({ success: true });
  });

  app.post('/api/songs/:id/cover', authMiddleware, uploadImage.single('cover'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No imagen' });
    const data = await readData();
    const idx = data.songs.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
    const ext = path.extname(req.file.filename).toLowerCase() || '.jpg';
    data.songs[idx].coverUrl = `/canciones/${req.params.id}${ext}`;
    await writeData(data);
    res.json(data.songs[idx]);
  });

  app.get('/api/favorites', authMiddleware, async (req, res) => {
    const users = await readUsers();
    const user = users.find(u => u.id === req.user.id);
    res.json(user?.favorites || []);
  });

  app.post('/api/favorites/:id', authMiddleware, async (req, res) => {
    const users = await readUsers();
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!users[idx].favorites) users[idx].favorites = [];
    if (!users[idx].favorites.includes(req.params.id)) {
      users[idx].favorites.push(req.params.id);
      await writeUsers(users);
      evaluateUserAchievements(req.user.id).catch(() => {});
    }
    res.json({ success: true });
  });

  app.delete('/api/favorites/:id', authMiddleware, async (req, res) => {
    const users = await readUsers();
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
    users[idx].favorites = (users[idx].favorites || []).filter(id => id !== req.params.id);
    await writeUsers(users);
    res.json({ success: true });
  });

  app.get('/api/playlists', authMiddleware, async (req, res) => {
    const data = await readData();
    res.json((data.playlists || []).filter(p => p.userId === req.user.id));
  });

  app.post('/api/playlists', authMiddleware, async (req, res) => {
    const data = await readData();
    if (!data.playlists) data.playlists = [];
    const playlist = { id: Date.now().toString(), name: req.body.name, songs: req.body.songs || [], coverColor: req.body.coverColor || '#1DB954', userId: req.user.id, createdAt: new Date().toISOString() };
    data.playlists.push(playlist);
    await writeData(data);
    evaluateUserAchievements(req.user.id).catch(() => {});
    res.json(playlist);
  });

  app.put('/api/playlists/:id', authMiddleware, async (req, res) => {
    const data = await readData();
    const idx = data.playlists.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
    data.playlists[idx] = { ...data.playlists[idx], ...req.body, id: req.params.id, userId: req.user.id };
    await writeData(data);
    res.json(data.playlists[idx]);
  });

  app.delete('/api/playlists/:id', authMiddleware, async (req, res) => {
    const data = await readData();
    data.playlists = (data.playlists || []).filter(p => !(p.id === req.params.id && p.userId === req.user.id));
    await writeData(data);
    res.json({ success: true });
  });

  app.get('/api/folderplaylists', authMiddleware, async (req, res) => {
    const data = await readDataPl();
    res.json(data.playlists);
  });

  app.post('/api/folderplaylists/sync', authMiddleware, async (req, res) => {
    await syncPlaylistDir();
    const data = await readDataPl();
    res.json({ success: true, count: data.playlists.length });
  });

  app.post('/api/sync', authMiddleware, async (req, res) => {
    const files = await fs.promises.readdir(CANCIONES_DIR);
    const audioFiles = new Set(files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())));
    const data = await readData();
    let added = 0;
    for (const filename of audioFiles) {
      if (!data.songs.some(s => s.filename === filename)) {
        data.songs.push(await processAudioFile(filename));
        added++;
      }
    }
    const before = data.songs.length;
    data.songs = data.songs.filter(s => audioFiles.has(s.filename));
    const removed = before - data.songs.length;
    await writeData(data);
    res.json({ success: true, added, removed, total: data.songs.length });
  });

  app.post('/api/recalculate-durations', authMiddleware, async (req, res) => {
    const data = await readData();
    let updated = 0;
    for (let i = 0; i < data.songs.length; i++) {
      if (!data.songs[i].duration || data.songs[i].duration < 1) {
        const dur = await getAudioDuration(path.join(CANCIONES_DIR, data.songs[i].filename));
        if (dur > 0) { data.songs[i].duration = dur; updated++; }
      }
    }
    await writeData(data);
    res.json({ success: true, updated });
  });

  // Recoge las carátulas .webp de la carpeta portadas/ para canciones que
  // ya existían en la base de datos (las nuevas ya la recogen solas al subirlas/escanearlas).
  app.post('/api/refresh-covers', authMiddleware, async (req, res) => {
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
  });

  app.get('/api/changelog', authMiddleware, async (req, res) => res.json(await readChangelog()));

  app.get('/api/ping', authMiddleware, (req, res) => res.json({ pong: Date.now() }));

  app.get('/api/stats', webAuthMiddleware, async (req, res) => {
    const stats = await readStats();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, seconds: stats.dailyListening[key] || 0 });
    }
    res.json({
      totalHours: Math.round(stats.totalListeningSeconds / 3600 * 10) / 10,
      totalListeningSeconds: stats.totalListeningSeconds,
      totalSongsPlayed: stats.totalSongsPlayed,
      avgLatencyMs: avg(stats.latencySamples),
      latencySamples: stats.latencySamples.slice(-20),
      avgProcessingMs: avg(stats.processingTimes),
      processingTimes: stats.processingTimes.slice(-20),
      dailyChart: days,
    });
  });

  // ── Logros ──────────────────────────────────────────────
  app.get('/api/achievements', authMiddleware, async (req, res) => {
    try {
      const achievements = await getUserAchievementsView(req.user.id);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener logros' });
    }
  });

  // Reclamo manual para logros "client_reported" (los que sólo el
  // cliente puede saber, ej. descargas offline). El servidor valida
  // que el logro exista y esté marcado como reclamable antes de
  // desbloquearlo; no se puede usar para desbloquear logros normales.
  app.post('/api/achievements/:id/claim', authMiddleware, async (req, res) => {
    try {
      const result = await claimClientAchievement(req.user.id, req.params.id);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error al reclamar logro' });
    }
  });

  // ── Estadísticas personales ──────────────────────────────
  app.get('/api/stats/me', authMiddleware, async (req, res) => {
    try {
      const [listening, daily, mostPlayedSong, mostPlayedPlaylist, streak] = await Promise.all([
        getUserListeningStats(req.user.id),
        getUserDailyListening(req.user.id, 30),
        getMostPlayedSong(req.user.id),
        getMostPlayedPlaylist(req.user.id),
        getCurrentStreak(req.user.id),
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

  app.get('/api/status', async (req, res) => {
    const data = await readData();
    const dataPl = await readDataPl();
    const users = await readUsers();
    const now = Date.now();
    const activeCount = [...activeListeners.values()].filter(d => d.songId && now - d.timestamp < 120000).length;
    const folderSongCount = dataPl.playlists.reduce((acc, p) => acc + (p.songs?.length || 0), 0);
    res.json({ songs: data.songs.length + folderSongCount, playlists: (data.playlists || []).length + dataPl.playlists.length, users: users.length, activeListeners: activeCount, status: 'OK' });
  });
}