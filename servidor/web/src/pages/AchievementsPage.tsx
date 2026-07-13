import { useEffect, useMemo, useState } from 'react';

interface AchievementsPageProps {
  user: { username: string; role: 'superadmin' | 'user' };
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  category: string;
  metric: string;
  threshold: number;
  clientReported: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

const METRICS = [
  { value: 'songs_played', label: 'Canciones reproducidas (total)' },
  { value: 'unique_songs_played', label: 'Canciones distintas reproducidas' },
  { value: 'song_play_count', label: 'Repeticiones de una misma canción' },
  { value: 'listening_hours', label: 'Horas de escucha totales' },
  { value: 'daily_streak', label: 'Racha de días seguidos' },
  { value: 'favorites_count', label: 'Canciones en favoritos' },
  { value: 'playlists_created', label: 'Playlists creadas' },
  { value: 'unique_playlists_played', label: 'Playlists distintas reproducidas' },
  { value: 'playlist_play_count', label: 'Repeticiones de una misma playlist' },
  { value: 'songs_uploaded', label: 'Canciones subidas' },
  { value: 'night_hours', label: 'Horas de escucha nocturna (00:00-05:59)' },
  { value: 'weekend_hours', label: 'Horas de escucha en fin de semana' },
  { value: 'account_age_days', label: 'Antigüedad de la cuenta (días)' },
  { value: 'achievements_unlocked', label: 'Logros ya desbloqueados' },
  { value: 'library_size', label: 'Tamaño de la biblioteca (global)' },
  { value: 'max_daily_hours', label: 'Máximo de horas en un solo día' },
  { value: 'client_reported', label: 'Reclamado manualmente por el cliente' },
];

const CATEGORIES = ['general', 'listening', 'time', 'streak', 'favorites', 'playlists', 'library', 'offline'];

const emptyForm = {
  id: '', icon: '🏅', title: '', description: '', category: 'general',
  metric: 'songs_played', threshold: 1, clientReported: false, active: true, sortOrder: 999,
};

function metricLabel(metric: string) {
  return METRICS.find(m => m.value === metric)?.label || metric;
}

export default function AchievementsPage({ user }: AchievementsPageProps) {
  const isAdmin = user.role === 'superadmin';
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/web/achievements', { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudieron cargar los logros');
      setAchievements(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (a: Achievement) => {
    setEditingId(a.id);
    setForm({
      id: a.id, icon: a.icon, title: a.title, description: a.description,
      category: a.category, metric: a.metric, threshold: a.threshold,
      clientReported: a.clientReported, active: a.active, sortOrder: a.sortOrder,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const isEdit = !!editingId;
      const res = await fetch(isEdit ? `/web/achievements/${editingId}` : '/web/achievements', {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, threshold: Number(form.threshold), sortOrder: Number(form.sortOrder) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar el logro');
      }
      await load();
      setShowForm(false);
      showMessage(isEdit ? 'Logro actualizado.' : 'Logro creado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Achievement) => {
    try {
      const res = await fetch(`/web/achievements/${a.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !a.active }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setAchievements(prev => prev.map(x => (x.id === a.id ? { ...x, active: !x.active } : x)));
    } catch {
      setError('No se pudo cambiar el estado del logro');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este logro del catálogo? Los desbloqueos de los usuarios para este logro se perderán.')) return;
    try {
      const res = await fetch(`/web/achievements/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Error al eliminar');
      setAchievements(prev => prev.filter(a => a.id !== id));
      showMessage('Logro eliminado.');
    } catch {
      setError('No se pudo eliminar el logro');
    }
  };

  const filtered = useMemo(() => {
    return achievements.filter(a => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (search && !`${a.title} ${a.description} ${a.id}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [achievements, search, categoryFilter]);

  const stats = useMemo(() => ({
    total: achievements.length,
    active: achievements.filter(a => a.active).length,
    clientReported: achievements.filter(a => a.clientReported).length,
  }), [achievements]);

  if (loading) return <div className="loading"><div className="spinner" />Cargando logros...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Logros</div>
          <div className="page-subtitle">Catálogo de logros que pueden desbloquear los usuarios en la app móvil y de PC.</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo logro</button>
        )}
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Logros totales</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Activos</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Reclamados por el cliente</div>
          <div className="stat-value">{stats.clientReported}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <input
            className="input"
            type="text"
            placeholder="Buscar por título, descripción o id..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 240px' }}
          />
          <select
            className="input"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ flex: '0 0 200px' }}
          >
            <option value="all">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title">{editingId ? `Editar logro: ${editingId}` : 'Nuevo logro'}</div>
          <form onSubmit={handleSubmit} style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-row" style={{ gap: '0.75rem' }}>
              {!editingId && (
                <input
                  className="input"
                  placeholder="id (opcional, se genera solo si lo dejas vacío)"
                  value={form.id}
                  onChange={e => setForm({ ...form, id: e.target.value })}
                  style={{ flex: '1 1 200px' }}
                />
              )}
              <input
                className="input"
                placeholder="Icono (emoji)"
                value={form.icon}
                onChange={e => setForm({ ...form, icon: e.target.value })}
                style={{ flex: '0 0 100px' }}
              />
              <input
                className="input"
                placeholder="Título"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
                style={{ flex: '1 1 240px' }}
              />
            </div>

            <textarea
              className="input"
              placeholder="Descripción"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
            />

            <div className="form-row" style={{ gap: '0.75rem' }}>
              <select
                className="input"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                style={{ flex: '1 1 160px' }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                className="input"
                value={form.metric}
                onChange={e => setForm({ ...form, metric: e.target.value, clientReported: e.target.value === 'client_reported' })}
                style={{ flex: '2 1 280px' }}
              >
                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>

              <input
                className="input"
                type="number"
                min={1}
                placeholder="Umbral"
                value={form.threshold}
                onChange={e => setForm({ ...form, threshold: Number(e.target.value) })}
                required
                style={{ flex: '0 0 120px' }}
              />
            </div>

            <div className="form-row" style={{ gap: '1.5rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                <input
                  type="checkbox"
                  checked={form.clientReported}
                  onChange={e => setForm({ ...form, clientReported: e.target.checked })}
                />
                Reclamado por el cliente (no se evalúa en el servidor)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm({ ...form, active: e.target.checked })}
                />
                Activo
              </label>
              <input
                className="input"
                type="number"
                placeholder="Orden"
                value={form.sortOrder}
                onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })}
                style={{ flex: '0 0 100px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear logro'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">No hay logros que coincidan con el filtro</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Logro</th>
                <th>Categoría</th>
                <th>Métrica / Umbral</th>
                <th>Estado</th>
                {isAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ opacity: a.active ? 1 : 0.55 }}>
                  <td style={{ fontSize: '1.3rem' }}>{a.icon}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{a.description}</div>
                    <code style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{a.id}</code>
                  </td>
                  <td><span className="badge badge-gray">{a.category}</span></td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {metricLabel(a.metric)}
                    <br />
                    <span style={{ color: 'var(--text-3)' }}>umbral: {a.threshold}</span>
                  </td>
                  <td>
                    <span className={`badge ${a.active ? 'badge-green' : 'badge-gray'}`}>
                      {a.active ? 'Activo' : 'Inactivo'}
                    </span>
                    {a.clientReported && (
                      <span className="badge badge-yellow" style={{ marginLeft: 4 }}>Cliente</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" onClick={() => openEdit(a)} style={{ marginRight: 6 }}>
                        Editar
                      </button>
                      <button className="btn btn-warning" onClick={() => toggleActive(a)} style={{ marginRight: 6 }}>
                        {a.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(a.id)}>
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
