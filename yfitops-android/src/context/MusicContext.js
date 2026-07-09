import React, { createContext, useState, useEffect, useRef } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { useSettings } from './SettingsContext';

export const MusicContext = createContext();

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://yfitops.duckdns.org';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

let notificationReady = false;
// Si se pide actualizar la notificación antes de tener permiso/canal listos,
// la guardamos y la aplicamos en cuanto esté todo listo — así la primera
// canción reproducida nunca se queda sin notificación silenciosamente.
let pendingNotification = null;

async function setupNotifications() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('music-channel', {
        name: 'Reproducción de música',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null, vibrationPattern: null, showBadge: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableLights: false, enableVibrate: false,
      });
      await Notifications.setNotificationCategoryAsync('music-controls', [
        { identifier: 'prev',   buttonTitle: '⏮ Anterior',   options: { opensAppToForeground: false } },
        { identifier: 'toggle', buttonTitle: '⯈ Play/Pausa', options: { opensAppToForeground: false } },
        { identifier: 'next',   buttonTitle: '⏭ Siguiente',  options: { opensAppToForeground: false } },
      ]);
    }
    notificationReady = true;
    if (pendingNotification) {
      const { song, playing } = pendingNotification;
      pendingNotification = null;
      updateNotification(song, playing);
    }
  } catch (e) { console.log('notifications:', e.message); }
}

async function updateNotification(song, playing) {
  if (!song) return;
  if (!notificationReady) { pendingNotification = { song, playing }; return; }
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: 'music-player',
      content: {
        title: song.title,
        body: `${song.artist}  ${playing ? '▶' : '⏸'}`,
        categoryIdentifier: 'music-controls',
        data: { type: 'music' },
        sticky: true, autoDismiss: false, color: '#1ed760',
      },
      trigger: null,
    });
  } catch {}
}

async function dismissNotification() {
  pendingNotification = null;
  try { await Notifications.dismissAllNotificationsAsync(); } catch {}
}

