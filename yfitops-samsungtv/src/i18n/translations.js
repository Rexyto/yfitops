// translations.js
// Diccionario de textos de interfaz. Los nombres de canciones, playlists,
// artistas y usuarios NUNCA se traducen: solo la interfaz de la app.
//
// Versión TV: se han quitado las claves de "inicio automático con el
// sistema" y "descargas sin conexión" porque esas funciones no existen
// en esta versión (no tienen sentido en una Smart TV).

const es = {
  'app.loading': 'Cargando...',

  // Sidebar / navegación
  'nav.songs': 'Biblioteca',
  'nav.favorites': 'Favoritos',
  'nav.playlists': 'Colecciones',
  'nav.settings': 'Ajustes',
  'sidebar.listening': (n) => `${n} escuchando`,
  'sidebar.offline': 'Sin conexión',
  'sidebar.logout': 'Cerrar sesión',

  // Login
  'login.username': 'Usuario',
  'login.password': 'Contraseña',
  'login.signIn': 'Iniciar sesión',
  'login.signingIn': '...',
  'login.errorEmpty': 'Rellena usuario y contraseña',
  'login.errorConnection': 'Error de conexión',
  'login.showPassword': 'Mostrar contraseña',
  'login.hidePassword': 'Ocultar contraseña',
  'login.tvHint': 'Usa las flechas del mando para moverte y OK para seleccionar',

  // Changelog
  'changelog.title': (v) => `Novedades de la versión ${v}`,
  'changelog.upToDate': 'La aplicación está actualizada. Estas son las novedades:',
  'common.close': 'Cerrar',

  // Banner sin conexión
  'offline.banner': 'Sin conexión a internet',

  // Biblioteca / canciones
  'songs.title': 'Mi Biblioteca',
  'songs.count': (n) => `${n} canción${n === 1 ? '' : 'es'}`,
  'songs.sync': 'Sync',
  'songs.searchPlaceholder': 'Buscar canciones, artistas...',
  'songs.addToQueue': 'Agregar a la cola',
  'songs.edit': 'Editar',
  'songs.favorite': 'Favorito',
  'songs.empty': 'Sin canciones',
  'songs.emptyHint': 'No se encontraron resultados',
  'songs.editModalTitle': 'Editar canción',
  'songs.fieldTitle': 'Título',
  'songs.fieldArtist': 'Artista',
  'songs.fieldAlbum': 'Álbum',
  'songs.cancel': 'Cancelar',
  'songs.save': 'Guardar',
  'songs.saving': '...',
  'songs.changeCover': 'CAMBIAR',

  // Favoritos
  'favorites.title': 'Favoritos',
  'favorites.count': (n) => `${n} canción${n === 1 ? '' : 'es'}`,
  'favorites.addAllToQueue': '+ Agregar todo a la cola',
  'favorites.shuffle': '🔀 Aleatorio',
  'favorites.play': '▶ Play',
  'favorites.addToQueue': 'Agregar a la cola',
  'favorites.empty': 'Sin favoritos',
  'favorites.emptyHint': 'Dale a ♥ en cualquier canción para añadirla aquí',

  // Colecciones / Playlists
  'playlists.title': 'Colecciones',
  'playlists.count': (n) => `${n} lista${n === 1 ? '' : 's'}`,
  'playlists.fromFolders': 'Desde carpetas',
  'playlists.mine': 'Mis colecciones',
  'playlists.songCount': (n) => `${n} canciones`,
  'playlists.songCountAndDuration': (n, d) => `${n} canciones · ${d}`,
  'playlists.shuffle': '🔀 Aleatorio',
  'playlists.play': '▶ Play',
  'playlists.addQueue': '+ Cola',
  'playlists.search': 'Buscar',
  'playlists.searchPlaceholder': 'Buscar en esta lista...',
  'playlists.noResults': 'Sin resultados',
  'playlists.noResultsHint': (q) => `No hay canciones con "${q}"`,
  'playlists.emptyList': 'Lista vacía',
  'playlists.emptyListHint': 'Esta lista no tiene canciones',
  'playlists.back': '← Volver',
  'playlists.emptyOverall': 'Sin colecciones',
  'playlists.emptyOverallHint': 'Las colecciones se crean desde la app móvil',

  // Reproductor
  'player.mute': 'Silenciar',
  'player.queue': 'Cola de reproducción',
  'player.nowPlaying': 'REPRODUCIENDO',
  'player.repeat': 'Repetir',

  // Cola
  'queue.title': 'Cola de reproducción',
  'queue.waiting': (n) => `${n} en espera`,
  'queue.nowPlayingLabel': 'REPRODUCIENDO AHORA',
  'queue.clear': 'Vaciar cola',
  'queue.moveUp': 'Subir',
  'queue.moveDown': 'Bajar',
  'queue.remove': 'Quitar de la cola',
  'queue.playNow': 'Reproducir ahora',
  'queue.close': 'Cerrar',
  'queue.empty': 'Cola vacía',
  'queue.emptyHint': 'Agrega canciones con el botón "+" de cualquier lista',

  // Ajustes — índice
  'settings.title': 'Ajustes',
  'settings.subtitle': 'Preferencias de la aplicación',
  'settings.index.profile': 'Perfil',
  'settings.index.appearance': 'Apariencia',
  'settings.index.logs': 'Registro',
  'settings.index.credits': 'Créditos',
  'settings.index.version': 'Versión',

  // Ajustes — Perfil
  'settings.profile.title': 'Perfil',
  'settings.profile.subtitle': 'Tu foto se guarda solo en esta TV, nunca se sube al servidor',
  'settings.profile.upload': 'Subir foto',
  'settings.profile.uploading': 'Subiendo...',
  'settings.profile.change': 'Cambiar foto',
  'settings.profile.remove': 'Quitar foto',
  'settings.profile.errorType': 'Solo se admiten imágenes JPG o PNG',
  'settings.profile.errorGeneric': 'No se pudo guardar la imagen',

  // Ajustes — Apariencia
  'settings.appearance.title': 'Apariencia',
  'settings.appearance.subtitle': 'Se aplica a toda la app y se recuerda entre sesiones',
  'settings.appearance.themeLabel': (themeName) => `Tema: ${themeName}`,
  'settings.appearance.themeHint': 'Elige el color de fondo de toda la app',
  'settings.appearance.languageLabel': 'Idioma',
  'settings.appearance.languageHint': 'Cambia el idioma de toda la interfaz',

  // Nombres de los temas de color
  'theme.dark': 'Oscuro',
  'theme.light': 'Claro',
  'theme.red': 'Rojo',
  'theme.sky': 'Celeste',
  'theme.purple': 'Morado',
  'theme.green': 'Verde',
  'theme.orange': 'Naranja',
  'theme.amber': 'Ámbar',
  'theme.pink': 'Rosa',
  'theme.teal': 'Turquesa',
  'theme.indigo': 'Índigo',

  // Ajustes — Registro (logs)
  'settings.logs.title': 'Registro (logs)',
  'settings.logs.subtitle': 'Últimos mensajes y errores de la app, guardados en esta TV — útil para depurar sin tener que conectar la tele al PC',
  'settings.logs.open': 'Ver registro',
  'settings.logs.count': (n) => `${n} entrada${n === 1 ? '' : 's'}`,
  'settings.logs.clear': 'Vaciar registro',
  'settings.logs.empty': 'Todavía no hay nada registrado',

  // Ajustes — Créditos
  'settings.credits.title': 'Créditos',
  'settings.credits.text': 'YFitops está creado y mantenido por',
  'settings.credits.source': '📦 github.com/Rexyto/yfitops',
  'settings.credits.author': '👤 github.com/Rexyto',

  // Ajustes — Versión
  'settings.version.title': 'Versión',

  // TV — mando a distancia
  'tv.backHint': 'Pulsa ATRÁS para volver',
};

