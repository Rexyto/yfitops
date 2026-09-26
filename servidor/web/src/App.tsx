import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import UsersPage from './pages/UsersPage';
import StatsPage from './pages/StatsPage';
import VersionPage from './pages/VersionPage';
import ApiKeysPage from './pages/ApiKeysPage';
import AchievementsPage from './pages/AchievementsPage';
import CreditsPage from './pages/CreditsPage';
import AdminPanelPage from './pages/AdminPanelPage';

interface User {
  username: string;
  role: 'superadmin' | 'user';
}

function ProtectedRoute({
  user,
  children
}: {
  user: User | null;
  children: JSX.Element;
}) {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function AdminOnlyRoute({
  user,
  children
}: {
  user: User | null;
  children: JSX.Element;
}) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/web/me', {
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const logout = async () => {
    await fetch('/web/logout', {
      method: 'POST',
      credentials: 'include'
    });

    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff'
      }}>
        Cargando...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={user.role === 'superadmin' ? '/panel-admin' : '/home'} replace />
            ) : (
              <LoginPage onLogin={setUser} />
            )
          }
        />

        <Route path="/panel-admin" element={<AdminPanelPage user={user} onLogin={setUser} onLogout={logout} />} />

        {/*  PÁGINAS PÚBLICAS */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/*  RUTAS PROTEGIDAS */}
        <Route
          element={
            <ProtectedRoute user={user}>
              <Layout user={user!} onLogout={logout} />
            </ProtectedRoute>
          }
        >

          <Route path="/home" element={<HomePage user={user!} />} />
          <Route path="/users" element={<AdminOnlyRoute user={user}><UsersPage user={user!} /></AdminOnlyRoute>} />
          <Route path="/stats" element={<StatsPage user={user!} />} />
          <Route path="/version" element={<VersionPage />} />
          <Route path="/achievements" element={<AchievementsPage user={user!} />} />
          <Route path="/api-keys" element={<AdminOnlyRoute user={user}><ApiKeysPage user={user!} /></AdminOnlyRoute>} />
          <Route path="/credits" element={<CreditsPage user={user!} />} />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}
