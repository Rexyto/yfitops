import { useState, useEffect } from 'react';

interface UsersPageProps {
  user: { username: string; role: 'superadmin' | 'user' };
}

interface User {
  id: string;
  username: string;
}

export default function UsersPage({ user }: UsersPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

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