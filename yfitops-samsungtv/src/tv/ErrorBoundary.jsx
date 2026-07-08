import React from 'react';

// Sin esto, cualquier error al renderizar (como el de padStart que causaba
// la pantalla en negro) hace que React desmonte TODA la app sin avisar:
// te quedas mirando una pantalla negra sin ninguna pista de qué ha pasado.
// Con este límite de error, en vez de eso se muestra una pantalla con el
// mensaje del error y un botón para reintentar, y además queda registrado
// en el visor de logs (Ajustes → Registro) para poder revisarlo con calma.
export default class TvErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(
      'Fallo de render capturado por ErrorBoundary:',
      error?.message || error,
      info?.componentStack || ''
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={styles.title}>Algo ha fallado</h2>
          <p style={styles.msg}>{this.state.error?.message || 'Error desconocido'}</p>
          <p style={styles.hint}>
            Se ha guardado en el registro de la app. Si vuelves a entrar,
            puedes verlo en Ajustes → Registro (logs).
          </p>
          <button style={styles.btn} onClick={this.handleReset} autoFocus tabIndex={0}>
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }
}

const styles = {
  wrap: {
    width: '100vw', height: '100vh', background: '#0a0a0a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: 540, maxWidth: '90vw', background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 20, padding: 40, display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', gap: 8,
  },
  title: { color: '#ffffff', margin: '8px 0 0', fontSize: 24, fontWeight: 800 },
  msg: { color: '#ff8080', fontSize: 14, margin: 0, wordBreak: 'break-word', fontFamily: 'monospace' },
  hint: { color: '#888888', fontSize: 13, margin: '4px 0 16px', lineHeight: 1.5 },
  btn: {
    background: '#1ed760', border: 'none', borderRadius: 10,
    padding: '14px 28px', color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer',
  },
};
