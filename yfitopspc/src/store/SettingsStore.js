import { create } from 'zustand';

const THEME_KEY = 'yfitops_theme';
const LANG_KEY = 'yfitops_language';

// ── Temas disponibles ─────────────────────────────────────────
// `swatch` son los 2 colores que se pintan en la bolita del selector
// (estilo Discord): [color principal, color secundario].
// Paletas de referencia: iOS/macOS (rojo, ámbar, rosa, turquesa),
// Telegram (celeste), Discord (morado, índigo/blurple), WhatsApp
// (verde) y SoundCloud (naranja).
export const THEMES = [
  { id: 'dark',     swatch: ['#1a1a1a', '#0a0a0a'] },
  { id: 'light',    swatch: ['#ffffff', '#e2e2e2'] },
  { id: 'red',      swatch: ['#FF3B30', '#ffffff'] },
  { id: 'sky',      swatch: ['#2AABEE', '#ffffff'] },
  { id: 'purple',   swatch: ['#BF5AF2', '#1e1a24'] },
  { id: 'green',    swatch: ['#25D366', '#ffffff'] },
  { id: 'orange',   swatch: ['#FF5500', '#ffffff'] },
  { id: 'amber',    swatch: ['#FFCC00', '#ffffff'] },
  { id: 'pink',     swatch: ['#FF375F', '#241118'] },
  { id: 'teal',     swatch: ['#30B0C7', '#0f1f21'] },
  { id: 'indigo',   swatch: ['#5865F2', '#171a24'] },
];
const THEME_IDS = THEMES.map(t => t.id);

function applyThemeToDocument(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function detectDefaultLanguage() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {}
  // Si el usuario nunca ha elegido idioma, usamos el del sistema como pista
  const nav = (navigator.language || 'es').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'es';
}

function fmtBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

const useSettingsStore = create((set, get) => ({
  // ── Apariencia ────────────────────────────────────────────
  theme: THEME_IDS.includes(localStorage.getItem(THEME_KEY)) ? localStorage.getItem(THEME_KEY) : 'dark',
  language: detectDefaultLanguage(),

  // ── Perfil ────────────────────────────────────────────────
  profilePicture: null,       // dataURL o null
  profileLoading: true,

  // ── Sistema ───────────────────────────────────────────────
  launchOnStartup: true,

  // ── Conectividad ──────────────────────────────────────────
  isOnline: navigator.onLine,

  // ── Descargas / caché ─────────────────────────────────────
  offlinePlaylists: [],       // [{ id, name, type, coverColor, coverUrl, totalDuration, songs: [...] }]
  downloadedSongIds: [],
  cacheBytes: 0,
  downloadingIds: [],         // ids de playlist en proceso de descarga
  downloadProgress: {},        // { [playlistId]: { done, total } }

  // ── Inicialización (llamar una vez al montar la app) ───────
  init: async () => {
    applyThemeToDocument(get().theme);

    // Conectividad
    const setOnline = () => set({ isOnline: true });
    const setOffline = () => set({ isOnline: false });
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    set({ isOnline: navigator.onLine });

    // Foto de perfil
    try {
      const pic = await window.electronAPI?.getProfilePicture();
      set({ profilePicture: pic || null, profileLoading: false });
    } catch {
      set({ profileLoading: false });
    }

    // Inicio automático con el sistema (activado por defecto la primera vez)
    try {
      const enabled = await window.electronAPI?.getLaunchOnStartup();
      set({ launchOnStartup: typeof enabled === 'boolean' ? enabled : true });
    } catch {}

    await get().refreshDownloads();
  },

  // ── Tema ────────────────────────────────────────────────────
  setTheme: (theme) => {
    if (!THEME_IDS.includes(theme)) return;
    localStorage.setItem(THEME_KEY, theme);
    applyThemeToDocument(theme);
    set({ theme });
  },

  // ── Idioma ──────────────────────────────────────────────────
  setLanguage: (language) => {
    localStorage.setItem(LANG_KEY, language);
    set({ language });
  },

  // ── Inicio con el sistema ────────────────────────────────────
  setLaunchOnStartup: async (enabled) => {
    set({ launchOnStartup: enabled }); // optimista
    try {
      const res = await window.electronAPI?.setLaunchOnStartup(enabled);
      if (res?.success === false) throw new Error();
    } catch {
      // Si falla, revertimos a lo que había
      set({ launchOnStartup: !enabled });
    }
  },

  // ── Foto de perfil ────────────────────────────────────────
  uploadProfilePicture: async (file) => {
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(file);
    });
    const res = await window.electronAPI?.saveProfilePicture(dataUrl);
    if (res?.success === false) throw new Error(res.error || 'Error guardando la foto');
    set({ profilePicture: dataUrl });
  },

  removeProfilePicture: async () => {
    await window.electronAPI?.clearProfilePicture();
    set({ profilePicture: null });
  },

  // ── Descargas offline ─────────────────────────────────────
  refreshDownloads: async () => {
    try {
      const [offlinePlaylists, info, cacheBytes] = await Promise.all([
        window.electronAPI?.getOfflinePlaylists().catch(() => []),
        window.electronAPI?.getDownloadsInfo().catch(() => ({ songIds: [], totalBytes: 0 })),
        window.electronAPI?.getCacheSize().catch(() => 0),
      ]);
      set({
        offlinePlaylists: offlinePlaylists || [],
        downloadedSongIds: info?.songIds || [],
        cacheBytes: cacheBytes || 0,
      });
    } catch {}
  },

  isPlaylistDownloaded: (playlistId) => get().offlinePlaylists.some(p => p.id === playlistId),

  // Descarga una playlist entera: audio de cada canción + metadatos.
  // `songsForPlaylist` ya debe venir resuelto (array de objetos Song completos).
  downloadPlaylist: async (meta, songsForPlaylist) => {
    const { id } = meta;
    if (get().downloadingIds.includes(id)) return;
    set(s => ({ downloadingIds: [...s.downloadingIds, id], downloadProgress: { ...s.downloadProgress, [id]: { done: 0, total: songsForPlaylist.length } } }));

    try {
      for (let i = 0; i < songsForPlaylist.length; i++) {
        const song = songsForPlaylist[i];
        const already = await window.electronAPI?.isSongDownloaded(song.id);
        if (!already) {
          await window.electronAPI?.downloadSong(song.id, song._fullUrl);
        }
        set(s => ({ downloadProgress: { ...s.downloadProgress, [id]: { done: i + 1, total: songsForPlaylist.length } } }));
      }

      await window.electronAPI?.saveOfflinePlaylist({
        id: meta.id,
        name: meta.name,
        type: meta.type,
        coverColor: meta.coverColor || null,
        coverUrl: meta.coverUrl || null,
        totalDuration: meta.totalDuration || null,
        songs: songsForPlaylist.map(s => ({
          id: s.id, title: s.title, artist: s.artist,
          duration: s.duration, coverUrl: s.coverUrl || null,
        })),
      });
    } finally {
      set(s => ({ downloadingIds: s.downloadingIds.filter(x => x !== id) }));
      await get().refreshDownloads();
    }
  },

  removeOfflinePlaylist: async (playlistId) => {
    await window.electronAPI?.deleteOfflinePlaylist(playlistId);
    await get().refreshDownloads();
  },

  clearCache: async () => {
    await window.electronAPI?.clearSongCache();
    await get().refreshDownloads();
  },

  cacheSizeLabel: () => fmtBytes(get().cacheBytes),
}));

export default useSettingsStore;