const en = {
  'app.loading': 'Loading...',

  // Sidebar / navigation
  'nav.songs': 'Library',
  'nav.favorites': 'Favorites',
  'nav.playlists': 'Collections',
  'nav.settings': 'Settings',
  'sidebar.listening': (n) => `${n} listening`,
  'sidebar.offline': 'No connection',
  'sidebar.logout': 'Log out',

  // Login
  'login.username': 'Username',
  'login.password': 'Password',
  'login.signIn': 'Sign in',
  'login.signingIn': '...',
  'login.errorEmpty': 'Fill in your username and password',
  'login.errorConnection': 'Connection error',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.tvHint': 'Use the remote\'s arrows to move and OK to select',

  // Changelog
  'changelog.title': (v) => `What's new in version ${v}`,
  'changelog.upToDate': 'The app is up to date. Here\'s what changed:',
  'common.close': 'Close',

  // Offline banner
  'offline.banner': 'No internet connection',

  // Library / songs
  'songs.title': 'My Library',
  'songs.count': (n) => `${n} song${n === 1 ? '' : 's'}`,
  'songs.sync': 'Sync',
  'songs.searchPlaceholder': 'Search songs, artists...',
  'songs.addToQueue': 'Add to queue',
  'songs.edit': 'Edit',
  'songs.favorite': 'Favorite',
  'songs.empty': 'No songs',
  'songs.emptyHint': 'No results found',
  'songs.editModalTitle': 'Edit song',
  'songs.fieldTitle': 'Title',
  'songs.fieldArtist': 'Artist',
  'songs.fieldAlbum': 'Album',
  'songs.cancel': 'Cancel',
  'songs.save': 'Save',
  'songs.saving': '...',
  'songs.changeCover': 'CHANGE',

  // Favorites
  'favorites.title': 'Favorites',
  'favorites.count': (n) => `${n} song${n === 1 ? '' : 's'}`,
  'favorites.addAllToQueue': '+ Add all to queue',
  'favorites.shuffle': '🔀 Shuffle',
  'favorites.play': '▶ Play',
  'favorites.addToQueue': 'Add to queue',
  'favorites.empty': 'No favorites',
  'favorites.emptyHint': 'Tap ♥ on any song to add it here',

  // Collections / Playlists
  'playlists.title': 'Collections',
  'playlists.count': (n) => `${n} collection${n === 1 ? '' : 's'}`,
  'playlists.fromFolders': 'From folders',
  'playlists.mine': 'My collections',
  'playlists.songCount': (n) => `${n} songs`,
  'playlists.songCountAndDuration': (n, d) => `${n} songs · ${d}`,
  'playlists.shuffle': '🔀 Shuffle',
  'playlists.play': '▶ Play',
  'playlists.addQueue': '+ Queue',
  'playlists.search': 'Search',
  'playlists.searchPlaceholder': 'Search in this list...',
  'playlists.noResults': 'No results',
  'playlists.noResultsHint': (q) => `No songs match "${q}"`,
  'playlists.emptyList': 'Empty list',
  'playlists.emptyListHint': 'This list has no songs',
  'playlists.back': '← Back',
  'playlists.emptyOverall': 'No collections',
  'playlists.emptyOverallHint': 'Collections are created from the mobile app',

  // Player
  'player.mute': 'Mute',
  'player.queue': 'Playback queue',
  'player.nowPlaying': 'NOW PLAYING',
  'player.repeat': 'Repeat',

  // Queue
  'queue.title': 'Playback queue',
  'queue.waiting': (n) => `${n} waiting`,
  'queue.nowPlayingLabel': 'NOW PLAYING',
  'queue.clear': 'Clear queue',
  'queue.moveUp': 'Move up',
  'queue.moveDown': 'Move down',
  'queue.remove': 'Remove from queue',
  'queue.playNow': 'Play now',
  'queue.close': 'Close',
  'queue.empty': 'Queue is empty',
  'queue.emptyHint': 'Add songs using the "+" button on any list',

  // Settings — index
  'settings.title': 'Settings',
  'settings.subtitle': 'Application preferences',
  'settings.index.profile': 'Profile',
  'settings.index.appearance': 'Appearance',
  'settings.index.logs': 'Logs',
  'settings.index.credits': 'Credits',
  'settings.index.version': 'Version',

  // Settings — Profile
  'settings.profile.title': 'Profile',
  'settings.profile.subtitle': 'Your photo is stored only on this TV, never uploaded to the server',
  'settings.profile.upload': 'Upload photo',
  'settings.profile.uploading': 'Uploading...',
  'settings.profile.change': 'Change photo',
  'settings.profile.remove': 'Remove photo',
  'settings.profile.errorType': 'Only JPG or PNG images are supported',
  'settings.profile.errorGeneric': 'Could not save the image',

  // Settings — Appearance
  'settings.appearance.title': 'Appearance',
  'settings.appearance.subtitle': 'Applies to the whole app and is remembered between sessions',
  'settings.appearance.themeLabel': (themeName) => `Theme: ${themeName}`,
  'settings.appearance.themeHint': 'Choose the background color for the whole app',
  'settings.appearance.languageLabel': 'Language',
  'settings.appearance.languageHint': 'Changes the language across the whole interface',

  // Theme color names
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'theme.red': 'Red',
  'theme.sky': 'Sky Blue',
  'theme.purple': 'Purple',
  'theme.green': 'Green',
  'theme.orange': 'Orange',
  'theme.amber': 'Amber',
  'theme.pink': 'Pink',
  'theme.teal': 'Teal',
  'theme.indigo': 'Indigo',

  // Settings — Logs
  'settings.logs.title': 'Logs',
  'settings.logs.subtitle': 'Recent app messages and errors, stored on this TV — useful for debugging without hooking the TV up to a PC',
  'settings.logs.open': 'View logs',
  'settings.logs.count': (n) => `${n} entr${n === 1 ? 'y' : 'ies'}`,
  'settings.logs.clear': 'Clear logs',
  'settings.logs.empty': 'Nothing logged yet',

  // Settings — Credits
  'settings.credits.title': 'Credits',
  'settings.credits.text': 'YFitops is created and maintained by',
  'settings.credits.source': '📦 github.com/Rexyto/yfitops',
  'settings.credits.author': '👤 github.com/Rexyto',

  // Settings — Version
  'settings.version.title': 'Version',

  // TV — remote control
  'tv.backHint': 'Press BACK to return',
};

export const translations = { es, en };

export function translate(lang, key, ...args) {
  const dict = translations[lang] || translations.es;
  const fallback = translations.es;
  const entry = (key in dict) ? dict[key] : fallback[key];
  if (typeof entry === 'function') return entry(...args);
  return entry ?? key;
}
