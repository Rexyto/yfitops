import { create } from 'zustand';

const THEME_KEY = 'yfitops_theme';
const LANG_KEY = 'yfitops_language';

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

const useSettingsStore = create((set, get) => ({
  // ── Apariencia ────────────────────────────────────────────
  theme: (localStorage.getItem(THEME_KEY) === 'light') ? 'light' : 'dark',
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
    localStorage.setItem(THEME_KEY, theme);
    applyThemeToDocument(theme);
    set({ theme });
  },
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
