// translations.js
// Textos de la interfaz. Nombres de canciones, playlists y artistas
// nunca se traducen aquí — solo la interfaz de la app.

const es = {
  // Navegación
  'nav.songs': 'Inicio',
  'nav.favorites': 'Favoritos',
  'nav.playlists': 'Colecciones',
  'nav.settings': 'Ajustes',

  // Login
  'login.username': 'Usuario',
  'login.password': 'Contraseña',
  'login.signIn': 'Iniciar sesión',
  'login.errorTitle': 'Error',
  'login.errorEmpty': 'Rellena usuario y contraseña',
  'login.errorCreds': 'Credenciales incorrectas',
  'login.errorConnectionTitle': 'Error de conexión',
  'login.errorConnection': 'No se puede conectar con el servidor.\nComprueba que está encendido y en la misma red.',

  // Biblioteca / canciones
  'songs.title': 'Mi Biblioteca',
  'songs.sync': 'Sync',
  'songs.searchPlaceholder': 'Buscar canciones, artistas...',
  'songs.count': (n) => `${n} CANCIÓN${n === 1 ? '' : 'ES'}`,
  'songs.uploadErrorTitle': 'Error',
  'songs.uploadErrorPicker': 'No se pudo abrir el selector',
  'songs.uploading': (n) => `Subiendo ${n} canciones`,
  'songs.close': 'Cerrar',
  'songs.deleteSong': 'Eliminar canción',
  'songs.cancel': 'Cancelar',
  'songs.downloadedTooltip': 'Disponible sin conexión',

  // Favoritos
  'favorites.title': 'Favoritos',
  'favorites.count': (n) => `${n} canción${n === 1 ? '' : 'es'}`,
  'favorites.empty': 'Sin favoritos',
  'favorites.emptyHint': 'Dale a ❤️ en cualquier canción para añadirla aquí',

  // Colecciones
  'playlists.title': 'Colecciones',
  'playlists.count': (n) => `${n} colecci${n === 1 ? 'ón' : 'ones'}`,
  'playlists.fromFolders': 'Desde carpetas',
  'playlists.mine': 'Mis colecciones',
  'playlists.empty': 'Sin colecciones',
  'playlists.emptyHint': 'Pulsa + para crear tu primera colección',
  'playlists.songCount': (n) => `${n} canciones`,
  'playlists.shuffle': '🔀 Aleatorio',
  'playlists.play': '▶ Play',
  'playlists.searchPlaceholder': 'Buscar canciones...',
  'playlists.searchInList': 'Buscar en esta lista...',
  'playlists.newCollection': 'Nueva colección',
  'playlists.name': 'Nombre',
  'playlists.color': 'Color',
  'playlists.create': 'Crear',
  'playlists.cancel': 'Cancelar',
  'playlists.downloaded': 'Descargada',

  // Editar canción
  'song.edit': 'Editar canción',
  'song.title': 'Título',
  'song.artist': 'Artista',
  'song.album': 'Álbum',
  'song.cancel': 'Cancelar',
  'song.save': 'Guardar',
  'song.saving': '...',
  'song.change': 'CAMBIAR',
  'song.noPermission': 'Sin permiso',
  'song.uploadError': 'No se pudo subir la imagen',
  'song.updated': 'Imagen actualizada',

  // Reproductor
  'player.nowPlaying': 'REPRODUCIENDO',
  'player.queue': 'Cola de reproducción',

  // Cola de reproducción
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
  'songs.addToQueue': 'Agregar a la cola',

  // Ajustes
  'settings.title': 'Ajustes',
  'settings.subtitle': 'Preferencias de la aplicación',
  'settings.index.profile': 'Perfil',
  'settings.index.appearance': 'Apariencia',
  'settings.index.downloads': 'Descargas offline',
  'settings.index.storage': 'Almacenamiento',
  'settings.index.credits': 'Créditos',
  'settings.index.version': 'Versión',

  'settings.profile.title': 'Perfil',
  'settings.profile.subtitle': 'Tu foto se guarda solo en este dispositivo, nunca se sube al servidor',
  'settings.profile.upload': 'Subir foto',
  'settings.profile.change': 'Cambiar foto',
  'settings.profile.remove': 'Quitar foto',
  'settings.profile.noPermission': 'Necesitamos acceso a tus fotos para esto',

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

  'settings.downloads.title': 'Descargas offline',
  'settings.downloads.subtitle': 'Descarga tus colecciones para escucharlas sin conexión',
  'settings.downloads.none': 'No tienes colecciones disponibles todavía.',
  'settings.downloads.download': '⬇ Descargar',
  'settings.downloads.downloading': (done, total) => `Descargando ${done}/${total}`,
  'settings.downloads.downloaded': '✓ Descargada',
  'settings.downloads.remove': 'Eliminar',
  'settings.downloads.offlineHint': 'Necesitas conexión a internet para descargar',
  'settings.downloads.songCount': (n) => `${n} canciones`,

  'settings.storage.title': 'Almacenamiento',
  'settings.storage.subtitle': 'Espacio ocupado por las canciones descargadas en este dispositivo',
  'settings.storage.collectionsCount': (n) => `${n} colección${n === 1 ? '' : 'es'} descargada${n === 1 ? '' : 's'}`,
  'settings.storage.none': 'Sin descargas todavía',
  'settings.storage.clear': 'Vaciar caché descargada',
  'settings.storage.clearing': 'Vaciando...',
  'settings.storage.confirm': '¿Seguro? Toca para confirmar',
  'settings.storage.cancel': 'Cancelar',

  'settings.credits.title': 'Créditos',
  'settings.credits.text': 'YFitops está creado y mantenido por',
  'settings.credits.source': '📦 Código fuente en GitHub',
  'settings.credits.author': '👤 GitHub de Rexy',

  'settings.version.title': 'Versión',

  'settings.logout': 'Cerrar sesión',

  // Sin conexión
  'offline.banner': 'Sin conexión a internet',

  // Modal de app (novedades / actualización)
  'app.whatsNew': (v) => `Novedades en v${v}`,
  'app.updateAvailable': 'Actualización disponible',
  'app.updateDesc': 'Hay una nueva versión de YFitops disponible. Actualiza para disfrutar de las últimas mejoras.',
  'app.great': '¡Genial!',
  'app.close': 'Cerrar',
  'app.closeApp': 'Cerrar app',
  'app.updateNow': '⬇  Actualizar ahora',
};

