import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useState } from 'react';

interface User {
  username: string;
  role: 'superadmin' | 'user';
}

const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const StatsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="2" x2="12" y2="22"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const VersionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2v20m-7-5h14M5 9h14M9 14h6"/>
  </svg>
);

const ApiIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 8h10M7 12h4M7 16h6" />
  </svg>
);

const CreditsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

export default function Layout({
  user,
  onLogout
}: {
  user: User;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = [
    { path: '/home', label: 'Inicio', icon: HomeIcon },
    { path: '/users', label: 'Usuarios', icon: UsersIcon, admin: true },
    { path: '/stats', label: 'Stats', icon: StatsIcon },
    { path: '/api-keys', label: 'APIs', icon: ApiIcon, admin: true },
    { path: '/version', label: 'Version', icon: VersionIcon },
    { path: '/credits', label: 'Créditos', icon: CreditsIcon }
  ];

  return (
    <div className="layout">
      {/* OVERLAY PARA MÓVIL */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="YFitops Logo" style={{ height: '28px', width: 'auto', marginRight: '8px' }} />
            YFitops
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav
            .filter(i => !i.admin || user.role === 'superadmin')
            .map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-btn ${location.pathname === item.path ? 'active' : ''}`}
                  style={{ textDecoration: 'none' }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon />
                  {item.label}
                </Link>
              );
            })}

          <button
            className="nav-btn logout"
            onClick={() => {
              onLogout();
              navigate('/login');
              setSidebarOpen(false);
            }}
            style={{ textDecoration: 'none' }}
          >
            <LogoutIcon />
            Salir
          </button>
        </nav>
      </aside>

      {/* CONTENIDO */}
      <main className="main">
        {/* HEADER MÓVIL */}
        <header className="mobile-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <MenuIcon />
          </button>
          <div className="mobile-title">YFitops</div>
        </header>

        {/* 👇 ESTO ES CLAVE */}
        <Outlet />
      </main>

    </div>
  );
}