import { Link, Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-logo">
          <img src="/logo.png" alt="YFitops" className="public-logo-img" />
          YFitops
        </Link>
        <Link to="/login" className="public-header-cta">Acceder</Link>
      </header>

      <main className="public-main">
        <Outlet />
      </main>

      <footer className="public-footer">
        <div className="public-footer-links">
          <Link to="/privacy">Política de Privacidad</Link>
          <Link to="/terms">Términos de Uso</Link>
        </div>
        <div>
          Creado por{' '}
          <a
            className="credit-link"
            href="https://github.com/Rexyto"
            target="_blank"
            rel="noreferrer"
          >
            Rexy
          </a>
        </div>
      </footer>
    </div>
  );
}
