import React, { createContext, useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  State as TrackPlayerState,
} from 'react-native-track-player';
import { useSettings } from './SettingsContext';
import { resolveMediaUrl } from '../utils/mediaUrl';

export const MusicContext = createContext();
let playbackProgress = { position: 0, duration: 0 };
const playbackProgressListeners = new Set();

function subscribeToPlaybackProgress(listener) {
  playbackProgressListeners.add(listener);
  return () => playbackProgressListeners.delete(listener);
}

function getPlaybackProgress() {
  return playbackProgress;
}

function updatePlaybackProgress(update) {
  const next = { ...playbackProgress, ...update };
  if (next.position === playbackProgress.position && next.duration === playbackProgress.duration) return;
  playbackProgress = next;
  playbackProgressListeners.forEach(listener => listener());
}

export function usePlaybackProgress() {
  return useSyncExternalStore(subscribeToPlaybackProgress, getPlaybackProgress, getPlaybackProgress);
}

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://yfitops.duckdns.org';

// Caché en disco de la última respuesta buena del servidor. Sin esto, si
// abres la app sin conexión, la biblioteca/colecciones aparecen vacías
// aunque tengas canciones descargadas para escuchar sin conexión: la
// pantalla de canciones/colecciones/favoritos lee de este estado, no
// directamente de lo descargado.
const CACHE_SONGS = 'yfitops_cache_songs';
const CACHE_PLAYLISTS = 'yfitops_cache_playlists';
const CACHE_FOLDER_PLAYLISTS = 'yfitops_cache_folder_playlists';
const CACHE_FAVORITES = 'yfitops_cache_favorites';

let trackPlayerReadyPromise;

async function ensureTrackPlayer() {
  if (!trackPlayerReadyPromise) {
    trackPlayerReadyPromise = (async () => {
      await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
          alwaysPauseOnInterruption: true,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        compactCapabilities: [
          Capability.SkipToPrevious,
          Capability.Play,
          Capability.SkipToNext,
        ],
        progressUpdateEventInterval: 0.5,
      });
    })().catch((error) => {
      trackPlayerReadyPromise = null;
      throw error;
    });
  }
  await trackPlayerReadyPromise;
}