const en = {
  'nav.songs': 'Home',
  'nav.favorites': 'Favorites',
  'nav.playlists': 'Collections',
  'nav.settings': 'Settings',

  'login.username': 'Username',
  'login.password': 'Password',
  'login.signIn': 'Sign in',
  'login.errorTitle': 'Error',
  'login.errorEmpty': 'Fill in your username and password',
  'login.errorCreds': 'Incorrect credentials',
  'login.errorConnectionTitle': 'Connection error',
  'login.errorConnection': 'Can\'t connect to the server.\nCheck that it\'s on and on the same network.',

  'songs.title': 'My Library',
  'songs.sync': 'Sync',
  'songs.searchPlaceholder': 'Search songs, artists...',
  'songs.count': (n) => `${n} SONG${n === 1 ? '' : 'S'}`,
  'songs.uploadErrorTitle': 'Error',
  'songs.uploadErrorPicker': 'Couldn\'t open the file picker',
  'songs.uploading': (n) => `Uploading ${n} songs`,
  'songs.close': 'Close',
  'songs.deleteSong': 'Delete song',
  'songs.cancel': 'Cancel',
  'songs.downloadedTooltip': 'Available offline',

  'favorites.title': 'Favorites',
  'favorites.count': (n) => `${n} song${n === 1 ? '' : 's'}`,
  'favorites.empty': 'No favorites',
  'favorites.emptyHint': 'Tap ❤️ on any song to add it here',

  'playlists.title': 'Collections',
  'playlists.count': (n) => `${n} collection${n === 1 ? '' : 's'}`,
  'playlists.fromFolders': 'From folders',
  'playlists.mine': 'My collections',
  'playlists.empty': 'No collections',
  'playlists.emptyHint': 'Tap + to create your first collection',
  'playlists.songCount': (n) => `${n} songs`,
  'playlists.shuffle': '🔀 Shuffle',
  'playlists.play': '▶ Play',
  'playlists.searchPlaceholder': 'Search songs...',
  'playlists.searchInList': 'Search in this list...',
  'playlists.newCollection': 'New collection',
  'playlists.name': 'Name',
  'playlists.color': 'Color',
  'playlists.create': 'Create',
  'playlists.cancel': 'Cancel',
  'playlists.downloaded': 'Downloaded',

  'song.edit': 'Edit song',
  'song.title': 'Title',
  'song.artist': 'Artist',
  'song.album': 'Album',
  'song.cancel': 'Cancel',
  'song.save': 'Save',
  'song.saving': '...',
  'song.change': 'CHANGE',
  'song.noPermission': 'No permission',
  'song.uploadError': 'Couldn\'t upload the image',
  'song.updated': 'Image updated',

  'player.nowPlaying': 'NOW PLAYING',
  'player.queue': 'Playback queue',

  // Playback queue
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
  'songs.addToQueue': 'Add to queue',

  'settings.title': 'Settings',
  'settings.subtitle': 'Application preferences',
  'settings.index.profile': 'Profile',
  'settings.index.appearance': 'Appearance',
  'settings.index.downloads': 'Offline downloads',
  'settings.index.storage': 'Storage',
  'settings.index.credits': 'Credits',
  'settings.index.version': 'Version',

  'settings.profile.title': 'Profile',
  'settings.profile.subtitle': 'Your photo is stored only on this device, never uploaded to the server',
  'settings.profile.upload': 'Upload photo',
  'settings.profile.change': 'Change photo',
  'settings.profile.remove': 'Remove photo',
  'settings.profile.noPermission': 'We need access to your photos for this',

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

  'settings.downloads.title': 'Offline downloads',
  'settings.downloads.subtitle': 'Download your collections to listen without a connection',
  'settings.downloads.none': 'You don\'t have any collections available yet.',
  'settings.downloads.download': '⬇ Download',
  'settings.downloads.downloading': (done, total) => `Downloading ${done}/${total}`,
  'settings.downloads.downloaded': '✓ Downloaded',
  'settings.downloads.remove': 'Remove',
  'settings.downloads.offlineHint': 'You need an internet connection to download',
  'settings.downloads.songCount': (n) => `${n} songs`,

  'settings.storage.title': 'Storage',
  'settings.storage.subtitle': 'Space used by songs downloaded on this device',
  'settings.storage.collectionsCount': (n) => `${n} collection${n === 1 ? '' : 's'} downloaded`,
  'settings.storage.none': 'No downloads yet',
  'settings.storage.clear': 'Clear downloaded cache',
  'settings.storage.clearing': 'Clearing...',
  'settings.storage.confirm': 'Are you sure? Tap to confirm',
  'settings.storage.cancel': 'Cancel',

  'settings.credits.title': 'Credits',
  'settings.credits.text': 'YFitops is created and maintained by',
  'settings.credits.source': '📦 Source code on GitHub',
  'settings.credits.author': '👤 Rexy\'s GitHub',

  'settings.version.title': 'Version',

  'settings.logout': 'Log out',

  'offline.banner': 'No internet connection',

  'app.whatsNew': (v) => `What's new in v${v}`,
  'app.updateAvailable': 'Update available',
  'app.updateDesc': 'A new version of YFitops is available. Update to enjoy the latest improvements.',
  'app.great': 'Great!',
  'app.close': 'Close',
  'app.closeApp': 'Close app',
  'app.updateNow': '⬇  Update now',
};

export const translations = { es, en };

export function translate(lang, key, ...args) {
  const dict = translations[lang] || translations.es;
  const fallback = translations.es;
  const entry = (key in dict) ? dict[key] : fallback[key];
  if (typeof entry === 'function') return entry(...args);
  return entry ?? key;
}
