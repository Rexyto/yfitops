// backStack.js
// En PC, la tecla "Atrás" no existe: cierras con el ratón (✕, overlay click...).
// En una TV con mando a distancia, la tecla "Atrás/Volver" del mando es la
// forma natural de cerrar un modal (el reproductor grande, la cola, un editor...)
// y solo debería salir de la app del todo si no hay nada abierto encima.
//
// Cada componente que se comporta como "capa" (modal, panel, vista de detalle)
// se registra aquí con useTvBack(onClose) mientras está montado. Cuando se
// pulsa Atrás, se cierra SOLO la capa de más arriba (la última registrada).
// Si no hay ninguna capa abierta, handleBack() devuelve false y quien la
// llame (tvNavigation.js) decide salir de la aplicación.

import { useEffect } from 'react';

let stack = [];

export function pushBackHandler(fn) {
  stack.push(fn);
}

export function popBackHandler(fn) {
  stack = stack.filter((f) => f !== fn);
}

export function handleBack() {
  if (stack.length === 0) return false;
  const top = stack[stack.length - 1];
  top();
  return true;
}

// Hook de conveniencia: úsalo en cualquier modal/panel/vista con "onClose".
export function useTvBack(onBack) {
  useEffect(() => {
    if (typeof onBack !== 'function') return undefined;
    pushBackHandler(onBack);
    return () => popBackHandler(onBack);
  }, [onBack]);
}
