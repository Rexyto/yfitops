import { create } from 'zustand';
import {
  pcFetchSongs, pcFetchFavorites, pcToggleFavorite,
  pcFetchPlaylists, pcFetchFolderPlaylists, pcUpdateSong,
  pcUploadCover, pcFetchListeners, pcHeartbeat, SERVER_URL,
} from '../api';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let _audio = null;
let _heartbeatInterval = null;  // intervalo del heartbeat
let _heartbeatStart = null;     // timestamp del último heartbeat, para calcular elapsedMs

// ── Discord Rich Presence ───────────────────────────────────
function sanitizeForDiscord(text, maxLen = 128) {
  if (!text) return null;
  // Corta cualquier cosa después de | (suele ser texto de descripción pegado al título de YouTube)
  let clean = text.split('|')[0].trim();
  // Quita coletillas comunes de YouTube
  clean = clean.replace(/\(Visualizer\)|\(Official.*?\)|\(Lyric.*?\)|\(Audio\)/gi, '').trim();
  if (clean.length > maxLen) clean = clean.slice(0, maxLen - 1).trim() + '…';
  return clean || null;
}

function updateDiscordPresence(song, { paused = false } = {}) {
  if (!song) return;

  const cleanTitle = sanitizeForDiscord(song.title, 128);
  const hasRealArtist = song.artist && song.artist.trim() && song.artist !== 'Desconocido';
  const cleanArtist = hasRealArtist ? sanitizeForDiscord(song.artist, 128) : null;

  window.electronAPI?.discordUpdate({
    title: cleanTitle || 'Canción sin título',
    artist: cleanArtist, // null si no hay artista real; discordRpc.js lo maneja
    coverUrl: song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null,
    paused,
  });
}

// ── Heartbeat ────────────────────────────────────────────────
// Llama al servidor cada 30s mientras hay canción reproduciéndose.
// Envía: songId, isPlaying, elapsedMs (tiempo real escuchado desde el último beat)
function startHeartbeat(getState) {
  stopHeartbeat();
  _heartbeatStart = Date.now();

  _heartbeatInterval = setInterval(async () => {
    const { token, currentSong, isPlaying } = getState();
    if (!token) return;

    const now = Date.now();
    const elapsedMs = isPlaying ? (now - (_heartbeatStart || now)) : 0;
    _heartbeatStart = now;

    try {
      const data = await pcHeartbeat(token, {
        songId: currentSong?.id || null,
        isPlaying,
        elapsedMs,
      });
      if (typeof data.activeListeners === 'number') {
        useMusicStore.setState({ activeListeners: data.activeListeners });
      }
    } catch {} // Sin conexión: ignorar silenciosamente
  }, 30000); // cada 30 segundos
}

function stopHeartbeat() {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
  _heartbeatStart = null;
}

// Envía un heartbeat inmediato (al cambiar canción o estado play/pause)
async function sendHeartbeatNow(token, songId, isPlaying, elapsedMs = 0) {
  if (!token) return;
  try {
    const data = await pcHeartbeat(token, { songId, isPlaying, elapsedMs });
    if (typeof data.activeListeners === 'number') {
      useMusicStore.setState({ activeListeners: data.activeListeners });
    }
  } catch {}
}

