// logger.js
// En la TV no hay una consola a mano como en el navegador del PC (o hace
// falta conectarla a Tizen Studio con el inspector remoto cada vez). Este
// módulo guarda los últimos logs/errores en memoria y en localStorage
// (para que sobrevivan a un cierre de la app) y expone una función para
// consultarlos DESDE DENTRO de la propia app: Ajustes → Registro (logs).

const MAX_ENTRIES = 200;
const STORAGE_KEY = 'yfitops_tv_logs';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let buffer = loadPersisted();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX_ENTRIES)));
  } catch {
    // Si localStorage falla (lleno, deshabilitado...) no pasa nada grave,
    // los logs solo viven en memoria hasta que se cierre la app.
  }
}

function toText(arg) {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === 'object' && arg !== null) {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

function push(level, args) {
  buffer.push({
    level,
    time: new Date().toISOString(),
    text: args.map(toText).join(' '),
  });
  if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);
  persist();
}

// Engancha console.log/warn/error (para que TODO lo que ya se registra por
// consola en el resto del código quede también guardado aquí sin tener que
// reescribir nada) y además captura errores y promesas rechazadas que se
// hayan escapado sin que nadie las atrape.
export function installConsoleCapture() {
  ['log', 'warn', 'error'].forEach((level) => {
    const original = console[level] ? console[level].bind(console) : () => {};
    console[level] = (...args) => {
      push(level, args);
      original(...args);
    };
  });

  window.addEventListener('error', (e) => {
    push('error', [`Error no capturado: ${e.message} (${e.filename}:${e.lineno}:${e.colno})`]);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    push('error', [`Promesa rechazada sin capturar: ${reason?.message || reason}`]);
  });
}

// Más reciente primero, para verlo cómodo en pantalla.
export function getLogs() {
  return buffer.slice().reverse();
}

export function clearLogs() {
  buffer = [];
  persist();
}