async function readCache(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
async function writeCache(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

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
  if (Platform.OS === 'android') {
    try {
      await Notifications.requestPermissionsAsync();
      await Notifications.dismissNotificationAsync('music-player');
    } catch (e) {
      console.log('notifications:', e.message);
    }
    return;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    notificationReady = true;
    if (pendingNotification) {
      const { song, playing } = pendingNotification;
      pendingNotification = null;
      updateNotification(song, playing);
    }
  } catch (e) { console.log('notifications:', e.message); }
}

async function updateNotification(song, playing) {
  if (Platform.OS === 'android') return;
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
  if (Platform.OS === 'android') return;
  try { await Notifications.dismissAllNotificationsAsync(); } catch {}
}

export const MusicProvider = ({ children, token, onLogout }) => {
  const { getLocalSongPath } = useSettings();
  const safeLocalPath = async (songId) => {
    try { return getLocalSongPath ? await getLocalSongPath(songId) : null; } catch { return null; }
  };
  const setPosition = value => updatePlaybackProgress({ position: value });
  const setDuration = value => updatePlaybackProgress({ duration: value });
  const [songs, setSongs]                     = useState([]);
  const [currentSong, setCurrentSong]         = useState(null);
  const [isPlaying, setIsPlaying]             = useState(false);
  const [favorites, setFavorites]             = useState([]);
  const [playlists, setPlaylists]             = useState([]);
  const [isLooping, setIsLooping]             = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [folderPlaylists, setFolderPlaylists] = useState([]);
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [currentPlaylist, setCurrentPlaylist] = useState([]);
  const [activeListeners, setActiveListeners] = useState(0);
  const [queue, setQueue]                     = useState([]); // Cola de reproducción, independiente de currentPlaylist

  const songsRef = useRef(songs);
  const folderPlaylistsRef = useRef(folderPlaylists);

  // ── Logros y estadísticas (datos reales del servidor) ──────────
  const [achievements, setAchievements]               = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [stats, setStats]                             = useState(null);
  const [statsLoading, setStatsLoading]                = useState(false);
  const [achievementToasts, setAchievementToasts]     = useState([]);
  const [rateLimitWarning, setRateLimitWarning]       = useState(null);

  const sound              = useRef(null);
  const nextSound          = useRef(null);
  const nextSongMeta       = useRef(null);
  const isPreloading       = useRef(false);

  const currentIndexRef    = useRef(0);
  const currentPlaylistRef = useRef([]);
  const isLoopingRef       = useRef(false);
  const currentSongRef     = useRef(null);
  const currentNativeTrackIdRef = useRef(null);
  const isPlayingRef       = useRef(false);
  const positionRef        = useRef(0);
  const playStartTimeRef   = useRef(null);
  const durationRef        = useRef(0);
  const endTimerRef        = useRef(null);
  const advancedRef        = useRef(false);
  const queueRef           = useRef([]);
  const nativeQueueReadyRef = useRef(null);
  const previousPressAtRef = useRef(0);
  const playbackStartingRef = useRef(false);

  // Qué playlist/colección está sonando ahora mismo (si la hay), para que
  // el servidor pueda contar reproducciones por playlist (estadística de
  // "colección más escuchada"). Se lee en cada heartbeat.
  const currentPlaylistContextRef = useRef(null); // { id, type: 'manual' | 'folder', name }

  // ── Guard anti doble-play ─────────────────────────────────────
  // Cada llamada a playSong recibe un token único.
  // Si mientras está cargando llega otra llamada, el token sube
  // y la carga antigua descarta su resultado al terminar.
  const loadTokenRef       = useRef(0);

  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { folderPlaylistsRef.current = folderPlaylists; }, [folderPlaylists]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenRef.current}`,
  });

  // Procesa lo que el heartbeat pueda traer además de "cuántos oyentes hay
  // ahora": logros nuevos desbloqueados (para la cola de notificaciones) y
  // el aviso amistoso de "vas muy rápido" del rate limiter (ver
  // servidor/lib/rateLimit.js). Se llama desde cualquier punto que mande
  // un heartbeat, así que centralizarlo aquí evita tener esta lógica
  // repetida en tres sitios distintos.
  const handleHeartbeatExtras = (data) => {
    if (!data) return;
    if (typeof data.activeListeners === 'number') setActiveListeners(data.activeListeners);
    if (Array.isArray(data.newAchievements) && data.newAchievements.length > 0) {
      setAchievements(prev => prev.map(a => {
        const unlocked = data.newAchievements.find(n => n.id === a.id);
        return unlocked ? { ...a, unlocked: true, unlockedAt: new Date().toISOString(), progress: a.threshold } : a;
      }));
      setAchievementToasts(prev => [
        ...prev,
        ...data.newAchievements.map(a => ({ ...a, _toastId: `${a.id}-${Date.now()}-${Math.random()}` })),
      ]);
    }
    if (data.warning) {
      setRateLimitWarning({ message: data.warning, _toastId: `warn-${Date.now()}` });
    }
  };

  const flushPlayTime = (songId) => {
    if (!playStartTimeRef.current || !isPlayingRef.current) return;
    const elapsedMs = Date.now() - playStartTimeRef.current;
    playStartTimeRef.current = null;
    if (elapsedMs < 1000) return;
    fetch(`${SERVER_URL}/api/heartbeat`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        songId: songId || currentSongRef.current?.id, isPlaying: false, elapsedMs,
        playlistId: currentPlaylistContextRef.current?.id || null,
        playlistType: currentPlaylistContextRef.current?.type || null,
      }),
    }).then(r => r.json()).then(handleHeartbeatExtras).catch(() => {});
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

    if (Platform.OS === 'android') {
      if (playingNow) playStartTimeRef.current = Date.now();
      updateNotification(currentSongRef.current, playingNow);
      return;
    }

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
        { uri: (await safeLocalPath(nextSong.id)) || resolveMediaUrl(SERVER_URL, nextSong.url) },
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

    // La cola de reproducción tiene prioridad sobre la playlist actual,
    // igual que en la app de PC: si hay algo en cola, se reproduce eso.
    if (queueRef.current.length > 0) {
      const [next, ...rest] = queueRef.current;
      setQueue(rest);
      queueRef.current = rest;
      advancedRef.current = false;
      await playSong(next, pl.length ? pl : [next]);
      return;
    }

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

        // Mismo heartbeat inmediato que en playSong (ver el comentario allí):
        // este camino rápido con audio precargado no pasa por esa función,
        // así que hay que mandarlo aquí también para no perder el aviso al
        // instante de un logro nuevo al avanzar de canción en automático.
        // El contexto de playlist no cambia (seguimos en la misma), así
        // que se reutiliza el que ya había.
        fetch(`${SERVER_URL}/api/heartbeat`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            songId: nextSong.id, isPlaying: true, elapsedMs: 0,
            playlistId: currentPlaylistContextRef.current?.id || null,
            playlistType: currentPlaylistContextRef.current?.type || null,
          }),
        }).then(r => r.json()).then(handleHeartbeatExtras).catch(() => {});

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

    const sub = Platform.OS === 'android'
      ? null
      : Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      if (action === 'prev')        playPrevious();
      else if (action === 'next')   playNext();
      else if (action === 'toggle') { if (isPlayingRef.current) pauseSong(); else resumeSong(); }
    });

    let trackPlayerSubscriptions = [];
    if (Platform.OS === 'android') {
      trackPlayerSubscriptions = [
        TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async ({ track, index }) => {
          if (!track) return;
          const song = [...songsRef.current, ...folderPlaylistsRef.current.flatMap(playlist => playlist.songs || [])]
            .find(item => String(item.id) === String(track.appSong.id)) || track.appSong;
          if (!song) return;

          const changedTrack = currentNativeTrackIdRef.current !== track.id;
          if (changedTrack) {
            flushPlayTime(currentSongRef.current?.id);
            currentNativeTrackIdRef.current = track.id;
            playStartTimeRef.current = Date.now();
            positionRef.current = 0;
            setPosition(0);
          }

          currentSongRef.current = song;
          setCurrentSong(song);
          if (
            song.title !== track.appSong.title
            || song.artist !== track.appSong.artist
            || song.album !== track.appSong.album
            || song.coverUrl !== track.appSong.coverUrl
          ) {
            updateNativeMetadata(song).catch(error => {
              console.error('Could not refresh active track metadata:', error);
            });
          }
          if (Number.isFinite(track.duration)) {
            durationRef.current = track.duration * 1000;
            setDuration(durationRef.current);
          }
          const playlistIndex = currentPlaylistRef.current.findIndex(item =>
            String(item.id) === String(song.id)
          );
          if (playlistIndex >= 0) {
            currentIndexRef.current = playlistIndex;
            setCurrentIndex(playlistIndex);
          }

          try {
            const [nativeQueue, activeIndex] = await Promise.all([
              TrackPlayer.getQueue(),
              TrackPlayer.getActiveTrackIndex(),
            ]);
            const upcomingSongs = nativeQueue
              .slice((activeIndex ?? index ?? 0) + 1)
              .filter(item => item.queueEntryId)
              .map(item => item.appSong)
              .filter(Boolean);
            queueRef.current = upcomingSongs;
            setQueue(upcomingSongs);
          } catch (error) {
            console.error('Could not synchronize the playback queue:', error);
          }

          if (changedTrack) {
            fetch(`${SERVER_URL}/api/heartbeat`, {
              method: 'POST', headers: authHeaders(),
              body: JSON.stringify({
                songId: song.id, isPlaying: true, elapsedMs: 0,
                playlistId: currentPlaylistContextRef.current?.id || null,
                playlistType: currentPlaylistContextRef.current?.type || null,
              }),
            }).then(r => r.json()).then(handleHeartbeatExtras).catch(() => {});
          }
        }),
        TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
          if (state === TrackPlayerState.Playing) {
            playbackStartingRef.current = false;
            syncPlayingState(true);
          } else if (
            state === TrackPlayerState.Paused
            && !playbackStartingRef.current
          ) {
            syncPlayingState(false);
          } else if (
            state === TrackPlayerState.Error
            || state === TrackPlayerState.Stopped
            || state === TrackPlayerState.Ended
          ) {
            playbackStartingRef.current = false;
            syncPlayingState(false);
          }
        }),
        TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position: currentPosition, duration: trackDuration }) => {
          positionRef.current = currentPosition * 1000;
          setPosition(positionRef.current);
          if (trackDuration > 0) {
            durationRef.current = trackDuration * 1000;
            setDuration(durationRef.current);
          }
        }),
        TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
          flushPlayTime(currentSongRef.current?.id);
          playStartTimeRef.current = null;
          isPlayingRef.current = false;
          setIsPlaying(false);
          setPosition(0);
        }),
      ];

      ensureTrackPlayer().catch(error => {
        console.error('Could not initialize the Android music player:', error);
      });
    }

    // Primero pintamos lo último que sabíamos (funciona sin conexión),
    // y luego intentamos refrescar desde el servidor si hay red.
    (async () => {
      const [cachedSongs, cachedFavorites, cachedPlaylists, cachedFolders] = await Promise.all([
        readCache(CACHE_SONGS, []),
        readCache(CACHE_FAVORITES, []),
        readCache(CACHE_PLAYLISTS, []),
        readCache(CACHE_FOLDER_PLAYLISTS, []),
      ]);
      setSongs(cachedSongs);
      setFavorites(cachedFavorites);
      setPlaylists(cachedPlaylists);
      setFolderPlaylists(cachedFolders);
    })();

    loadFavorites(); loadPlaylists(); fetchSongs(); fetchFolderPlaylists();
    fetchAchievements(); fetchStats();

    const syncInterval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      fetchSongs(); loadPlaylists(); fetchFolderPlaylists();
    }, 30000);

    const heartbeatInterval = setInterval(async () => {
      try {
        let elapsedMs = 0;
        if (isPlayingRef.current && playStartTimeRef.current) {
          elapsedMs = Date.now() - playStartTimeRef.current;
          playStartTimeRef.current = Date.now();
        }
        const res = await fetch(`${SERVER_URL}/api/heartbeat`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            songId: currentSongRef.current?.id || null, isPlaying: isPlayingRef.current, elapsedMs,
            playlistId: currentPlaylistContextRef.current?.id || null,
            playlistType: currentPlaylistContextRef.current?.type || null,
          }),
        });
        const data = await res.json();
        handleHeartbeatExtras(data);
      } catch {}
    }, 30000);

    // Vigilante de fin de canción: además del evento nativo "didJustFinish"
    // y del temporizador de seguridad, comprobamos el estado real cada 10s.
    // Con la pantalla apagada, a veces el aviso de fin de canción no llega
    // a tiempo (o nada) — este intervalo sigue corriendo igualmente y coge
    // esos casos, en vez de dejar la canción "colgada" hasta que alguien
    // desbloquee el móvil.
    const watchdogInterval = Platform.OS === 'android' ? null : setInterval(async () => {
      if (!sound.current || advancedRef.current) return;
      try {
        const status = await sound.current.getStatusAsync();
        if (!status.isLoaded) return;
        const reachedEnd = status.didJustFinish
          || (status.durationMillis > 0 && status.positionMillis >= status.durationMillis - 400 && !status.isPlaying);
        if (reachedEnd) doAdvance();
      } catch {}
    }, 10000);

    let progressPollInFlight = false;
    const nativeProgressInterval = Platform.OS === 'android' ? setInterval(async () => {
      if (AppState.currentState !== 'active' || !currentSongRef.current || progressPollInFlight) return;
      progressPollInFlight = true;
      try {
        const progress = await TrackPlayer.getProgress();
        positionRef.current = progress.position * 1000;
        setPosition(positionRef.current);
        if (progress.duration > 0) {
          durationRef.current = progress.duration * 1000;
          setDuration(durationRef.current);
        }
      } catch (error) {
        console.error('Could not refresh Android playback progress:', error);
      } finally {
        progressPollInFlight = false;
      }
    }, 500) : null;

    // Al minimizar o volver a abrir la app, resincroniza la notificación
    // con el estado real — antes esto no pasaba nunca de forma explícita,
    // así que si algo se había desincronizado (p.ej. tras una interrupción
    // de audio) la notificación se quedaba con datos obsoletos.
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' || nextState === 'background') {
        if (currentSongRef.current) {
          updateNotification(currentSongRef.current, isPlayingRef.current);
        } else {
          dismissNotification();
        }
      }

      // Al volver a primer plano (pantalla desbloqueada, app reabierta):
      // con la pantalla apagada, Android puede llegar a congelar los
      // temporizadores JS y no entregar el último "didJustFinish" a tiempo,
      // así que la canción se queda "colgada" en el final aunque el audio
      // nativo ya haya terminado. Al volver, comprobamos el estado real del
      // sonido directamente y forzamos el avance si hace falta, en vez de
      // fiarnos de que el aviso nos llegara mientras estaba en segundo plano.
      if (Platform.OS !== 'android' && nextState === 'active' && sound.current) {
        try {
          const status = await sound.current.getStatusAsync();
          if (status.isLoaded) {
            const reachedEnd = status.didJustFinish
              || (status.durationMillis > 0 && status.positionMillis >= status.durationMillis - 400 && !status.isPlaying);
            if (reachedEnd && !advancedRef.current) {
              doAdvance();
            }
          }
        } catch {}
      }
    });

    return () => {
      sub?.remove();
      trackPlayerSubscriptions.forEach(subscription => subscription.remove());
      appStateSub.remove();
      clearInterval(syncInterval);
      clearInterval(heartbeatInterval);
      if (watchdogInterval) clearInterval(watchdogInterval);
      if (nativeProgressInterval) clearInterval(nativeProgressInterval);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      flushPlayTime(currentSongRef.current?.id);
      sound.current?.unloadAsync().catch(() => {});
      nextSound.current?.unloadAsync().catch(() => {});
      if (Platform.OS === 'android') {
        TrackPlayer.reset().catch(error => {
          console.error('Could not stop the Android music player:', error);
        });
      }
      dismissNotification();
    };
  }, []);

  const refreshActiveSongMetadata = (librarySongs) => {
    const previousSong = currentSongRef.current;
    if (!previousSong) return;
    const activeSong = librarySongs.find(song => String(song.id) === String(previousSong.id));
    if (!activeSong || (
      activeSong.title === previousSong.title
      && activeSong.artist === previousSong.artist
      && activeSong.album === previousSong.album
      && activeSong.coverUrl === previousSong.coverUrl
    )) return;
    currentSongRef.current = activeSong;
    setCurrentSong(activeSong);
    updateNativeMetadata(activeSong).catch(error => {
      console.error('Could not refresh active track metadata:', error);
    });
  };

  const fetchSongs = async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/songs`, { headers: authHeaders() });
      const d = await r.json();
      if (!Array.isArray(d)) return;
      songsRef.current = d;
      setSongs(d);
      writeCache(CACHE_SONGS, d);
      refreshActiveSongMetadata(d);
    } catch {}
  };
  const loadFavorites = async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/favorites`, { headers: authHeaders() });
      const d = await r.json();
      setFavorites(d);
      writeCache(CACHE_FAVORITES, d);
    } catch {}
  };
  const loadPlaylists = async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/playlists`, { headers: authHeaders() });
      const d = await r.json();
      setPlaylists(d);
      writeCache(CACHE_PLAYLISTS, d);
    } catch {}
  };
  const fetchListeners = async () => {
    try { const r = await fetch(`${SERVER_URL}/api/listeners`, { headers: authHeaders() }); const d = await r.json(); setActiveListeners(d.count || 0); } catch {}
  };
  const fetchFolderPlaylists = async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/folderplaylists`, { headers: authHeaders() });
      const d = await r.json();
      const arr = Array.isArray(d) ? d : [];
      folderPlaylistsRef.current = arr;
      setFolderPlaylists(arr);
      writeCache(CACHE_FOLDER_PLAYLISTS, arr);
      refreshActiveSongMetadata(arr.flatMap(playlist => playlist.songs || []));
    } catch {}
  };

  // ── Logros y estadísticas ─────────────────────────────────────
  // Todo viene del servidor: el catálogo (incluidos logros que un admin
  // haya añadido desde el panel web) y el progreso real de este usuario.
  // Nada hardcodeado en el cliente.
  const fetchAchievements = async () => {
    setAchievementsLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/achievements`, { headers: authHeaders() });
      const d = await r.json();
      setAchievements(Array.isArray(d) ? d : []);
    } catch {} finally {
      setAchievementsLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/stats/me`, { headers: authHeaders() });
      const d = await r.json();
      setStats(d);
    } catch {} finally {
      setStatsLoading(false);
    }
  };

  // Reclama un logro "clientReported" (cosas que solo sabe el cliente,
  // como una descarga offline). El servidor valida que sea reclamable;
  // no sirve para desbloquear logros normales a mano.
  const claimAchievement = async (achievementId) => {
    try {
      const r = await fetch(`${SERVER_URL}/api/achievements/${achievementId}/claim`, {
        method: 'POST', headers: authHeaders(),
      });
      const result = await r.json();
      if (result?.ok && !result.alreadyUnlocked) {
        setAchievements(prev => prev.map(a =>
          a.id === achievementId ? { ...a, unlocked: true, unlockedAt: new Date().toISOString(), progress: a.threshold } : a
        ));
        setAchievementToasts(prev => [...prev, { ...result.achievement, _toastId: `${achievementId}-${Date.now()}` }]);
      }
      return result;
    } catch {
      return null;
    }
  };

  const dismissAchievementToast = (toastId) => {
    setAchievementToasts(prev => prev.filter(t => t._toastId !== toastId));
  };

  const dismissRateLimitWarning = () => {
    setRateLimitWarning(null);
  };

  const makeNativeTrack = async (song, trackId, queueEntryId = null) => {
    const artwork = resolveMediaUrl(SERVER_URL, song.coverUrl) || undefined;
    return {
      id: trackId,
      url: (await safeLocalPath(song.id)) || resolveMediaUrl(SERVER_URL, song.url),
      title: song.title || 'YFitops',
      artist: song.artist || '',
      album: song.album || 'YFitops',
      duration: Number(song.duration) || undefined,
      artwork,
      appSong: song,
      queueEntryId,
    };
  };

  const updateNativeMetadata = async (song) => {
    if (Platform.OS !== 'android') return;
    const activeIndex = await TrackPlayer.getActiveTrackIndex();
    if (activeIndex === undefined) return;
    await TrackPlayer.updateMetadataForTrack(activeIndex, {
      title: song.title || 'YFitops',
      artist: song.artist || '',
      album: song.album || 'YFitops',
      artwork: resolveMediaUrl(SERVER_URL, song.coverUrl) || undefined,
    });
  };

  const syncNativeActiveTrack = async () => {
    const track = await TrackPlayer.getActiveTrack();
    if (!track?.appSong) return;
    const song = [...songsRef.current, ...folderPlaylistsRef.current.flatMap(playlist => playlist.songs || [])]
      .find(item => String(item.id) === String(track.appSong.id)) || track.appSong;
    const changedTrack = currentNativeTrackIdRef.current !== track.id;
    currentNativeTrackIdRef.current = track.id;
    currentSongRef.current = song;
    setCurrentSong(song);
    if (changedTrack) {
      positionRef.current = 0;
      setPosition(0);
    }
    if (Number.isFinite(track.duration) && track.duration > 0) {
      durationRef.current = track.duration * 1000;
      setDuration(durationRef.current);
    }
    const playlistIndex = currentPlaylistRef.current.findIndex(item =>
      String(item.id) === String(song.id)
    );
    if (playlistIndex >= 0) {
      currentIndexRef.current = playlistIndex;
      setCurrentIndex(playlistIndex);
    }
  };

  function* getNativeQueueItems(song, playlist, startIndex, queuedSongs) {
    const now = Date.now();
    yield { song, queueEntryId: null, id: `current-${now}` };

    for (let index = 0; index < queuedSongs.length; index++) {
      const item = queuedSongs[index];
      yield {
        song: item,
        queueEntryId: item._queueEntryId,
        id: `queued-${item._queueEntryId || `${now}-${index}`}`,
      };
    }

    if (playlist.length < 2) return;
    const selectedIsInPlaylist = String(playlist[startIndex]?.id) === String(song.id);
    if (selectedIsInPlaylist) {
      for (let index = startIndex + 1; index < playlist.length; index++) {
        const item = playlist[index];
        yield { song: item, queueEntryId: null, id: `playlist-${index}-${item.id}-${now}` };
      }
      for (let index = 0; index < startIndex; index++) {
        const item = playlist[index];
        yield { song: item, queueEntryId: null, id: `playlist-${index}-${item.id}-${now}` };
      }
      return;
    }

    const start = Math.max(-1, Math.min(startIndex, playlist.length - 1));
    for (let index = start + 1; index < playlist.length; index++) {
      const item = playlist[index];
      if (String(item.id) !== String(song.id)) {
        yield { song: item, queueEntryId: null, id: `playlist-${index}-${item.id}-${now}` };
      }
    }
    for (let index = 0; index <= start; index++) {
      const item = playlist[index];
      if (String(item.id) !== String(song.id)) {
        yield { song: item, queueEntryId: null, id: `playlist-${index}-${item.id}-${now}` };
      }
    }
  }

  const playSong = async (song, playlist = [], playlistContext = null) => {
    if (Platform.OS === 'android') {
      previousPressAtRef.current = 0;
      const myToken = ++loadTokenRef.current;
      try {
        await ensureTrackPlayer();
        flushPlayTime(currentSongRef.current?.id);
        advancedRef.current = false;
        playbackStartingRef.current = true;
        setCurrentSong(song);
        currentSongRef.current = song;
        isPlayingRef.current = true;
        setIsPlaying(true);
        setPosition(0);
        positionRef.current = 0;
        const songDuration = Math.max(0, Number(song.duration) || 0) * 1000;
        setDuration(songDuration);
        durationRef.current = songDuration;

        const playlistIndex = playlist.findIndex(item =>
          String(item.id) === String(song.id)
        );
        const startIndex = playlistIndex >= 0 ? playlistIndex : currentIndexRef.current;
        const queueItems = getNativeQueueItems(song, playlist, startIndex, queueRef.current);
        const currentQueueItem = queueItems.next().value;
        if (loadTokenRef.current !== myToken) return;

        const currentTrack = await makeNativeTrack(
          song,
          currentQueueItem.id,
          currentQueueItem.queueEntryId
        );
        if (loadTokenRef.current !== myToken) return;
        await TrackPlayer.setQueue([currentTrack]);
        await TrackPlayer.setRepeatMode(
          isLoopingRef.current
            ? RepeatMode.Track
            : (playlist.length > 1 ? RepeatMode.Queue : RepeatMode.Off)
        );
        currentNativeTrackIdRef.current = currentTrack.id;
        currentPlaylistContextRef.current = playlistContext;

        if (playlist.length > 0) {
          setCurrentPlaylist(playlist);
          const index = playlistIndex >= 0 ? playlistIndex : startIndex;
          currentIndexRef.current = index;
          setCurrentIndex(index);
          currentPlaylistRef.current = playlist;
        } else {
          currentPlaylistRef.current = [song];
          currentIndexRef.current = 0;
          setCurrentPlaylist([]);
        }

        playStartTimeRef.current = Date.now();
        isPlayingRef.current = true;
        setIsPlaying(true);
        const playback = TrackPlayer.play();
        updateNotification(song, true);
        await playback;

        fetch(`${SERVER_URL}/api/heartbeat`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            songId: song.id, isPlaying: true, elapsedMs: 0,
            playlistId: playlistContext?.id || null,
            playlistType: playlistContext?.type || null,
          }),
        }).then(r => r.json()).then(handleHeartbeatExtras).catch(() => {});

        if (queueRef.current.length || playlist.length > 1) {
          const batchSize = 10;
          const addNextQueueBatch = async () => {
            const batch = [];
            while (batch.length < batchSize) {
              const nextItem = queueItems.next();
              if (nextItem.done) break;
              batch.push(nextItem.value);
            }
            if (!batch.length) return false;
            const tracks = await Promise.all(batch.map(item =>
              makeNativeTrack(item.song, item.id, item.queueEntryId)
            ));
            if (loadTokenRef.current !== myToken) return false;
            await TrackPlayer.add(tracks);
            return true;
          };

          const initialQueueLoad = addNextQueueBatch();
          nativeQueueReadyRef.current = initialQueueLoad;
          initialQueueLoad.then(() => {
            if (nativeQueueReadyRef.current === initialQueueLoad) {
              nativeQueueReadyRef.current = null;
            }
          }, () => {
            if (nativeQueueReadyRef.current === initialQueueLoad) {
              nativeQueueReadyRef.current = null;
            }
          });

          const queueLoad = (async () => {
            let hasMoreTracks = await initialQueueLoad;
            while (hasMoreTracks && loadTokenRef.current === myToken) {
              await new Promise(resolve => setTimeout(resolve, 0));
              hasMoreTracks = await addNextQueueBatch();
            }
          })();
          queueLoad.catch(error => {
            console.error('Could not prepare the upcoming playback queue:', error);
          });
        }
      } catch (e) {
        playbackStartingRef.current = false;
        syncPlayingState(false);
        console.error('playSong error:', e);
      }
      return;
    }

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
        { uri: (await safeLocalPath(song.id)) || resolveMediaUrl(SERVER_URL, song.url) },
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
      currentPlaylistContextRef.current = playlistContext;

      // Heartbeat inmediato al arrancar la canción: sin esto, un logro
      // (o el contador de "canción más escuchada") tardaría hasta 30s en
      // reflejarse, porque si no el primer aviso de "esto está sonando"
      // no llegaría hasta el siguiente heartbeat periódico. Es una única
      // llamada (no hay ningún listener duplicado que la repita, a
      // diferencia de la app de PC), así que no hay riesgo de contar la
      // misma reproducción dos veces.
      fetch(`${SERVER_URL}/api/heartbeat`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          songId: song.id, isPlaying: true, elapsedMs: 0,
          playlistId: playlistContext?.id || null,
          playlistType: playlistContext?.type || null,
        }),
      }).then(r => r.json()).then(handleHeartbeatExtras).catch(() => {});

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
    if (Platform.OS === 'android') {
      previousPressAtRef.current = 0;
      playbackStartingRef.current = false;
      syncPlayingState(false);
      try { await TrackPlayer.pause(); } catch (error) {
        console.error('Could not pause the Android music player:', error);
        try {
          const state = await TrackPlayer.getPlaybackState();
          syncPlayingState(state.state === TrackPlayerState.Playing);
        } catch (stateError) {
          console.error('Could not refresh Android playback state after pausing:', stateError);
        }
      }
      return;
    }
    if (sound.current) try { await sound.current.pauseAsync(); } catch {}
    syncPlayingState(false);
  };

  const resumeSong = async () => {
    if (Platform.OS === 'android') {
      previousPressAtRef.current = 0;
      playbackStartingRef.current = true;
      syncPlayingState(true);
      try { await TrackPlayer.play(); } catch (error) {
        playbackStartingRef.current = false;
        console.error('Could not resume the Android music player:', error);
        try {
          const state = await TrackPlayer.getPlaybackState();
          syncPlayingState(state.state === TrackPlayerState.Playing);
        } catch (stateError) {
          console.error('Could not refresh Android playback state after resuming:', stateError);
        }
      }
      return;
    }
    if (sound.current) try { await sound.current.playAsync(); } catch {}
    syncPlayingState(true);
  };

  const playNext = async () => {
    if (Platform.OS === 'android') {
      previousPressAtRef.current = 0;
      playbackStartingRef.current = true;
      try {
        let skipped = false;
        const queueReady = nativeQueueReadyRef.current;
        try {
          await TrackPlayer.skipToNext();
          skipped = true;
        } catch {
          if (queueReady) {
            await queueReady;
            await TrackPlayer.skipToNext();
            skipped = true;
          }
        }
        if (skipped) {
          await TrackPlayer.play();
          await syncNativeActiveTrack();
          syncPlayingState(true);
          return;
        }

        const [queuedSong] = queueRef.current;
        const playlist = currentPlaylistRef.current;
        const playlistIndex = currentIndexRef.current;
        const nextSong = queuedSong
          || (playlist.length > 1 ? playlist[(playlistIndex + 1) % playlist.length] : null);
        if (nextSong) {
          if (queuedSong) {
            const remainingQueue = queueRef.current.slice(1);
            queueRef.current = remainingQueue;
            setQueue(remainingQueue);
          }
          await playSong(nextSong, playlist.length ? playlist : [nextSong], queuedSong ? null : currentPlaylistContextRef.current);
        }
        playbackStartingRef.current = false;
      } catch (error) {
        playbackStartingRef.current = false;
        console.error('Could not skip to the next track:', error);
      }
      return;
    }
    // La cola tiene prioridad, igual que al terminar una canción sola.
    // Las canciones de la cola no pertenecen a ninguna playlist en
    // concreto, así que se limpia el contexto.
    if (queueRef.current.length > 0) {
      const [next, ...rest] = queueRef.current;
      setQueue(rest);
      queueRef.current = rest;
      const pl = currentPlaylistRef.current;
      await playSong(next, pl.length ? pl : [next], null);
      return;
    }
    const pl = currentPlaylistRef.current;
    if (pl.length > 0) { const n = (currentIndexRef.current + 1) % pl.length; currentIndexRef.current = n; setCurrentIndex(n); await playSong(pl[n], pl, currentPlaylistContextRef.current); }
  };

  const playPrevious = async () => {
    if (Platform.OS === 'android') {
      const now = Date.now();
      const isDoublePress = now - previousPressAtRef.current <= 700;
      previousPressAtRef.current = isDoublePress ? 0 : now;
      if (isDoublePress) playbackStartingRef.current = true;
      try {
        if (isDoublePress) {
          const [tracks, activeIndex] = await Promise.all([
            TrackPlayer.getQueue(),
            TrackPlayer.getActiveTrackIndex(),
          ]);
          if (tracks.length > 1 && activeIndex !== undefined) {
            const previousIndex = activeIndex > 0 ? activeIndex - 1 : tracks.length - 1;
            await TrackPlayer.skip(previousIndex);
            await TrackPlayer.play();
            await syncNativeActiveTrack();
            syncPlayingState(true);
          } else {
            playbackStartingRef.current = false;
            await TrackPlayer.seekTo(0);
            setPosition(0);
            positionRef.current = 0;
          }
        } else {
          await TrackPlayer.seekTo(0);
          setPosition(0);
          positionRef.current = 0;
        }
      } catch (error) {
        playbackStartingRef.current = false;
        console.error('Could not skip to the previous track:', error);
      }
      return;
    }
    const pl = currentPlaylistRef.current;
    if (pl.length > 0) { const p = currentIndexRef.current === 0 ? pl.length - 1 : currentIndexRef.current - 1; currentIndexRef.current = p; setCurrentIndex(p); await playSong(pl[p], pl, currentPlaylistContextRef.current); }
  };

  // ── Cola de reproducción ──────────────────────────────────────
  const addToQueue = (song) => {
    const queuedSong = { ...song, _queueEntryId: `${Date.now()}-${Math.random()}` };
    const nextQueue = [...queueRef.current, queuedSong];
    queueRef.current = nextQueue;
    setQueue(nextQueue);

    if (Platform.OS === 'android' && currentSongRef.current) {
      (async () => {
        await ensureTrackPlayer();
        const tracks = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        let insertIndex = (activeIndex ?? -1) + 1;
        while (tracks[insertIndex]?.queueEntryId) insertIndex++;
        await TrackPlayer.add(
          await makeNativeTrack(queuedSong, `queued-${queuedSong._queueEntryId}`, queuedSong._queueEntryId),
          insertIndex
        );
      })().catch(error => console.error('Could not add the track to playback:', error));
    }
  };

  const addManyToQueue = (songsToAdd) => {
    const addedSongs = songsToAdd.map((song, index) => ({
      ...song,
      _queueEntryId: `${Date.now()}-${index}-${Math.random()}`,
    }));
    const nextQueue = [...queueRef.current, ...addedSongs];
    queueRef.current = nextQueue;
    setQueue(nextQueue);

    if (Platform.OS === 'android' && currentSongRef.current && addedSongs.length) {
      (async () => {
        await ensureTrackPlayer();
        const tracks = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        let insertIndex = (activeIndex ?? -1) + 1;
        while (tracks[insertIndex]?.queueEntryId) insertIndex++;
        const nativeTracks = await Promise.all(addedSongs.map(song =>
          makeNativeTrack(song, `queued-${song._queueEntryId}`, song._queueEntryId)
        ));
        await TrackPlayer.add(nativeTracks, insertIndex);
      })().catch(error => console.error('Could not add tracks to playback:', error));
    }
  };

  const removeFromQueue = (index) => {
    const removedSong = queueRef.current[index];
    const nextQueue = queueRef.current.filter((_, i) => i !== index);
    queueRef.current = nextQueue;
    setQueue(nextQueue);

    if (Platform.OS === 'android' && removedSong?._queueEntryId) {
      (async () => {
        const tracks = await TrackPlayer.getQueue();
        const trackIndex = tracks.findIndex(track =>
          track.queueEntryId === removedSong._queueEntryId
        );
        if (trackIndex >= 0) await TrackPlayer.remove(trackIndex);
      })().catch(error => console.error('Could not remove the queued track:', error));
    }
  };

  const clearQueue = () => {
    const queueToClear = queueRef.current;
    queueRef.current = [];
    setQueue([]);

    if (Platform.OS === 'android' && queueToClear.length) {
      (async () => {
        const tracks = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        const indexes = tracks.reduce((result, track, index) => {
          if (index !== activeIndex && track.queueEntryId) result.push(index);
          return result;
        }, []);
        if (indexes.length) await TrackPlayer.remove(indexes);
      })().catch(error => console.error('Could not clear the playback queue:', error));
    }
  };

  const moveQueueItem = (fromIndex, toIndex) => {
    const nextQueue = (() => {
      const prev = queueRef.current;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const q = [...prev];
      const [item] = q.splice(fromIndex, 1);
      q.splice(toIndex, 0, item);
      return q;
    })();
    queueRef.current = nextQueue;
    setQueue(nextQueue);

    if (Platform.OS === 'android' && currentSongRef.current) {
      (async () => {
        const tracks = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        const queuedIndexes = tracks.reduce((result, track, index) => {
          if (index !== activeIndex && track.queueEntryId) result.push(index);
          return result;
        }, []);
        if (queuedIndexes.length) await TrackPlayer.remove(queuedIndexes);
        if (nextQueue.length) {
          const nativeTracks = await Promise.all(nextQueue.map(song =>
            makeNativeTrack(song, `queued-${song._queueEntryId}`, song._queueEntryId)
          ));
          await TrackPlayer.add(nativeTracks, (activeIndex ?? -1) + 1);
        }
      })().catch(error => console.error('Could not reorder the playback queue:', error));
    }
  };

  // Reproduce inmediatamente una canción concreta de la cola y la quita de ahí
  const playFromQueue = async (index) => {
    const current = queueRef.current;
    const song = current[index];
    if (!song) return;
    const rest = current.filter((_, i) => i !== index);
    setQueue(rest);
    queueRef.current = rest;
    const pl = currentPlaylistRef.current;
    await playSong(song, pl.length ? pl : [song]);
  };

  const seekTo = async (value) => {
    const requestedPosition = Number.isFinite(value) ? Math.max(0, value) : 0;
    const targetPosition = durationRef.current > 0
      ? Math.min(requestedPosition, durationRef.current)
      : requestedPosition;
    setPosition(targetPosition);
    positionRef.current = targetPosition;
    if (Platform.OS === 'android') {
      try {
        await ensureTrackPlayer();
        await TrackPlayer.seekTo(targetPosition / 1000);
        const progress = await TrackPlayer.getProgress();
        positionRef.current = progress.position * 1000;
        setPosition(positionRef.current);
        if (progress.duration > 0) {
          durationRef.current = progress.duration * 1000;
          setDuration(durationRef.current);
        }
      } catch (error) {
        console.error('Could not seek in the Android music player:', error);
      }
      return;
    }
    if (sound.current) {
      try { await sound.current.setPositionAsync(targetPosition); } catch {}
      advancedRef.current = false;
      if (isPlayingRef.current && durationRef.current > 0) {
        scheduleEndTimer(durationRef.current, targetPosition);
      } else if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
    }
  };

  const toggleLoop = () => {
    const nextValue = !isLoopingRef.current;
    isLoopingRef.current = nextValue;
    setIsLooping(nextValue);
    if (Platform.OS === 'android') {
      const mode = nextValue
        ? RepeatMode.Track
        : (currentPlaylistRef.current.length > 1 ? RepeatMode.Queue : RepeatMode.Off);
      TrackPlayer.setRepeatMode(mode).catch(error => {
        console.error('Could not update repeat mode:', error);
      });
    }
  };

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
        if (Platform.OS === 'android') {
          await TrackPlayer.reset();
          currentNativeTrackIdRef.current = null;
          queueRef.current = [];
          setQueue([]);
          isPlayingRef.current = false;
          setIsPlaying(false);
          setPosition(0);
          setDuration(0);
          await dismissNotification();
          return;
        }
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
      if (currentSong?.id === songId) {
        setCurrentSong(u);
        currentSongRef.current = u;
        await updateNativeMetadata(u);
      }
      return u;
    } catch {}
  };

  const uploadCover = (songId, uri) => new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('cover', { uri, type: 'image/jpeg', name: `${songId}.jpg` });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SERVER_URL}/api/songs/${songId}/cover`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const u = JSON.parse(xhr.responseText);
          setSongs(prev => prev.map(s => s.id === songId ? u : s));
          setCurrentSong(prev => {
            if (prev?.id !== songId) return prev;
            return u;
          });
          if (currentSongRef.current?.id === songId) {
            currentSongRef.current = u;
            updateNativeMetadata(u).catch(error => {
              console.error('Could not update playback artwork:', error);
            });
          }
          resolve(u);
        } catch { reject(new Error('Respuesta inválida')); }
      }
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
      songs, currentSong, isPlaying, favorites, playlists,
      isLooping, searchQuery, setSearchQuery, setPosition, currentPlaylist, currentIndex,
      playSong, pauseSong, resumeSong, playNext, playPrevious, seekTo, toggleLoop,
      toggleFavorite, createPlaylist, updatePlaylist, deletePlaylist,
      uploadSong, deleteSong, updateSong, uploadCover, fetchSongs, loadPlaylists, syncSongs,
      getFilteredSongs, getAllSongs, SERVER_URL, onLogout, activeListeners, fetchListeners,
      folderPlaylists, fetchFolderPlaylists,
      queue, addToQueue, addManyToQueue, removeFromQueue, clearQueue, moveQueueItem, playFromQueue,
      achievements, achievementsLoading, stats, statsLoading, fetchAchievements, fetchStats, claimAchievement,
      achievementToasts, dismissAchievementToast, rateLimitWarning, dismissRateLimitWarning,
    }}>
      {children}
    </MusicContext.Provider>
  );
};