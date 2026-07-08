import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="notfound">
      <div className="notfound-code">404</div>
      <h2>Esta ruta no existe</h2>
      <p>
        Puede que el enlace esté roto o que la página se haya movido. Vuelve
        al inicio para seguir navegando.
      </p>
      <Link to="/" className="hero-btn-primary">Volver al inicio</Link>
    </div>
  );
}
