// tvNavigation.js
// La app de PC se maneja con ratón. Aquí no hay ratón, solo un mando con
// flechas, "OK/Enter" y "Atrás". Este módulo hace dos cosas:
//
//  1) Mueve el foco del navegador entre los elementos "enfocables" visibles
//     en pantalla cuando pulsas ↑ ↓ ← → (navegación espacial simple: busca
//     el elemento más cercano en esa dirección).
//  2) Convierte "Enter/OK" del mando en un click sobre el elemento enfocado,
//     y "Atrás" en cerrar el modal/vista abierta (o salir de la app si no
//     hay nada abierto).
//
// Los <button> normales ya activan solos con Enter (comportamiento nativo
// del navegador), así que solo hace falta tratar aparte los <div onClick>
// que se usan como "filas" clicables — para eso está focusableProps() más
// abajo, que se añade a esos divs.

import { useEffect } from 'react';
import { handleBack } from './backStack';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'a[href]',
].join(', ');

function isVisible(el) {
  return !!(el && el.offsetParent !== null);
}

function getFocusable() {
  return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
}

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Busca, entre todos los elementos enfocables visibles, el más cercano
// en la dirección pedida respecto al elemento actual.
function findNext(current, direction) {
  const all = getFocusable();
  if (!current || !document.contains(current)) return all[0] || null;

  const curRect = current.getBoundingClientRect();
  const curCenter = center(curRect);
  let best = null;
  let bestScore = Infinity;

  for (const el of all) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    const c = center(r);
    const dx = c.x - curCenter.x;
    const dy = c.y - curCenter.y;
    let primary, secondary, valid;

    if (direction === 'right') { valid = dx > 4; primary = dx; secondary = Math.abs(dy); }
    else if (direction === 'left') { valid = dx < -4; primary = -dx; secondary = Math.abs(dy); }
    else if (direction === 'down') { valid = dy > 4; primary = dy; secondary = Math.abs(dx); }
    else { valid = dy < -4; primary = -dy; secondary = Math.abs(dx); } // 'up'

    if (!valid) continue;
    // Penaliza más el desalineamiento que la distancia pura, para que
    // "bajar" tienda a quedarse en la misma columna en vez de saltar de fila.
    const score = primary + secondary * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

function isTextualInput(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    return ['text', 'search', 'password', 'email', 'number'].includes(type);
  }
  return false;
}

function isRangeInput(el) {
  return !!(el && el.tagName === 'INPUT' && el.type === 'range');
}

function exitApp() {
  try {
    if (typeof tizen !== 'undefined' && tizen.application) {
      tizen.application.getCurrentApplication().exit();
      return;
    }
  } catch { /* no estamos en un dispositivo Tizen real (p.ej. probando en el navegador del PC) */ }
  // Fuera de una TV real no hay forma estándar de "salir" de una pestaña; no hacemos nada.
}

const DIRECTION_BY_KEY = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

// keyCode 10009 = tecla "Atrás/Volver" del mando Samsung (Tizen).
// También aceptamos 'Escape' para poder probar cómodamente desde un teclado normal.
function isBackKey(e) {
  return e.keyCode === 10009 || e.key === 'Escape' || e.key === 'XF86Back';
}

// Registra las teclas que Tizen necesita que "pidamos" explícitamente
// para que el mando nos las mande de forma fiable (Atrás y multimedia).
function registerTizenKeys() {
  try {
    if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;
    const keys = [
      'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
      'MediaTrackPrevious', 'MediaTrackNext', 'MediaRewind', 'MediaFastForward',
    ];
    keys.forEach((k) => {
      try { tizen.tvinputdevice.registerKey(k); } catch { /* tecla no soportada en este modelo, se ignora */ }
    });
  } catch { /* no estamos en Tizen */ }
}

export function useTvNavigation() {
  useEffect(() => {
    registerTizenKeys();

    function onKeyDown(e) {
      // Atrás: cierra lo que haya abierto (modal/panel/vista) o sale de la app.
      if (isBackKey(e)) {
        e.preventDefault();
        if (!handleBack()) exitApp();
        return;
      }

      // Red de seguridad: el teclado virtual de Tizen manda un "Enter" cada
      // vez que confirmas una letra o lo cierras, no solo cuando quieres
      // enviar un formulario. Si un campo de texto no ha gestionado ya ese
      // Enter por su cuenta (parando la propagación, como hace LoginScreen),
      // lo frenamos aquí para que nunca dispare un submit nativo sin querer.
      if (e.key === 'Enter' && isTextualInput(document.activeElement)) {
        e.preventDefault();
        return;
      }

      const direction = DIRECTION_BY_KEY[e.key];
      if (!direction) return;

      const active = document.activeElement;

      // Dejamos que ← → muevan el cursor de texto / el valor del slider
      // de volumen con normalidad, en vez de robarles el foco.
      if ((direction === 'left' || direction === 'right') && (isTextualInput(active) || isRangeInput(active))) {
        return;
      }

      const next = findNext(active, direction);
      if (next) {
        e.preventDefault();
        next.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    // Foco inicial: si nada tiene foco al arrancar, enfoca el primer elemento visible.
    if (!document.activeElement || document.activeElement === document.body) {
      const first = getFocusable()[0];
      if (first) first.focus();
    }

    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

// Hook para enganchar los botones de multimedia del mando (▶️⏸⏭⏮) a las
// acciones del reproductor, independientemente de qué esté enfocado en pantalla.
export function useTvMediaKeys({ onPlayPause, onNext, onPrevious }) {
  useEffect(() => {
    function onKeyDown(e) {
      switch (e.key) {
        case 'MediaPlayPause': onPlayPause?.(); break;
        case 'MediaPlay': onPlayPause?.(); break;
        case 'MediaPause': onPlayPause?.(); break;
        case 'MediaTrackNext': case 'MediaFastForward': onNext?.(); break;
        case 'MediaTrackPrevious': case 'MediaRewind': onPrevious?.(); break;
        default: return;
      }
      e.preventDefault();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onPlayPause, onNext, onPrevious]);
}

// Props para convertir un <div onClick={...}> en algo enfocable y activable
// con "OK/Enter" del mando. Úsalo así:
//   <div {...focusableProps(() => playSong(song))} style={...}>
export function focusableProps(onActivate, extra = {}) {
  return {
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate?.(e);
      }
      extra.onKeyDown?.(e);
    },
    ...extra,
  };
}
