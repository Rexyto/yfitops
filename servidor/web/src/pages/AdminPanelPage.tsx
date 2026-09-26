import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsPage from './StatsPage';
import UsersPage from './UsersPage';
import ApiKeysPage from './ApiKeysPage';
import AchievementsPage from './AchievementsPage';
import VersionPage from './VersionPage';

type AdminUser = { username: string; role: 'superadmin' | 'user' };
type Section = 'overview' | 'playlists' | 'stats' | 'users' | 'apis' | 'achievements' | 'version';

type Song = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  filename: string;
  coverUrl?: string | null;
};

type Playlist = {
  id: string;
  type: 'manual' | 'folder';
  name: string;
  folderName?: string;
  coverUrl?: string | null;
  songs: Song[];
  userId?: string | null;
};

function AdminIcon({ children }: { children: string }) {
  return <span className="admin-nav-icon" aria-hidden="true">{children}</span>;
}

function AdminLogin({ onLogin }: { onLogin: (user: AdminUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const login = await fetch('/web/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!login.ok) throw new Error('Credenciales incorrectas');
      const me = await fetch('/web/me', { credentials: 'include' }).then(response => response.json());
      if (me.role !== 'superadmin') throw new Error('Esta zona está reservada al super administrador');
      onLogin(me);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-shell">
      <div className="admin-login-visual">
        <span className="admin-kicker">YFITOPS / CONTROL ROOM</span>
        <h1>Todo el servidor, bajo control.</h1>
        <p>Gestiona el catálogo, las playlists, los accesos y la actividad desde un único espacio privado.</p>
        <div className="admin-signal"><span /> Sistema preparado para administrar</div>
      </div>
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-brand-mark">Y</div>
        <div className="admin-kicker">ACCESO PRIVADO</div>
        <h2>Panel de administración</h2>
        <p className="admin-muted">Usa tu cuenta habitual de YFitops.</p>
        <input className="input" placeholder="Usuario" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} disabled={loading} />
        <input className="input" type="password" placeholder="Contraseña" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={loading} />
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary admin-login-button" disabled={loading}>{loading ? 'Verificando...' : 'Entrar al panel'}</button>
      </form>
    </div>
  );
}

function PlaylistManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selected = playlists.find(playlist => `${playlist.type}:${playlist.id}` === selectedId) || null;
  const filteredSongs = useMemo(() => selected?.songs.filter(song => `${song.title} ${song.artist || ''}`.toLowerCase().includes(search.toLowerCase())) || [], [selected, search]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/web/admin/playlists', { credentials: 'include' });
      if (!response.ok) throw new Error('No se pudieron cargar las playlists');
      const data: Playlist[] = await response.json();
      setPlaylists(data);
      if (!selectedId && data[0]) {
        setSelectedId(`${data[0].type}:${data[0].id}`);
        setName(data[0].name);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error cargando playlists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selected) setName(selected.name); }, [selected]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const updatePlaylist = async () => {
    if (!selected || !name.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/web/admin/playlists/${selected.type}/${selected.id}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'No se pudo guardar');
      const updated = await response.json();
      setPlaylists(current => current.map(item => item.type === selected.type && item.id === selected.id ? updated : item));
      notify('Playlist actualizada.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const upload = async (url: string, file: File, success: string) => {
    if (!selected) return;
    const formData = new FormData();
    formData.append('cover', file);
    const response = await fetch(url, { method: 'POST', credentials: 'include', body: formData });
    if (!response.ok) throw new Error((await response.json()).error || 'No se pudo subir la imagen');
    const updated = await response.json();
    if (updated.songs) setPlaylists(current => current.map(item => item.type === selected.type && item.id === selected.id ? updated : item));
    notify(success);
  };

  const uploadSong = async (file: File) => {
    if (!selected) return;
    const formData = new FormData();
    formData.append('audio', file);
    const response = await fetch(`/web/admin/playlists/${selected.type}/${selected.id}/songs`, {
      method: 'POST', credentials: 'include', body: formData,
    });
    if (!response.ok) throw new Error((await response.json()).error || 'No se pudo subir la canción');
    const song = await response.json();
    setPlaylists(current => current.map(item => item.type === selected.type && item.id === selected.id ? { ...item, songs: [...item.songs, song] } : item));
    notify('Canción añadida a la playlist.');
  };

  const editSong = async (song: Song) => {
    if (!selected) return;
    const title = window.prompt('Nuevo nombre de la canción', song.title);
    if (!title?.trim() || title.trim() === song.title) return;
    const response = await fetch(`/web/admin/playlists/${selected.type}/${selected.id}/songs/${song.id}`, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }),
    });
    if (!response.ok) return setError('No se pudo editar la canción');
    const updated = await response.json();
    setPlaylists(current => current.map(item => item.type === selected.type && item.id === selected.id ? { ...item, songs: item.songs.map(currentSong => currentSong.id === song.id ? updated : currentSong) } : item));
    notify('Nombre de canción actualizado.');
  };

  const deleteSong = async (song: Song) => {
    if (!selected || !window.confirm(`¿Eliminar "${song.title}" del servidor?`)) return;
    const response = await fetch(`/web/admin/playlists/${selected.type}/${selected.id}/songs/${song.id}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) return setError('No se pudo eliminar la canción');
    setPlaylists(current => current.map(item => item.type === selected.type && item.id === selected.id ? { ...item, songs: item.songs.filter(currentSong => currentSong.id !== song.id) } : item));
    notify('Canción eliminada del servidor.');
  };

  if (loading) return <div className="loading"><div className="spinner" />Cargando playlists...</div>;

  return (
    <div className="admin-playlists">
      <div className="admin-section-heading"><div><div className="admin-kicker">BIBLIOTECA</div><h2>Playlists</h2><p>Organiza nombres, portadas y canciones del catálogo.</p></div><div className="admin-count">{playlists.length} colecciones</div></div>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="playlist-workspace">
        <aside className="playlist-list">
          {playlists.map(playlist => {
            const key = `${playlist.type}:${playlist.id}`;
            return <button key={key} className={`playlist-list-item ${selectedId === key ? 'active' : ''}`} onClick={() => { setSelectedId(key); setName(playlist.name); setSearch(''); }}>
              <div className="playlist-thumb">{playlist.coverUrl ? <img src={playlist.coverUrl} alt="" /> : <span>{playlist.type === 'folder' ? '▦' : '♪'}</span>}</div>
              <div><strong>{playlist.name}</strong><small>{playlist.type === 'folder' ? 'Colección de carpeta' : 'Playlist manual'} · {playlist.songs.length} canciones</small></div>
            </button>;
          })}
          {!playlists.length && <div className="empty">No hay playlists todavía.</div>}
        </aside>
        {selected ? <section className="playlist-detail">
          <div className="playlist-detail-header">
            <div className="playlist-cover-large">{selected.coverUrl ? <img src={selected.coverUrl} alt="" /> : <span>♪</span>}</div>
            <div className="playlist-title-block"><span className="admin-kicker">{selected.type === 'folder' ? 'COLECCIÓN DE CARPETA' : 'PLAYLIST MANUAL'}</span><h3>{selected.name}</h3><span>{selected.songs.length} canciones</span></div>
            <div className="playlist-actions"><label className="btn btn-primary upload-control">Subir canción<input type="file" accept="audio/*" onChange={event => { const file = event.target.files?.[0]; if (file) uploadSong(file).catch(error => setError(error.message)); }} /></label><label className="btn btn-secondary upload-control">Cambiar portada<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) upload(`/web/admin/playlists/${selected.type}/${selected.id}/cover`, file, 'Portada actualizada.').catch(error => setError(error.message)); }} /></label></div>
          </div>
          <div className="playlist-edit-row"><input className="input" value={name} onChange={event => setName(event.target.value)} /><button className="btn btn-primary" onClick={updatePlaylist} disabled={saving}>{saving ? 'Guardando...' : 'Guardar nombre'}</button></div>
          <div className="playlist-songs-toolbar"><strong>Canciones</strong><input className="input" placeholder="Filtrar canciones..." value={search} onChange={event => setSearch(event.target.value)} /></div>
          <div className="admin-song-list">
            {filteredSongs.map(song => <div className="admin-song-row" key={song.id}>
              <div className="song-cover-small">{song.coverUrl ? <img src={song.coverUrl} alt="" /> : <span>♪</span>}</div>
              <div className="admin-song-info"><strong>{song.title}</strong><span>{song.artist || 'Artista desconocido'}{song.album ? ` · ${song.album}` : ''}</span></div>
              <label className="icon-action" title="Subir portada"><span>▧</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) upload(`/web/admin/playlists/${selected.type}/${selected.id}/songs/${song.id}/cover`, file, 'Portada de canción actualizada.').catch(error => setError(error.message)); }} /></label>
              <button className="icon-action" title="Editar nombre" onClick={() => editSong(song)}>✎</button>
              <button className="icon-action danger" title="Eliminar canción" onClick={() => deleteSong(song)}>×</button>
            </div>)}
            {!filteredSongs.length && <div className="empty">No hay canciones que mostrar.</div>}
          </div>
        </section> : <div className="empty playlist-empty">Selecciona una playlist para comenzar.</div>}
      </div>
    </div>
  );
}

export default function AdminPanelPage({ user, onLogin, onLogout }: { user: AdminUser | null; onLogin: (user: AdminUser) => void; onLogout: () => void }) {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('overview');

  if (!user) return <AdminLogin onLogin={onLogin} />;
  if (user.role !== 'superadmin') return <div className="admin-denied"><h1>Acceso restringido</h1><p>Esta zona sólo está disponible para el super administrador.</p><button className="btn btn-secondary" onClick={() => { onLogout(); navigate('/login'); }}>Volver</button></div>;

  const tabs: Array<{ id: Section; label: string; icon: string }> = [
    { id: 'overview', label: 'Resumen', icon: '◌' }, { id: 'playlists', label: 'Playlists', icon: '▤' },
    { id: 'stats', label: 'Stats totales', icon: '◒' }, { id: 'users', label: 'Usuarios', icon: '◎' },
    { id: 'apis', label: 'APIs de bots', icon: '⌘' }, { id: 'achievements', label: 'Logros', icon: '✦' }, { id: 'version', label: 'Versiones', icon: '↗' },
  ];

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand"><div className="admin-brand-mark">Y</div><div><strong>YFitops</strong><span>ADMIN CONSOLE</span></div></div>
      <div className="admin-sidebar-rule" />
      <nav>{tabs.map(tab => <button key={tab.id} className={section === tab.id ? 'active' : ''} onClick={() => setSection(tab.id)}><AdminIcon>{tab.icon}</AdminIcon>{tab.label}</button>)}</nav>
      <button className="admin-exit" onClick={() => { onLogout(); navigate('/login'); }}>↩ Cerrar sesión</button>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span className="admin-kicker">SUPER ADMINISTRADOR</span><h1>{tabs.find(tab => tab.id === section)?.label}</h1></div><div className="admin-user-chip"><span className="admin-online" />{user.username}</div></header>
      {section === 'overview' && <div className="admin-overview"><div className="admin-hero"><span className="admin-kicker">CENTRO DE OPERACIONES</span><h2>El catálogo tiene buen pulso.</h2><p>Desde aquí puedes entrar directamente en las áreas que necesitan atención.</p><button className="btn btn-primary" onClick={() => setSection('playlists')}>Abrir biblioteca →</button></div><div className="admin-quick-grid">{tabs.slice(1).map(tab => <button key={tab.id} className="admin-quick-card" onClick={() => setSection(tab.id)}><AdminIcon>{tab.icon}</AdminIcon><strong>{tab.label}</strong><span>Gestionar ahora ↗</span></button>)}</div></div>}
      {section === 'playlists' && <PlaylistManager />}
      {section === 'stats' && <StatsPage user={user} />}
      {section === 'users' && <UsersPage user={user} />}
      {section === 'apis' && <ApiKeysPage user={user} />}
      {section === 'achievements' && <AchievementsPage user={user} />}
      {section === 'version' && <VersionPage />}
    </main>
  </div>;
}
