import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { Directory, File, Paths } from 'expo-file-system';

const LANG_KEY = 'yfitops_language';
const PROFILE_PIC_KEY = 'yfitops_profile_picture_uri';
const OFFLINE_PLAYLISTS_KEY = 'yfitops_offline_playlists';

const downloadsDir = new Directory(Paths.document, 'yfitops-downloads');

function ensureDownloadsDir() {
  try { if (!downloadsDir.exists) downloadsDir.create(); } catch {}
}

function fmtBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

async function readOfflinePlaylists() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PLAYLISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
async function writeOfflinePlaylists(list) {
  try { await AsyncStorage.setItem(OFFLINE_PLAYLISTS_KEY, JSON.stringify(list)); } catch {}
}

function findDownloadedFile(songId) {
  ensureDownloadsDir();
  try {
    const entries = downloadsDir.list();
    return entries.find(e => e.name?.startsWith(`${songId}.`)) || null;
  } catch { return null; }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [language, setLanguageState] = useState('es');
  const [profilePicture, setProfilePicture] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [offlinePlaylists, setOfflinePlaylists] = useState([]);
  const [downloadedSongIds, setDownloadedSongIds] = useState([]);
  const [cacheBytes, setCacheBytes] = useState(0);
  const [downloadingIds, setDownloadingIds] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});

  const initedRef = useRef(false);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem(LANG_KEY);
        if (savedLang === 'en' || savedLang === 'es') setLanguageState(savedLang);
      } catch {}
      try {
        const savedPic = await AsyncStorage.getItem(PROFILE_PIC_KEY);
        if (savedPic) {
          const f = new File(savedPic);
          if (f.exists) setProfilePicture(savedPic);
          else await AsyncStorage.removeItem(PROFILE_PIC_KEY);
        }
      } catch {}
      await refreshDownloads();
    })();

    const unsubscribeNet = NetInfo.addEventListener(state => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });

    return () => unsubscribeNet();
  }, []);

  const setLanguage = async (lang) => {
    setLanguageState(lang);
    try { await AsyncStorage.setItem(LANG_KEY, lang); } catch {}
  };

  // ── Foto de perfil (solo local, nunca se sube al servidor) ─────
  const uploadProfilePicture = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') throw new Error('no-permission');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const picked = result.assets[0];
    const ext = (picked.uri.split('.').pop() || 'jpg').split('?')[0];
    const dest = new File(Paths.document, `profile-picture.${ext}`);
    try {
      // Sustituye cualquier foto anterior
      const existing = await AsyncStorage.getItem(PROFILE_PIC_KEY);
      if (existing) { try { new File(existing).delete(); } catch {} }
      const src = new File(picked.uri);
      src.copy(dest);
      await AsyncStorage.setItem(PROFILE_PIC_KEY, dest.uri);
      setProfilePicture(dest.uri);
    } catch (e) {
      throw new Error('save-failed');
    }
  };

  const removeProfilePicture = async () => {
    try {
      const existing = await AsyncStorage.getItem(PROFILE_PIC_KEY);
      if (existing) { try { new File(existing).delete(); } catch {} }
      await AsyncStorage.removeItem(PROFILE_PIC_KEY);
    } catch {}
    setProfilePicture(null);
  };

  // ── Descargas offline ────────────────────────────────────────
  const refreshDownloads = async () => {
    ensureDownloadsDir();
    try {
      const list = await readOfflinePlaylists();
      setOfflinePlaylists(list);
      const entries = downloadsDir.list();
      let total = 0;
      const ids = [];
      for (const e of entries) {
        try {
          total += e.size || 0;
          const base = e.name.includes('.') ? e.name.slice(0, e.name.lastIndexOf('.')) : e.name;
          ids.push(base);
        } catch {}
      }
      setDownloadedSongIds(ids);
      setCacheBytes(total);
    } catch {}
  };

  const isPlaylistDownloaded = (playlistId) => offlinePlaylists.some(p => p.id === playlistId);

  const getLocalSongPath = async (songId) => {
    const f = findDownloadedFile(songId);
    return f ? f.uri : null;
  };

  // songsForPlaylist: array de Song completos, cada uno con `_fullUrl` (URL absoluta)
  const downloadPlaylist = async (meta, songsForPlaylist) => {
    const { id } = meta;
    if (downloadingIds.includes(id)) return;
    ensureDownloadsDir();
    setDownloadingIds(prev => [...prev, id]);
    setDownloadProgress(prev => ({ ...prev, [id]: { done: 0, total: songsForPlaylist.length } }));

    try {
      for (let i = 0; i < songsForPlaylist.length; i++) {
        const song = songsForPlaylist[i];
        const already = findDownloadedFile(song.id);
        if (!already) {
          try {
            const ext = (song.url?.split('.').pop() || 'mp3').split('?')[0];
            const target = new File(downloadsDir, `${song.id}.${ext}`);
            // Descargamos directamente con el nombre final (<songId>.<ext>) en vez
            // de dejar que expo-file-system elija el nombre (lo saca de las
            // cabeceras de la respuesta del servidor, que no siempre coincide con
            // la URL) y luego intentar adivinarlo para renombrarlo — eso fallaba
            // en silencio y dejaba el archivo real con un nombre que nunca
            // volvíamos a encontrar.
            await File.downloadFileAsync(song._fullUrl, target, { idempotent: true });
          } catch (e) {
            console.log('download error:', song.id, e.message);
          }
        }
        setDownloadProgress(prev => ({ ...prev, [id]: { done: i + 1, total: songsForPlaylist.length } }));
      }

      const list = await readOfflinePlaylists();
      const next = [
        ...list.filter(p => p.id !== id),
        {
          id: meta.id, name: meta.name, type: meta.type,
          coverColor: meta.coverColor || null, coverUrl: meta.coverUrl || null,
          totalDuration: meta.totalDuration || null,
          songs: songsForPlaylist.map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration, coverUrl: s.coverUrl || null })),
          downloadedAt: Date.now(),
        },
      ];
      await writeOfflinePlaylists(next);
    } finally {
      setDownloadingIds(prev => prev.filter(x => x !== id));
      await refreshDownloads();
    }
  };

  const removeOfflinePlaylist = async (playlistId) => {
    const list = await readOfflinePlaylists();
    const target = list.find(p => p.id === playlistId);
    if (target) {
      const others = list.filter(p => p.id !== playlistId);
      const stillUsed = new Set(others.flatMap(p => (p.songs || []).map(s => s.id)));
      for (const song of target.songs || []) {
        if (!stillUsed.has(song.id)) {
          const f = findDownloadedFile(song.id);
          if (f) { try { f.delete(); } catch {} }
        }
      }
      await writeOfflinePlaylists(others);
    }
    await refreshDownloads();
  };

  const clearCache = async () => {
    ensureDownloadsDir();
    try {
      for (const e of downloadsDir.list()) { try { e.delete(); } catch {} }
    } catch {}
    await writeOfflinePlaylists([]);
    await refreshDownloads();
  };

  const cacheSizeLabel = () => fmtBytes(cacheBytes);

  return (
    <SettingsContext.Provider value={{
      language, setLanguage,
      profilePicture, uploadProfilePicture, removeProfilePicture,
      isOnline,
      offlinePlaylists, downloadedSongIds, cacheBytes, cacheSizeLabel,
      downloadingIds, downloadProgress,
      isPlaylistDownloaded, downloadPlaylist, removeOfflinePlaylist, clearCache,
      refreshDownloads, getLocalSongPath,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
