import { Link } from 'react-router-dom';

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function LandingPage() {
  return (
    <>
      <section className="hero">
        <span className="hero-badge">● Servidor activo</span>
        <h1>Bienvenido a YFitops</h1>
        <p>
          YFitops es tu panel de música y administración. Inicia sesión para
          controlar usuarios, ver estadísticas y actualizar versiones.
        </p>
        <div className="hero-actions">
          <Link to="/login" className="hero-btn-primary">Acceder al panel</Link>
        </div>
      </section>

      <section className="features-section">
        <div className="features-heading">¿Qué puedes hacer?</div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><PlayIcon /></div>
            <h3>Escucha y controla</h3>
            <p>
              Accede al servidor de música desde el navegador, controla las
              listas de reproducción y consulta el estado de actividad en
              tiempo real.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><ShieldIcon /></div>
            <h3>Administra todo</h3>
            <p>
              Gestiona usuarios, revisa estadísticas y descarga las
              aplicaciones móvil y PC desde un solo lugar.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
