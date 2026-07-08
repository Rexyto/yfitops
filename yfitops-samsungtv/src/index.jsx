// El logger debe instalarse LO ANTES POSIBLE, antes incluso de que se monte
// React, para no perder ningún log/error que ocurra durante el arranque.
import { installConsoleCapture } from './tv/logger';
installConsoleCapture();

// El bridge debe cargarse antes que App: App y sus componentes usan
// window.electronAPI ya asumiendo que existe.
import './tv/tvBridge';

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import TvErrorBoundary from './tv/ErrorBoundary';

const root = createRoot(document.getElementById('root'));
root.render(
  <TvErrorBoundary>
    <App />
  </TvErrorBoundary>
);
