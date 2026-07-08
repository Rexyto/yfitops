// format.js
// Pequeñas utilidades de formato de tiempo, compartidas por varias vistas.
//
// IMPORTANTE: aquí NO se usa String.prototype.padStart aposta. Ese método
// no existe en el motor Chromium ~56 que trae Tizen 4.0 (se añadió en
// Chrome 57) — Babel solo transpila SINTAXIS, no puede "inventar" un
// método que falte en el motor de verdad. Usarlo ahí no da un error de
// compilación, sino un TypeError EN TIEMPO DE EJECUCIÓN justo al intentar
// pintar la duración de la primera canción — que es exactamente lo que
// causaba la pantalla en negro nada más iniciar sesión.

function pad2(n) {
  n = Math.floor(n);
  return (n < 10 ? '0' : '') + n;
}

// Segundos (duración de una canción) → "3:45"
export function fmtDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 1) return '--:--';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${pad2(s)}`;
}

// Milisegundos (posición de reproducción) → "3:45"
export function fmtMs(ms) {
  if (!ms || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${pad2(s)}`;
}

// Segundos totales (duración de una playlist entera) → "1h 20min" / "45 min"
export function fmtTotalDuration(totalSeconds) {
  if (!totalSeconds) return '0 min';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}
