import { botAuthMiddleware } from '../lib/auth.js';
import { readDataPl, readData, writeDataPl } from '../lib/storage.js';
import { syncPlaylistDir } from '../lib/watchers.js';

export default function botRoutes(app) {
  app.get('/bot/songs', botAuthMiddleware, async (req, res) => {
    const data = await readData();
    const { search } = req.query;
    let songs = data.songs;
    if (search) {
      const s = search.toLowerCase();
      songs = songs.filter(song => song.title.toLowerCase().includes(s) || song.artist.toLowerCase().includes(s));
    }
    res.json(songs);
  });

  app.get('/bot/playlists', botAuthMiddleware, async (req, res) => {
    const data = await readDataPl();
    res.json(data.playlists.map(p => ({ id: p.id, name: p.name, songCount: p.songs.length, coverUrl: p.coverUrl })));
  });

  app.get('/bot/playlists/:name/songs', botAuthMiddleware, async (req, res) => {
    const data = await readDataPl();
    const playlist = data.playlists.find(p => p.name.toLowerCase() === req.params.name.toLowerCase());
    if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
    res.json(playlist.songs);
  });

  app.get('/bot/random-playlist', botAuthMiddleware, async (req, res) => {
    const data = await readDataPl();
    if (!data.playlists.length) return res.status(404).json({ error: 'No hay playlists' });
    const playlist = data.playlists[Math.floor(Math.random() * data.playlists.length)];
    res.json(playlist);
  });

  app.post('/bot/sync', botAuthMiddleware, async (req, res) => {
    await syncPlaylistDir();
    const data = await readDataPl();
    res.json({ success: true, count: data.playlists.length });
  });

  app.get('/bot/stats', botAuthMiddleware, async (req, res) => {
    const data = await readData();
    const dataPl = await readDataPl();
    const totalSongs = data.songs.length + dataPl.playlists.reduce((acc, p) => acc + (p.songs?.length || 0), 0);
    res.json({ totalSongs, totalPlaylists: dataPl.playlists.length });
  });
}
