import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.join(__dirname, '..');
export const WEB_DIR = path.join(ROOT_DIR, 'web');
export const DIST_DIR = path.join(WEB_DIR, 'dist');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const USERS_FILE = path.join(DATA_DIR, 'users.json');
export const DATA_FILE = path.join(DATA_DIR, 'data.json');
export const DATAPL_FILE = path.join(DATA_DIR, 'dataplaylist.json');
export const APP_VERSION_FILE = path.join(DATA_DIR, 'version.json');
export const CHANGELOG_FILE = path.join(DATA_DIR, 'actualizacion.json');
export const STATS_FILE = path.join(DATA_DIR, 'stats.json');
export const CANCIONES_DIR = path.join(ROOT_DIR, 'canciones');
export const PLAYLIST_DIR = path.join(ROOT_DIR, 'playlist');
export const PORTADAS_DIR = path.join(ROOT_DIR, 'portadas');
export const AUDIO_EXTS = ['.mp3', '.m4a', '.wav', '.flac', '.ogg'];
export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
export const JWT_SECRET = process.env.JWT_SECRET || 'yfitops_super_secret_key_2026';
export const WEB_JWT_SECRET = process.env.WEB_JWT_SECRET || 'yfitops_web_secret_2026';
export const PC_JWT_SECRET = process.env.PC_JWT_SECRET || 'yfitops_pc_secret_2026';
export const HOST = '0.0.0.0';
export const PORT = process.env.SERVER_PORT || 6666;
export const DEFAULT_STATS = {
  totalListeningSeconds: 0,
  totalSongsPlayed: 0,
  latencySamples: [],
  processingTimes: [],
  dailyListening: {}
};
export const DEFAULT_DATA = { songs: [], playlists: [] };
export const DEFAULT_DATAPL = { playlists: [] };
export const DEFAULT_VERSION = { version: '1.0.0', apkUrl: '' };
export const DEFAULT_CHANGELOG = { version: '', notes: '' };