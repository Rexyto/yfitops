import { useEffect, useMemo, useState } from 'react';

interface ApiKeysPageProps {
  user: { username: string; role: 'superadmin' | 'user' };
}

interface BotApiKey {
  id: string;
  name: string;
  apiKey: string;
  active: boolean;
  usageCount: number;
  avgResponseMs: number;
  lastResponseMs: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ApiKeysPage({ user }: ApiKeysPageProps) {
  const [keys, setKeys] = useState<BotApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [secretKeys, setSecretKeys] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});

  const loadKeys = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/web/bot-keys', { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudieron cargar las claves');
      const data = await res.json();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 4500);
  };

  const copyText = async (text: string, id: string, successText = 'Copiado') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(prev => ({ ...prev, [id]: successText }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [id]: '' })), 3000);
    } catch {
      setCopyStatus(prev => ({ ...prev, [id]: 'Error copiando' }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [id]: '' })), 3000);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/web/bot-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error creando clave');
      }
      const created: BotApiKey = await res.json();
      setKeys(prev => [created, ...prev]);
      setSecretKeys(prev => ({ ...prev, [created.id]: created.apiKey }));
      setNewName('');
      showMessage('Clave creada. Guarda y copia el valor ahora.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCreating(false);
    }
  };

  const updateKey = async (id: string) => {
    const keyItem = keys.find(k => k.id === id);
    if (!keyItem) return;

    setSavingId(id);
    setError('');
    try {
      const res = await fetch(`/web/bot-keys/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyItem.name, active: keyItem.active })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error actualizando clave');
      }
      const updated: BotApiKey = await res.json();
      setKeys(prev => prev.map(k => (k.id === id ? updated : k)));
      showMessage('Clave actualizada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSavingId(null);
    }
  };

  const handleReset = async (id: string) => {
    setSavingId(id);
    setError('');
    try {
      const res = await fetch(`/web/bot-keys/${id}/reset`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al resetear la clave');
      }
      const updated: BotApiKey = await res.json();
      setKeys(prev => prev.map(k => (k.id === id ? updated : k)));
      setSecretKeys(prev => ({ ...prev, [id]: updated.apiKey }));
      showMessage('Clave reiniciada. Copia el valor nuevo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta clave de bot? Esta acción no se puede deshacer.')) return;
    setSavingId(id);
    setError('');
    try {
      const res = await fetch(`/web/bot-keys/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar la clave');
      }
      setKeys(prev => prev.filter(k => k.id !== id));
      setSecretKeys(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      showMessage('Clave eliminada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSavingId(null);
    }
  };

  const handleFieldChange = (id: string, field: 'name' | 'active', value: string | boolean) => {
    setKeys(prev => prev.map(k => (k.id === id ? { ...k, [field]: value } : k)));
  };

  const stats = useMemo(() => {
    const total = keys.length;
    const active = keys.filter(k => k.active).length;
    const inactive = total - active;
    const usage = keys.reduce((sum, k) => sum + k.usageCount, 0);
    const avgResponse = total ? Math.round(keys.reduce((sum, k) => sum + k.avgResponseMs, 0) / total) : 0;
    const lastUsedKey = [...keys]
      .filter(k => k.lastUsedAt)
      .sort((a, b) => Number(new Date(b.lastUsedAt!)) - Number(new Date(a.lastUsedAt!)))[0];
    return {
      total,
      active,
      inactive,
      usage,
      avgResponse,
      lastUsedAt: lastUsedKey?.lastUsedAt || null,
      popular: [...keys].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4),
      slowest: [...keys].sort((a, b) => b.avgResponseMs - a.avgResponseMs).slice(0, 4),
    };
  }, [keys]);

  if (loading) return <div className="loading"><div className="spinner" />Cargando claves de API...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">APIs de bot</div>
          <div className="page-subtitle">Administra las claves de bot, cópialas rápido y revisa el rendimiento con métricas visuales.</div>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Claves totales</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Activas</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactivas</div>
          <div className="stat-value">{stats.inactive}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Uso total</div>
          <div className="stat-value">{stats.usage}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Latencia media</div>
          <div className="stat-value">{stats.avgResponse}<span className="stat-unit"> ms</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Último uso</div>
          <div className="stat-value">{stats.lastUsedAt ? new Date(stats.lastUsedAt).toLocaleString('es') : 'Nunca'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title">Crear nueva clave de bot</div>
        <form onSubmit={handleCreate} className="form-row" style={{ marginTop: '0.9rem' }}>
          <input
            className="input"
            type="text"
            placeholder="Nombre para la clave"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creando...' : 'Crear clave'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', color: 'var(--text-2)', fontSize: '0.92rem' }}>
          La clave se muestra una sola vez después de crearla o resetearla. Copia el valor en cuanto aparezca.
        </div>
      </div>

      {stats.popular.length > 0 && (
        <div className="card chart-card">
          <div className="card-title">Top de uso</div>
          {stats.popular.map(key => {
            const width = stats.usage ? Math.max(8, Math.round((key.usageCount / stats.usage) * 100)) : 0;
            return (
              <div key={key.id} className="chart-row">
                <div className="chart-label">{key.name}</div>
                <div className="chart-bar">
                  <div className="chart-bar-fill" style={{ width: `${width}%` }} />
                </div>
                <div className="chart-value">{key.usageCount}</div>
              </div>
            );
          })}
        </div>
      )}

      {stats.slowest.length > 0 && (
        <div className="card chart-card">
          <div className="card-title">Latencia más alta</div>
          {stats.slowest.map(key => {
            const maxLat = Math.max(...stats.slowest.map(k => k.avgResponseMs), 1);
            const width = Math.max(8, Math.round((key.avgResponseMs / maxLat) * 100));
            return (
              <div key={key.id} className="chart-row">
                <div className="chart-label">{key.name}</div>
                <div className="chart-bar">
                  <div className="chart-bar-fill" style={{ width: `${width}%`, background: 'rgba(255, 130, 71, 0.95)' }} />
                </div>
                <div className="chart-value">{key.avgResponseMs} ms</div>
              </div>
            );
          })}
        </div>
      )}

      {keys.length === 0 ? (
        <div className="empty">No hay claves de bot registradas</div>
      ) : (
        <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Uso</th>
                <th>Latencia</th>
                <th>Último uso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr key={key.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        className="input"
                        type="text"
                        value={key.name}
                        onChange={e => handleFieldChange(key.id, 'name', e.target.value)}
                        style={{ width: '100%', minWidth: 180 }}
                      />
                      <div className="key-preview">
                        <code>{key.id.slice(0, 12)}...{key.id.slice(-6)}</code>
                        <span className="badge badge-gray">Creada {new Date(key.createdAt).toLocaleDateString('es')}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${key.active ? 'badge-green' : 'badge-gray'}`}>
                      {key.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{key.usageCount}</td>
                  <td>{key.avgResponseMs ? `${key.avgResponseMs} ms` : '—'}</td>
                  <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('es') : 'Nunca'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => updateKey(key.id)}
                      disabled={savingId === key.id}
                      style={{ marginRight: 6 }}
                    >
                      Guardar
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleReset(key.id)}
                      disabled={savingId === key.id}
                      style={{ marginRight: 6 }}
                    >
                      Reset
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(key.id)}
                      disabled={savingId === key.id}
                    >
                      Eliminar
                    </button>
                    {secretKeys[key.id] && (
                      <div className="secret-panel">
                        <code>{secretKeys[key.id]}</code>
                        <button
                          type="button"
                          className="btn btn-tertiary"
                          onClick={() => copyText(secretKeys[key.id], key.id)}
                        >
                          {copyStatus[key.id] || 'Copiar clave'}
                        </button>
                      </div>
                    )}
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
