import React from 'react';

interface RouterProps {
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
}

/* IMPORTA TU NUEVA PAGE */
import VersionPage from './pages/VersionPage';

export function Router({ isAuthenticated, setIsAuthenticated }: RouterProps) {
  const [currentPage, setCurrentPage] = React.useState<string>(
    isAuthenticated ? 'home' : 'login'
  );

  React.useEffect(() => {
    const token = localStorage.getItem('web_token');
    setCurrentPage(token ? 'home' : 'login');
  }, [isAuthenticated]);

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return (
          <LoginPage
            setIsAuthenticated={setIsAuthenticated}
            setCurrentPage={setCurrentPage}
          />
        );

      case 'home':
        return <HomePage setCurrentPage={setCurrentPage} />;

      case 'users':
        return <UsersPage setCurrentPage={setCurrentPage} />;

      case 'stats':
        return <StatsPage setCurrentPage={setCurrentPage} />;

      case 'songs':
        return <SongsPage setCurrentPage={setCurrentPage} />;

      /* 🔥 NUEVO */
      case 'version':
        return <VersionPage />;

      default:
        return <HomePage setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <div>
      {isAuthenticated && (
        <nav style={{ background: '#111', padding: '1rem', borderRight: '1px solid #222' }}>
          <button onClick={() => setCurrentPage('home')}>Inicio</button>
          <button onClick={() => setCurrentPage('songs')}>Canciones</button>
          <button onClick={() => setCurrentPage('users')}>Usuarios</button>
          <button onClick={() => setCurrentPage('stats')}>Estadísticas</button>

          {/* 🔥 NUEVO BOTÓN */}
          <button onClick={() => setCurrentPage('version')}>Version</button>

          <button
            onClick={() => {
              localStorage.removeItem('web_token');
              setIsAuthenticated(false);
              setCurrentPage('login');
            }}
          >
            Salir
          </button>
        </nav>
      )}

      {renderPage()}
    </div>
  );
}

/* =========================
   LOGIN PAGE
========================= */

function LoginPage({ setIsAuthenticated, setCurrentPage }: any) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/web/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        setIsAuthenticated(true);
        setCurrentPage('home');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111', padding: '2rem', borderRadius: '12px', maxWidth: '360px', width: '100%' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>YFitops</h1>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff'
            }}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff'
            }}
          />

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#1ed760',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================
   PAGES PLACEHOLDER
========================= */

function HomePage({ setCurrentPage }: any) {
  return <div style={{ padding: '2rem' }}>Inicio</div>;
}

function SongsPage({ setCurrentPage }: any) {
  return <div style={{ padding: '2rem' }}>Canciones</div>;
}

function UsersPage({ setCurrentPage }: any) {
  return <div style={{ padding: '2rem' }}>Usuarios</div>;
}

function StatsPage({ setCurrentPage }: any) {
  return <div style={{ padding: '2rem' }}>Estadísticas</div>;
}