const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Ventana
  minimize:  () => ipcRenderer.invoke('window-minimize'),
  maximize:  () => ipcRenderer.invoke('window-maximize'),
  close:     () => ipcRenderer.invoke('window-close'),
  // Sesión persistida en disco
  getSession:   ()               => ipcRenderer.invoke('get-session'),
  setSession:   (token, user)    => ipcRenderer.invoke('set-session', token, user),
  clearSession: ()               => ipcRenderer.invoke('clear-session'),
  getAppVersion: ()              => ipcRenderer.invoke('get-app-version'),
  openExternal: (url)            => ipcRenderer.invoke('open-external', url),
  // Discord Rich Presence
  discordUpdate: (payload)       => ipcRenderer.invoke('discord-now-playing', payload),
  discordClear:  ()               => ipcRenderer.invoke('discord-clear-presence'),
  // Foto de perfil (guardada solo en este dispositivo)
  saveProfilePicture:  (dataUrl) => ipcRenderer.invoke('save-profile-picture', dataUrl),
  getProfilePicture:   ()        => ipcRenderer.invoke('get-profile-picture'),
  clearProfilePicture: ()        => ipcRenderer.invoke('clear-profile-picture'),
  // Descargas offline
  downloadSong:        (songId, url) => ipcRenderer.invoke('download-song', songId, url),
  deleteSongFile:      (songId)      => ipcRenderer.invoke('delete-song-file', songId),
  isSongDownloaded:    (songId)      => ipcRenderer.invoke('is-song-downloaded', songId),
  getLocalSongPath:    (songId)      => ipcRenderer.invoke('get-local-song-path', songId),
  getDownloadsInfo:    ()            => ipcRenderer.invoke('get-downloads-info'),
  saveOfflinePlaylist:   (playlist)    => ipcRenderer.invoke('save-offline-playlist', playlist),
  getOfflinePlaylists:   ()            => ipcRenderer.invoke('get-offline-playlists'),
  deleteOfflinePlaylist: (playlistId)  => ipcRenderer.invoke('delete-offline-playlist', playlistId),
  // Caché
  getCacheSize:   () => ipcRenderer.invoke('get-cache-size'),
  clearSongCache: () => ipcRenderer.invoke('clear-song-cache'),
  // Inicio automático con el sistema
  getLaunchOnStartup: ()          => ipcRenderer.invoke('get-launch-on-startup'),
  setLaunchOnStartup: (enabled)   => ipcRenderer.invoke('set-launch-on-startup', enabled),
});