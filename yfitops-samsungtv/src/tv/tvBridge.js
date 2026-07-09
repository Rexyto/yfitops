// tvBridge.js
// En la app de PC, "window.electronAPI" lo expone preload.js (proceso Electron)
// y habla con main.js para leer/escribir en disco. Aquí no hay Electron ni Node:
// es un navegador Tizen normal. Este archivo crea un "window.electronAPI" de
// mentira que los componentes ya conocen, pero implementado con localStorage
// (persiste en la TV entre reinicios igual que un archivo lo haría).
//
// Funciones que YA NO EXISTEN aquí a propósito (a petición del usuario):
//   - Discord Rich Presence (no tiene sentido en una TV)
//   - Inicio automático con el sistema (una Smart TV no tiene "inicio de sesión de SO")
//   - Descargas para escuchar sin conexión (la TV siempre está conectada por red)
// Todo lo relacionado con esas 3 cosas se ha quitado también de los
// componentes y de los stores, no solo de aquí.

const SESSION_KEY = 'yfitops_tv_session';
const PROFILE_PIC_KEY = 'yfitops_tv_profile_picture';

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

const tvBridge = {
  // ── Sesión persistida (localStorage en vez de archivo en disco) ──────
  getSession: async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    return safeParse(raw, { token: null, username: null });
  },
  setSession: async (token, username) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, username }));
    return { success: true };
  },
  clearSession: async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: null, username: null }));
    return { success: true };
  },

  // ── Versión de la app (fija, no hay proceso Electron que la reporte) ──
  getAppVersion: async () => '1.2.0',

  // ── Foto de perfil (localStorage en vez de archivo binario) ──────────
  saveProfilePicture: async (dataUrl) => {
    try {
      localStorage.setItem(PROFILE_PIC_KEY, dataUrl);
      return { success: true };
    } catch (err) {
      // localStorage tiene cuota limitada (normalmente ~5MB en el navegador
      // Tizen); si la foto es muy grande puede fallar aquí.
      return { success: false, error: 'No se pudo guardar la imagen (¿demasiado grande?)' };
    }
  },
  getProfilePicture: async () => localStorage.getItem(PROFILE_PIC_KEY) || null,
  clearProfilePicture: async () => {
    localStorage.removeItem(PROFILE_PIC_KEY);
    return { success: true };
  },
};

if (typeof window !== 'undefined') {
  window.electronAPI = tvBridge;
}

export default tvBridge;