const useMusicStore = create((set, get) => ({
  token: null,
  username: null,
  songs: [],
  favorites: [],
  playlists: [],
  folderPlaylists: [],
  activeListeners: 0,
  currentSong: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  isLooping: false,
  currentPlaylist: [],
  currentIndex: 0,
  volume: 1,

  login: async (token, username) => {
    console.log('🔑 Iniciando login...', { token: token?.substring(0, 20) + '...', username });
    const cleanToken = typeof token === 'string' ? token.trim() : '';
    if (!cleanToken) {
      console.error('❌ Token vacío recibido');
      throw new Error('Token inválido recibido del servidor');
    }
    set({ token: cleanToken, username });
    await window.electronAPI?.setSession(cleanToken, username);
    console.log('✅ Token guardado, cargando datos...');
    await get().fetchAll(cleanToken);
    // Arrancar heartbeat al iniciar sesión
    startHeartbeat(get);
  },

  logout: () => {
    stopHeartbeat();
    get().stopAudio();
    window.electronAPI?.clearSession();
    set({
      token: null, username: null,
      songs: [], favorites: [], playlists: [], folderPlaylists: [],
      currentSong: null, isPlaying: false, position: 0, duration: 0,
    });
  },

  fetchAll: async (token) => {
    console.log('📥 fetchAll iniciado con token:', token?.substring(0, 20) + '...');
    const t = token || get().token;
    if (!t) {
      console.error('❌ No hay token para fetchAll');
      return;
    }
    console.log('📥 Cargando: songs, favorites, playlists, folderPlaylists...');
    const [songs, favorites, playlists, folderPlaylists] = await Promise.all([
      pcFetchSongs(t),
      pcFetchFavorites(t),
      pcFetchPlaylists(t),
      pcFetchFolderPlaylists(t),
    ]);
    console.log('✅ Datos cargados:', { songs: songs?.length, favorites: favorites?.length, playlists: playlists?.length, folderPlaylists: folderPlaylists?.length });
    set({ songs, favorites, playlists, folderPlaylists });
  },

  fetchSongs: async () => {
    const songs = await pcFetchSongs(get().token);
    set({ songs });
  },

  fetchListeners: async () => {
    const count = await pcFetchListeners(get().token);
    set({ activeListeners: count });
  },

  toggleFavorite: async (songId) => {
    const isFav = get().favorites.includes(songId);
    set({ favorites: isFav ? get().favorites.filter(id => id !== songId) : [...get().favorites, songId] });
    const updated = await pcToggleFavorite(get().token, songId, isFav);
    set({ favorites: updated });
  },

  updateSong: async (songId, updates) => {
    const updated = await pcUpdateSong(get().token, songId, updates);
    set({ songs: get().songs.map(s => s.id === songId ? updated : s) });
    if (get().currentSong?.id === songId) set({ currentSong: updated });
  },

  uploadCover: async (songId, file) => {
    const updated = await pcUploadCover(get().token, songId, file);
    set({ songs: get().songs.map(s => s.id === songId ? updated : s) });
    if (get().currentSong?.id === songId) {
      set({ currentSong: updated });
      // La carátula cambió en la canción que está sonando: refrescar presencia
      updateDiscordPresence(updated, { paused: !get().isPlaying });
    }
  },

  stopAudio: () => {
    if (_audio) { _audio.pause(); _audio.src = ''; _audio = null; }
    set({ isPlaying: false, position: 0 });
    window.electronAPI?.discordClear();
  },

  playSong: (song, playlist = []) => {
    const { token } = get();

    // Calcular tiempo escuchado antes de cambiar de canción
    const elapsedMs = _heartbeatStart ? Date.now() - _heartbeatStart : 0;
    _heartbeatStart = Date.now();

    if (_audio) { _audio.pause(); _audio.src = ''; _audio = null; }

    const pl = playlist.length > 0 ? playlist : [song];
    const idx = pl.findIndex(s => s.id === song.id);

    _audio = new Audio(`${SERVER_URL}${song.url}`);
    _audio.volume = get().volume;

    _audio.addEventListener('timeupdate',     () => set({ position: _audio.currentTime * 1000 }));
    _audio.addEventListener('loadedmetadata', () => set({ duration: _audio.duration * 1000 }));
    _audio.addEventListener('ended', () => {
      const { isLooping, currentIndex, currentPlaylist } = get();
      if (isLooping) { _audio.currentTime = 0; _audio.play(); return; }
      get().playSong(currentPlaylist[(currentIndex + 1) % currentPlaylist.length], currentPlaylist);
    });
    _audio.addEventListener('play',  () => {
      set({ isPlaying: true });
      _heartbeatStart = Date.now();
      sendHeartbeatNow(get().token, get().currentSong?.id, true, 0);
      updateDiscordPresence(get().currentSong, { paused: false });
    });
    _audio.addEventListener('pause', () => {
      const elapsed = _heartbeatStart ? Date.now() - _heartbeatStart : 0;
      _heartbeatStart = null;
      set({ isPlaying: false });
      sendHeartbeatNow(get().token, get().currentSong?.id, false, elapsed);
      updateDiscordPresence(get().currentSong, { paused: true });
    });

    _audio.play().catch(() => {});

    set({
      currentSong: song,
      currentPlaylist: pl,
      currentIndex: idx >= 0 ? idx : 0,
      isPlaying: true,
      position: 0,
    });

    // Heartbeat inmediato al cambiar canción
    sendHeartbeatNow(token, song.id, true, elapsedMs);

    // Presencia de Discord para la nueva canción
    updateDiscordPresence(song, { paused: false });
  },

  pauseSong: () => {
    const elapsed = _heartbeatStart ? Date.now() - _heartbeatStart : 0;
    _heartbeatStart = null;
    _audio?.pause();
    sendHeartbeatNow(get().token, get().currentSong?.id, false, elapsed);
    // La presencia se actualiza automáticamente vía el listener 'pause' del audio
  },

  resumeSong: () => {
    _heartbeatStart = Date.now();
    _audio?.play();
    sendHeartbeatNow(get().token, get().currentSong?.id, true, 0);
    // La presencia se actualiza automáticamente vía el listener 'play' del audio
  },

  playNext: () => {
    const { currentPlaylist, currentIndex } = get();
    if (!currentPlaylist.length) return;
    get().playSong(currentPlaylist[(currentIndex + 1) % currentPlaylist.length], currentPlaylist);
  },

  playPrevious: () => {
    const { currentPlaylist, currentIndex } = get();
    if (!currentPlaylist.length) return;
    const prev = currentIndex === 0 ? currentPlaylist.length - 1 : currentIndex - 1;
    get().playSong(currentPlaylist[prev], currentPlaylist);
  },

  seekTo:      (ms) => { if (_audio) _audio.currentTime = ms / 1000; set({ position: ms }); },
  setPosition: (ms) => set({ position: ms }),
  toggleLoop:  () => set(s => ({ isLooping: !s.isLooping })),

  setVolume: (v) => {
    set({ volume: v });
    if (_audio) _audio.volume = v;
  },

  playShuffle: (songs) => {
    if (!songs.length) return;
    const shuffled = shuffle(songs);
    get().playSong(shuffled[0], shuffled);
  },
}));

export default useMusicStore;