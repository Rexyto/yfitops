// Catálogo de logros

// Este archivo SOLO define los datos q se meten a la db
// metric: identifica qué valor de `computeUserMetrics()` (lib/achievements.js)
// se compara contra `threshold` para desbloquear el logro.
// client_reported = 1 → el logro NO se evalúa automáticamente en el
// servidor, el cliente lo reclama explícitamente vía
// POST /api/achievements/:id/claim (para cosas que sólo existen en el
// dispositivo, como las descargas offline).

const TIER_NAMES = [
  'Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro',
  'Leyenda', 'Mítico', 'Legendario', 'Supremo', 'Eterno', 'Infinito'
];

function pl(n, singular, plural) {
  return n === 1 ? singular : plural;
}

function buildTiered({ metric, icon, category, baseTitle, thresholds, describe }) {
  return thresholds.map((threshold, i) => ({
    id: `${metric}_${i + 1}`,
    icon,
    category,
    metric,
    threshold,
    title: `${baseTitle} ${TIER_NAMES[i] || `Nivel ${i + 1}`}`,
    description: describe(threshold),
    client_reported: 0,
    sort_order: 0, // se recalcula abajo
  }));
}

const groups = [
  buildTiered({
    metric: 'songs_played',
    icon: '🎵',
    category: 'listening',
    baseTitle: 'Reproductor',
    thresholds: [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    describe: (n) => `Reproduce ${n} ${pl(n, 'canción', 'canciones')} en total.`,
  }),
  buildTiered({
    metric: 'unique_songs_played',
    icon: '🎶',
    category: 'listening',
    baseTitle: 'Explorador Musical',
    thresholds: [5, 15, 30, 50, 100, 200, 350, 500],
    describe: (n) => `Escucha ${n} canciones distintas de tu biblioteca.`,
  }),
  buildTiered({
    metric: 'song_play_count',
    icon: '🔁',
    category: 'listening',
    baseTitle: 'Obsesión',
    thresholds: [5, 10, 25, 50, 100, 250],
    describe: (n) => `Reproduce la misma canción ${n} veces.`,
  }),
  buildTiered({
    metric: 'listening_hours',
    icon: '⏱️',
    category: 'time',
    baseTitle: 'Oyente',
    thresholds: [1, 5, 10, 25, 50, 100, 150, 200, 300, 500, 750, 1000],
    describe: (n) => `Acumula ${n} horas de escucha en total.`,
  }),
  buildTiered({
    metric: 'daily_streak',
    icon: '🔥',
    category: 'streak',
    baseTitle: 'Racha',
    thresholds: [2, 3, 5, 7, 10, 14, 21, 30, 60, 100],
    describe: (n) => `Escucha música ${n} días seguidos.`,
  }),
  buildTiered({
    metric: 'favorites_count',
    icon: '❤️',
    category: 'favorites',
    baseTitle: 'Coleccionista',
    thresholds: [1, 5, 10, 25, 50, 100, 150, 200, 300],
    describe: (n) => `Guarda ${n} ${pl(n, 'canción', 'canciones')} como favorita${pl(n, '', 's')}.`,
  }),
  buildTiered({
    metric: 'playlists_created',
    icon: '📁',
    category: 'playlists',
    baseTitle: 'Curador',
    thresholds: [1, 3, 5, 10, 15, 20, 30],
    describe: (n) => `Crea ${n} ${pl(n, 'playlist propia', 'playlists propias')}.`,
  }),
  buildTiered({
    metric: 'unique_playlists_played',
    icon: '🗂️',
    category: 'playlists',
    baseTitle: 'Viajero de Playlists',
    thresholds: [3, 5, 10, 20, 35],
    describe: (n) => `Reproduce ${n} playlists o colecciones distintas.`,
  }),
  buildTiered({
    metric: 'playlist_play_count',
    icon: '📻',
    category: 'playlists',
    baseTitle: 'Fiel a la Playlist',
    thresholds: [5, 10, 25, 50, 100],
    describe: (n) => `Reproduce la misma playlist ${n} veces.`,
  }),
  buildTiered({
    metric: 'songs_uploaded',
    icon: '⬆️',
    category: 'library',
    baseTitle: 'Contribuidor',
    thresholds: [1, 5, 10, 25, 50, 100],
    describe: (n) => `Sube ${n} ${pl(n, 'canción', 'canciones')} al servidor.`,
  }),
  buildTiered({
    metric: 'night_hours',
    icon: '🌙',
    category: 'time',
    baseTitle: 'Búho Nocturno',
    thresholds: [1, 5, 10, 25],
    describe: (n) => `Acumula ${n} horas escuchando música entre las 00:00 y las 05:59.`,
  }),
  buildTiered({
    metric: 'weekend_hours',
    icon: '🎉',
    category: 'time',
    baseTitle: 'Guerrero de Finde',
    thresholds: [1, 5, 10, 25],
    describe: (n) => `Acumula ${n} horas escuchando música en fin de semana.`,
  }),
  buildTiered({
    metric: 'account_age_days',
    icon: '📅',
    category: 'general',
    baseTitle: 'Veterano',
    thresholds: [7, 30, 90, 180, 365],
    describe: (n) => `Sé miembro de YFitops durante ${n} días.`,
  }),
  buildTiered({
    metric: 'achievements_unlocked',
    icon: '🏆',
    category: 'general',
    baseTitle: 'Cazador de Logros',
    thresholds: [10, 25, 50, 75],
    describe: (n) => `Desbloquea ${n} logros distintos.`,
  }),
];

const special = [
  {
    id: 'library_milestone_1',
    icon: '📚',
    category: 'library',
    metric: 'library_size',
    threshold: 100,
    title: 'Biblioteca en Crecimiento',
    description: 'El servidor alcanza 100 canciones en su biblioteca.',
    client_reported: 0,
  },
  {
    id: 'library_milestone_2',
    icon: '🏛️',
    category: 'library',
    metric: 'library_size',
    threshold: 500,
    title: 'Gran Biblioteca',
    description: 'El servidor alcanza 500 canciones en su biblioteca.',
    client_reported: 0,
  },
  {
    id: 'marathon_day',
    icon: '🏃',
    category: 'time',
    metric: 'max_daily_hours',
    threshold: 4,
    title: 'Maratón Musical',
    description: 'Escucha más de 4 horas de música en un solo día.',
    client_reported: 0,
  },
  {
    id: 'offline_first',
    icon: '⬇️',
    category: 'offline',
    metric: 'client_reported',
    threshold: 1,
    title: 'Modo Avión',
    description: 'Descarga tu primera playlist para escuchar sin conexión.',
    client_reported: 1,
  },
];

const ACHIEVEMENTS_CATALOG = [...groups.flat(), ...special].map((a, i) => ({
  ...a,
  sort_order: i,
}));

export { ACHIEVEMENTS_CATALOG };
export default ACHIEVEMENTS_CATALOG;