export const MusicProvider = ({ children, token, onLogout }) => {
  const { getLocalSongPath } = useSettings();
  const safeLocalPath = async (songId) => {
    try { return getLocalSongPath ? await getLocalSongPath(songId) : null; } catch { return null; }
  };
  const [songs, setSongs]                     = useState([]);
  const [currentSong, setCurrentSong]         = useState(null);
  const [isPlaying, setIsPlaying]             = useState(false);
  const [position, setPosition]               = useState(0);
  const [duration, setDuration]               = useState(0);
  const [favorites, setFavorites]             = useState([]);
  const [playlists, setPlaylists]             = useState([]);
  const [isLooping, setIsLooping]             = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [folderPlaylists, setFolderPlaylists] = useState([]);
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [currentPlaylist, setCurrentPlaylist] = useState([]);
  const [activeListeners, setActiveListeners] = useState(0);

  const sound              = useRef(null);
  const nextSound          = useRef(null);
  const nextSongMeta       = useRef(null);
  const isPreloading       = useRef(false);

  const currentIndexRef    = useRef(0);
  const currentPlaylistRef = useRef([]);
  const isLoopingRef       = useRef(false);
  const currentSongRef     = useRef(null);
  const isPlayingRef       = useRef(false);
  const positionRef        = useRef(0);
  const playStartTimeRef   = useRef(null);
  const durationRef        = useRef(0);
  const endTimerRef        = useRef(null);
  const advancedRef        = useRef(false);

  // ── Guard anti doble-play ─────────────────────────────────────
  // Cada llamada a playSong recibe un token único.
  // Si mientras está cargando llega otra llamada, el token sube
  // y la carga antigua descarta su resultado al terminar.
  const loadTokenRef       = useRef(0);

  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenRef.current}`,
  });

  const flushPlayTime = (songId) => {
    if (!playStartTimeRef.current || !isPlayingRef.current) return;
    const elapsedMs = Date.now() - playStartTimeRef.current;
    playStartTimeRef.current = null;
    if (elapsedMs < 1000) return;
    fetch(`${SERVER_URL}/api/heartbeat`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ songId: songId || currentSongRef.current?.id, isPlaying: false, elapsedMs }),
    }).catch(() => {});
  };

  // ── Fuente única de verdad para "está sonando" ────────────────
  // Se llama tanto desde acciones del usuario (pausar/reanudar) como
  // desde el estado real que reporta expo-av (status.isPlaying). Esto es
  // clave: si el sistema pausa el audio por una llamada, por otra app
  // (TikTok, etc.) o por desconectar los auriculares, ese cambio también
  // pasa por aquí y mantiene el estado, la notificación y el temporizador
  // de fin de canción sincronizados con la realidad — no con lo que
  // nosotros creemos que está pasando.
  const syncPlayingState = (playingNow) => {
    if (isPlayingRef.current === playingNow) return;

    if (!playingNow) {
      // Aún con isPlayingRef en true: permite que flushPlayTime calcule
      // el tiempo escuchado antes de marcar la pausa.
      flushPlayTime(currentSongRef.current?.id);
      if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    }

    isPlayingRef.current = playingNow;
    setIsPlaying(playingNow);

    if (playingNow) {
      playStartTimeRef.current = Date.now();
      // Reprograma el temporizador de seguridad según la posición real,
      // no según cuánto tiempo de reloj ha pasado (eso es lo que causaba
      // saltos de canción al pausar/interrumpir la reproducción).
      if (durationRef.current > 0 && positionRef.current < durationRef.current - 300) {
        scheduleEndTimer(durationRef.current, positionRef.current);
      }
    }

    updateNotification(currentSongRef.current, playingNow);
  };

  // ── Precargar siguiente canción ──────────────────────────────
  const preloadNext = async () => {
    if (isPreloading.current) return;
    const pl  = currentPlaylistRef.current;
    if (pl.length <= 1) return;
    const nextIdx  = (currentIndexRef.current + 1) % pl.length;
    const nextSong = pl[nextIdx];
    if (nextSongMeta.current?.id === nextSong.id && nextSound.current) return;
    isPreloading.current = true;
    try {
      if (nextSound.current) {
        const old = nextSound.current;
        nextSound.current = null;
        nextSongMeta.current = null;
        old.unloadAsync().catch(() => {});
      }
      const { sound: pre } = await Audio.Sound.createAsync(
        { uri: (await safeLocalPath(nextSong.id)) || `${SERVER_URL}${nextSong.url}` },
        { shouldPlay: false, progressUpdateIntervalMillis: 0 },
        null, false
      );
      nextSound.current    = pre;
      nextSongMeta.current = nextSong;
    } catch (e) {
      console.log('preload error:', e.message);
    } finally {
      isPreloading.current = false;
    }
  };

  // ── Timer de fin ─────────────────────────────────────────────
  const scheduleEndTimer = (durationMs, positionMs = 0) => {
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    const remaining = durationMs - positionMs;
    if (remaining < 300) { doAdvance(); return; }
    endTimerRef.current = setTimeout(doAdvance, remaining + 1500);
  };

  // ── Avanzar a la siguiente ───────────────────────────────────
  const doAdvance = async () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }

    if (isLoopingRef.current) {
      advancedRef.current = false;
      sound.current?.replayAsync().catch(() => {});
      return;
    }

    const pl = currentPlaylistRef.current;

    // Canción suelta (sin playlist real) o playlist vacía: no hay
    // "siguiente" a la que saltar. Antes esto repetía la misma canción
    // para siempre incluso con el bucle desactivado — ahora simplemente
    // se detiene, que es el comportamiento esperado.
    if (pl.length <= 1) {
      advancedRef.current = false;
      flushPlayTime(currentSongRef.current?.id);
      isPlayingRef.current = false;
      setIsPlaying(false);
      setPosition(0);
      updateNotification(currentSongRef.current, false);
      return;
    }
    const nextIdx  = (currentIndexRef.current + 1) % pl.length;
    const nextSong = pl[nextIdx];

    flushPlayTime(currentSongRef.current?.id);

    const oldSound = sound.current;
    sound.current = null;
    if (oldSound) oldSound.stopAsync().catch(() => {}).finally(() => oldSound.unloadAsync().catch(() => {}));

    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    advancedRef.current = false;
    endTimerRef.current = null;

    // ── Usar precarga si está disponible ────────────────────────
    const preloaded     = nextSound.current;
    const preloadedMeta = nextSongMeta.current;

    if (preloaded && preloadedMeta?.id === nextSong.id) {
      nextSound.current    = null;
      nextSongMeta.current = null;

      preloaded.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        positionRef.current = status.positionMillis;
        if (status.durationMillis > 0) { setDuration(status.durationMillis); durationRef.current = status.durationMillis; }
        if (typeof status.isPlaying === 'boolean') syncPlayingState(status.isPlaying);
        if (status.didJustFinish) doAdvance();
      });

      try {
        await preloaded.playAsync();
        sound.current = preloaded;

        playStartTimeRef.current = Date.now();
        isPlayingRef.current = true;
        positionRef.current = 0;
        setCurrentSong(nextSong);
        currentSongRef.current = nextSong;
        setIsPlaying(true);
        updateNotification(nextSong, true);

        const durMs = (nextSong.duration || 0) * 1000;
        durationRef.current = durMs;
        if (durMs > 1000) scheduleEndTimer(durMs, 0);

        preloadNext();
      } catch (e) {
        console.log('advance play error:', e.message);
        await playSong(nextSong, pl);
      }
    } else {
      await playSong(nextSong, pl);
    }
  };

  useEffect(() => {
    setupNotifications();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      if (action === 'prev')        playPrevious();
      else if (action === 'next')   playNext();
      else if (action === 'toggle') { if (isPlayingRef.current) pauseSong(); else resumeSong(); }
    });

    loadFavorites(); loadPlaylists(); fetchSongs(); fetchFolderPlaylists();

    const syncInterval = setInterval(() => {
      fetchSongs(); loadPlaylists(); fetchFolderPlaylists();
    }, 5000);

    const heartbeatInterval = setInterval(async () => {
      try {
        let elapsedMs = 0;
        if (isPlayingRef.current && playStartTimeRef.current) {
          elapsedMs = Date.now() - playStartTimeRef.current;
          playStartTimeRef.current = Date.now();
        }
        const res = await fetch(`${SERVER_URL}/api/heartbeat`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ songId: currentSongRef.current?.id || null, isPlaying: isPlayingRef.current, elapsedMs }),
        });
        const data = await res.json();
        if (data.activeListeners !== undefined) setActiveListeners(data.activeListeners);
      } catch {}
    }, 30000);

    // Al minimizar o volver a abrir la app, resincroniza la notificación
    // con el estado real — antes esto no pasaba nunca de forma explícita,
    // así que si algo se había desincronizado (p.ej. tras una interrupción
    // de audio) la notificación se quedaba con datos obsoletos.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' || nextState === 'background') {
        if (currentSongRef.current) {
          updateNotification(currentSongRef.current, isPlayingRef.current);
        } else {
          dismissNotification();
        }
      }
    });

    return () => {
      sub.remove();
      appStateSub.remove();
      clearInterval(syncInterval);
      clearInterval(heartbeatInterval);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      flushPlayTime(currentSongRef.current?.id);
      sound.current?.unloadAsync().catch(() => {});
      nextSound.current?.unloadAsync().catch(() => {});
      dismissNotification();
    };
  }, []);

  const fetchSongs = async () => {
    try { const r = await fetch(`${SERVER_URL}/api/songs`, { headers: authHeaders() }); setSongs(await r.json()); } catch {}
  };
  const loadFavorites = async () => {
    try { const r = await fetch(`${SERVER_URL}/api/favorites`, { headers: authHeaders() }); setFavorites(await r.json()); } catch {}
  };
  const loadPlaylists = async () => {
    try { const r = await fetch(`${SERVER_URL}/api/playlists`, { headers: authHeaders() }); setPlaylists(await r.json()); } catch {}
  };
  const fetchListeners = async () => {
    try { const r = await fetch(`${SERVER_URL}/api/listeners`, { headers: authHeaders() }); const d = await r.json(); setActiveListeners(d.count || 0); } catch {}
  };
  const fetchFolderPlaylists = async () => {
    try { const r = await fetch(`${SERVER_URL}/api/folderplaylists`, { headers: authHeaders() }); const d = await r.json(); setFolderPlaylists(Array.isArray(d) ? d : []); } catch {}
  };

  const playSong = async (song, playlist = []) => {
    // ── Token de carga ───────────────────────────────────────────
    // Incrementamos el token al inicio. Si una segunda llamada llega
    // mientras estamos haciendo createAsync, nuestro token ya no coincide
    // con loadTokenRef y descartamos el sonido sin asignarlo.
    // Esto evita que dos taps rápidos reproduzcan dos canciones a la vez
    // sin necesidad de un flag de bloqueo que cause cuelgues.
    const myToken = ++loadTokenRef.current;

    try {
      flushPlayTime(currentSongRef.current?.id);
      if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
      advancedRef.current = false;

      setIsPlaying(false); setPosition(0); setDuration(0);
      positionRef.current = 0; durationRef.current = 0;

      if (!playSong._audioModeSet) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true, staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false, playThroughEarpieceAndroid: false,
        });
        playSong._audioModeSet = true;
      }

      const oldSound = sound.current;
      sound.current = null;
      if (oldSound) oldSound.stopAsync().catch(() => {}).finally(() => oldSound.unloadAsync().catch(() => {}));

      const _loadStart = Date.now();

      const onStatus = (status) => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        positionRef.current = status.positionMillis;
        if (status.durationMillis > 0) { setDuration(status.durationMillis); durationRef.current = status.durationMillis; }
        if (typeof status.isPlaying === 'boolean') syncPlayingState(status.isPlaying);
        if (status.didJustFinish) doAdvance();
      };

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: (await safeLocalPath(song.id)) || `${SERVER_URL}${song.url}` },
        { shouldPlay: true, progressUpdateIntervalMillis: 1000 },
        onStatus, true
      );

      // ── Comprobar si seguimos siendo la llamada más reciente ────
      // Si el usuario pulsó otra canción mientras cargábamos, descartamos
      // este sonido silenciosamente y dejamos que la otra carga proceda.
      if (loadTokenRef.current !== myToken) {
        newSound.stopAsync().catch(() => {});
        newSound.unloadAsync().catch(() => {});
        return;
      }

      sound.current = newSound;

      fetch(`${SERVER_URL}/api/latency`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ latencyMs: Date.now() - _loadStart }),
      }).catch(() => {});

      const durMs = (song.duration || 0) * 1000;
      if (durMs > 1000) {
        scheduleEndTimer(durMs, 0);
      } else {
        try {
          const st = await newSound.getStatusAsync();
          if (st.durationMillis > 0) scheduleEndTimer(st.durationMillis, 0);
        } catch {}
      }

      playStartTimeRef.current = Date.now();
      isPlayingRef.current = true;
      setCurrentSong(song);
      currentSongRef.current = song;
      setIsPlaying(true);
      updateNotification(song, true);

      if (playlist.length > 0) {
        setCurrentPlaylist(playlist);
        const idx = playlist.findIndex(s => s.id === song.id);
        const si = idx >= 0 ? idx : 0;
        setCurrentIndex(si); currentIndexRef.current = si; currentPlaylistRef.current = playlist;
      } else {
        currentPlaylistRef.current = [song]; currentIndexRef.current = 0;
      }

      preloadNext();

    } catch (e) {
      console.error('playSong error:', e);
    }
  };

  const pauseSong = async () => {
    if (sound.current) try { await sound.current.pauseAsync(); } catch {}
    syncPlayingState(false);
  };

  const resumeSong = async () => {
    if (sound.current) try { await sound.current.playAsync(); } catch {}
    syncPlayingState(true);
  };

  const playNext = async () => {
    const pl = currentPlaylistRef.current;
    if (pl.length > 0) { const n = (currentIndexRef.current + 1) % pl.length; currentIndexRef.current = n; setCurrentIndex(n); await playSong(pl[n], pl); }
  };

  const playPrevious = async () => {
    const pl = currentPlaylistRef.current;
    if (pl.length > 0) { const p = currentIndexRef.current === 0 ? pl.length - 1 : currentIndexRef.current - 1; currentIndexRef.current = p; setCurrentIndex(p); await playSong(pl[p], pl); }
  };

  const seekTo = async (value) => {
    setPosition(value);
    positionRef.current = value;
    if (sound.current) {
      try { await sound.current.setPositionAsync(value); } catch {}
      advancedRef.current = false;
      if (isPlayingRef.current && durationRef.current > 0) {
        scheduleEndTimer(durationRef.current, value);
      } else if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
    }
  };

  const toggleLoop = () => setIsLooping(prev => !prev);

  const toggleFavorite = async (songId) => {
    const wasFav = favorites.includes(songId);
    setFavorites(prev => wasFav ? prev.filter(id => id !== songId) : [...prev, songId]);
    try {
      await fetch(`${SERVER_URL}/api/favorites/${songId}`, { method: wasFav ? 'DELETE' : 'POST', headers: authHeaders() });
      const r = await fetch(`${SERVER_URL}/api/favorites`, { headers: authHeaders() });
      if (r.ok) setFavorites(await r.json());
    } catch { setFavorites(prev => wasFav ? [...prev, songId] : prev.filter(id => id !== songId)); }
  };

  const createPlaylist = async (name, songIds = [], coverColor = '#1DB954') => {
    try {
      const r = await fetch(`${SERVER_URL}/api/playlists`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, songs: songIds, coverColor }) });
      const pl = await r.json(); setPlaylists(prev => [...prev, pl]); return pl;
    } catch {}
  };

  const updatePlaylist = async (playlistId, updates) => {
    try {
      const r = await fetch(`${SERVER_URL}/api/playlists/${playlistId}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(updates) });
      const u = await r.json(); setPlaylists(prev => prev.map(p => p.id === playlistId ? u : p));
    } catch {}
  };

  const deletePlaylist = async (playlistId) => {
    try { await fetch(`${SERVER_URL}/api/playlists/${playlistId}`, { method: 'DELETE', headers: authHeaders() }); setPlaylists(prev => prev.filter(p => p.id !== playlistId)); } catch {}
  };

  const uploadSong = (uri, filename) => new Promise((resolve, reject) => {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg' };
    const formData = new FormData();
    formData.append('audio', { uri: decodeURIComponent(uri), type: mimeTypes[ext] || 'audio/mpeg', name: filename });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SERVER_URL}/api/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { try { const s = JSON.parse(xhr.responseText); setSongs(prev => [...prev, s]); resolve(s); } catch { reject(new Error('Respuesta inválida')); } }
      else reject(new Error('Error: ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('Error de red'));
    xhr.ontimeout = () => reject(new Error('Timeout'));
    xhr.timeout = 60000; xhr.send(formData);
  });

  const deleteSong = async (songId) => {
    try {
      await fetch(`${SERVER_URL}/api/songs/${songId}`, { method: 'DELETE', headers: authHeaders() });
      setSongs(prev => prev.filter(s => s.id !== songId));
      setFavorites(prev => prev.filter(id => id !== songId));
      if (currentSong?.id === songId) {
        setCurrentSong(null);
        currentSongRef.current = null;
        if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
        if (sound.current) { try { await sound.current.stopAsync(); await sound.current.unloadAsync(); } catch {} sound.current = null; }
        isPlayingRef.current = false;
        setIsPlaying(false);
        await dismissNotification();
      }
    } catch {}
  };

  const updateSong = async (songId, updates) => {
    try {
      const r = await fetch(`${SERVER_URL}/api/songs/${songId}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(updates) });
      const u = await r.json(); setSongs(prev => prev.map(s => s.id === songId ? u : s));
      if (currentSong?.id === songId) setCurrentSong(u); return u;
    } catch {}
  };

  const uploadCover = (songId, uri) => new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('cover', { uri, type: 'image/jpeg', name: `${songId}.jpg` });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SERVER_URL}/api/songs/${songId}/cover`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { try { const u = JSON.parse(xhr.responseText); setSongs(prev => prev.map(s => s.id === songId ? u : s)); setCurrentSong(prev => prev?.id === songId ? u : prev); resolve(u); } catch { reject(new Error('Respuesta inválida')); } }
      else reject(new Error('Error: ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('Error de red'));
    xhr.ontimeout = () => reject(new Error('Timeout'));
    xhr.timeout = 30000; xhr.send(formData);
  });

  const syncSongs = async () => {
    try { const r = await fetch(`${SERVER_URL}/api/sync`, { method: 'POST', headers: authHeaders() }); const result = await r.json(); await fetchSongs(); return result; } catch {}
  };

  const getAllSongs = () => {
    const fs = folderPlaylists.flatMap(pl => pl.songs || []);
    const ids = new Set(songs.map(s => s.id));
    return [...songs, ...fs.filter(s => !ids.has(s.id))];
  };

  const getFilteredSongs = () => {
    if (!searchQuery.trim()) return songs;
    const q = searchQuery.toLowerCase();
    return songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album?.toLowerCase().includes(q));
  };

  return (
    <MusicContext.Provider value={{
      songs, currentSong, isPlaying, position, duration, favorites, playlists,
      isLooping, searchQuery, setSearchQuery, setPosition,
      playSong, pauseSong, resumeSong, playNext, playPrevious, seekTo, toggleLoop,
      toggleFavorite, createPlaylist, updatePlaylist, deletePlaylist,
      uploadSong, deleteSong, updateSong, uploadCover, fetchSongs, syncSongs,
      getFilteredSongs, getAllSongs, SERVER_URL, onLogout, activeListeners, fetchListeners,
      folderPlaylists, fetchFolderPlaylists,
    }}>
      {children}
    </MusicContext.Provider>
  );
};