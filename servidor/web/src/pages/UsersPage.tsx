import { useState, useEffect } from 'react';

interface UsersPageProps {
  user: { username: string; role: 'superadmin' | 'user' };
}

interface User {
  id: string;
  username: string;
}

interface UserStats {
  totalListeningSeconds: number;
  totalHours: number;
  totalSongsPlayed: number;
  currentStreak: number;
  mostPlayedSong: { id: string; title: string; artist: string; playCount: number } | null;
  mostPlayedPlaylist: { id: string; type: string; name: string; playCount: number } | null;
  achievementsUnlocked: number;
  achievementsTotal: number;
}

export default function UsersPage({ user }: UsersPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [statsFor, setStatsFor] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    fetch('/web/users')
      .then(r => r.ok ? r.json() : Promise.reject('Error'))
      .then(setUsers)
      .catch(() => setError('No se pudieron cargar los usuarios'))
      .finally(() => setLoading(false));
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/web/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear usuario');
      }
      const newUser = await res.json();
      setUsers(prev => [...prev, newUser]);
      setNewUsername('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const res = await fetch(`/web/users/${userId}`, { method: 'DELETE' });
      if (res.ok) setUsers(prev => prev.filter(u => u.id !== userId));
    } catch {
      setError('Error al eliminar usuario');
    }
  };

  const viewStats = async (u: User) => {
    setStatsFor(u);
    setStats(null);
    setStatsLoading(true);
    try {
      const res = await fetch(`/web/users/${u.id}/stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudieron cargar las estadísticas');
      setStats(await res.json());
    } catch {
      setError('No se pudieron cargar las estadísticas de este usuario');
      setStatsFor(null);
    } finally {
      setStatsLoading(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />Cargando usuarios...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Usuarios</div>
        <div className="page-subtitle">{users.length} usuarios registrados</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title">Nuevo usuario</div>
        <form onSubmit={handleAddUser} className="form-row" style={{ marginTop: '0.75rem' }}>
          <input
            className="input"
            type="text"
            placeholder="Nombre de usuario"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Contraseña"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creando...' : 'Crear'}
          </button>
        </form>
      </div>

      {statsFor && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Estadísticas de {statsFor.username}</span>
            <button className="btn btn-secondary" onClick={() => setStatsFor(null)} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}>
              Cerrar
            </button>
          </div>
          {statsLoading || !stats ? (
            <div className="loading" style={{ padding: '1.5rem 0' }}><div className="spinner" />Cargando...</div>
          ) : (
            <>
              <div className="stat-grid" style={{ marginTop: '1rem' }}>
                <div className="stat-card">
                  <div className="stat-label">Horas escuchadas</div>
                  <div className="stat-value">{stats.totalHours}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Canciones reproducidas</div>
                  <div className="stat-value">{stats.totalSongsPlayed}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Racha actual</div>
                  <div className="stat-value">{stats.currentStreak}<span className="stat-unit"> días</span></div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Logros desbloqueados</div>
                  <div className="stat-value">{stats.achievementsUnlocked}<span className="stat-unit">/{stats.achievementsTotal}</span></div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div className="card" style={{ background: 'var(--bg-2)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 4 }}>Canción más escuchada</div>
                  {stats.mostPlayedSong ? (
                    <div>
                      <div style={{ fontWeight: 600 }}>{stats.mostPlayedSong.title}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
                        {stats.mostPlayedSong.artist} · {stats.mostPlayedSong.playCount} reproducciones
                      </div>
                    </div>
                  ) : <div style={{ color: 'var(--text-3)' }}>Sin datos todavía</div>}
                </div>
                <div className="card" style={{ background: 'var(--bg-2)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 4 }}>Playlist más escuchada</div>
                  {stats.mostPlayedPlaylist ? (
                    <div>
                      <div style={{ fontWeight: 600 }}>{stats.mostPlayedPlaylist.name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
                        {stats.mostPlayedPlaylist.playCount} reproducciones
                      </div>
                    </div>
                  ) : <div style={{ color: 'var(--text-3)' }}>Sin datos todavía</div>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {users.length === 0 ? (
        <div className="empty">No hay usuarios registrados</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td className="td-mono">{u.id}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => viewStats(u)}
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', marginRight: 6 }}
                    >
                      Ver stats
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(u.id)}
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem' }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}