export default function globalRoutes(app) {
  app.get('/health', (req, res) => res.json({ status: 'OK' }));
  
  app.get('/status', async (req, res) => {
    const { readData, readDataPl, readUsers } = await import('../lib/storage.js');
    const { activeListeners } = await import('../lib/activeListeners.js');
    const data = await readData();
    const dataPl = await readDataPl();
    const users = await readUsers();
    const now = Date.now();
    const activeCount = [...activeListeners.values()].filter(d => d.songId && now - d.timestamp < 120000).length;
    const folderSongCount = dataPl.playlists.reduce((acc, p) => acc + (p.songs?.length || 0), 0);
    res.json({ 
      songs: data.songs.length + folderSongCount, 
      playlists: (data.playlists || []).length + dataPl.playlists.length, 
      users: users.length, 
      activeListeners: activeCount, 
      status: 'OK' 
    });
  });
}
