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
});