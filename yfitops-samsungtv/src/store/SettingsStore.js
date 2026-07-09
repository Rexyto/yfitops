import { create } from 'zustand';

const THEME_KEY = 'yfitops_theme';
const LANG_KEY = 'yfitops_language';

// ── Temas disponibles ─────────────────────────────────────────
// Mismo catálogo que la app de PC. `swatch` son los 2 colores que se
// pintan en la bolita del selector: [color principal, color secundario].
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

function detectDefaultTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEME_IDS.includes(saved)) return saved;
  } catch {}
  return 'dark';
}

const useSettingsStore = create((set, get) => ({
  // ── Apariencia ────────────────────────────────────────────
  theme: detectDefaultTheme(),
  language: detectDefaultLanguage(),

  // ── Perfil ────────────────────────────────────────────────
  profilePicture: null,       // dataURL o null
  profileLoading: true,

  // ── Conectividad ──────────────────────────────────────────
  isOnline: navigator.onLine,

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
  },

  // ── Tema ────────────────────────────────────────────────────
  setTheme: (theme) => {
    if (!THEME_IDS.includes(theme)) return;
    localStorage.setItem(THEME_KEY, theme);
    applyThemeToDocument(theme);
    set({ theme });
  },
  // Se mantiene por compatibilidad con quien todavía llame a toggleTheme()
  // (alterna solo entre oscuro/claro, el resto de temas se eligen con setTheme).
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  // ── Idioma ──────────────────────────────────────────────────
  setLanguage: (language) => {
    localStorage.setItem(LANG_KEY, language);
    set({ language });
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
}));

export default useSettingsStore;
