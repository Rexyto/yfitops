import { useEffect, useState } from 'react';

interface HomePageProps {
  user: { username: string; role: 'superadmin' | 'user' };
}

interface ServerStatus {
  songs: number;
  playlists: number;
  users: number;
  activeListeners: number;
  status: string;
}

const ShieldIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const MusicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18v-7m6 7v-7m0-2l-9-2V4m9 0l9 2v10c0 5.523-4.477 10-10 10s-10-4.477-10-10v-10"/>
  </svg>
);

export default function HomePage({ user }: HomePageProps) {
  const isAdmin = user.role === 'superadmin';
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          setStatus(await res.json());
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page">
      <div className="welcome-banner">
        <div className="welcome-name">Hola, {user.username} 👋</div>
        <div className="welcome-role">
          <span className={`badge ${isAdmin ? 'badge-green' : 'badge-gray'}`}>
            {isAdmin && <ShieldIcon />}
            {isAdmin ? 'Administrador' : 'Usuario'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-3)' }}>
            YFitops v2.0.0
          </span>
        </div>
      </div>

      {!loading && status && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Canciones</div>
            <div className="stat-value">{status.songs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Playlists</div>
            <div className="stat-value">{status.playlists}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Usuarios</div>
            <div className="stat-value">{status.users}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Escuchando ahora</div>
            <div className="stat-value" style={{ color: status.activeListeners > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
              {status.activeListeners}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-title">App Móvil</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            Disponible en Android con todas las funciones de reproducción, favoritos y playlists.
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>v2.0.0 - Última actualización</div>
        </div>

        <div className="card">
          <div className="card-title">App PC</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            Nueva aplicación de escritorio para una experiencia de reproducción mejorada en tu computadora.
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>v1.0.0 - Nuevo</div>
        </div>

        <div className="card">
          <div className="card-title">Panel Web</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            {isAdmin
              ? 'Acceso total a gestión de usuarios, versiones y estadísticas del servidor.'
              : 'Visualiza estadísticas y gestiona tu perfil desde el navegador.'}
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Acceso integrado</div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ marginTop: '2rem' }}>
          <div className="page-subtitle" style={{ marginBottom: '1rem' }}>Panel administrativo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
              <div className="card-title">Gestión de usuarios</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
                Crea, edita y elimina usuarios del sistema.
              </p>
              <a href="/users" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                Ir a usuarios →
              </a>
            </div>

            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
              <div className="card-title">Actualizar versiones</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
                Configura versiones de apps y notas de actualización.
              </p>
              <a href="/version" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                Ir a versiones →
              </a>
            </div>

            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
              <div className="card-title">Estadísticas</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
                Analiza escuchas, latencia y actividad del servidor.
              </p>
              <a href="/stats" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                Ver estadísticas →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}