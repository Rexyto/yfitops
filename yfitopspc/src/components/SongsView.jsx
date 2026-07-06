import React, { useState, useEffect } from 'react';
import useMusicStore from '../store/MusicStore';
import { SERVER_URL } from '../api';

const fmt = (s) => {
  if (!s || s < 1) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function SongsView() {
  const {
    songs, fetchSongs, fetchListeners, playSong, toggleFavorite, favorites,
    currentSong, activeListeners, updateSong, uploadCover, addToQueue,
  } = useMusicStore();
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [editSong, setEditSong] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [saving, setSaving] = useState(false);
  const [queuedId, setQueuedId] = useState(null);

  useEffect(() => {
    fetchListeners();
    const t = setInterval(fetchListeners, 30000);
    return () => clearInterval(t);
  }, []);

  const filtered = search.trim()
    ? songs.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.artist.toLowerCase().includes(search.toLowerCase())
      )
    : songs;

  const handleSync = async () => {
    setSyncing(true);
    await fetchSongs();
    setSyncing(false);
  };

  const handleAddToQueue = (song, e) => {
    e.stopPropagation();
    addToQueue(song);
    setQueuedId(song.id);
    setTimeout(() => setQueuedId(null), 900);
  };

  const openEdit = (song, e) => {
    e.stopPropagation();
    setEditSong(song);
    setEditTitle(song.title);
    setEditArtist(song.artist);
    setEditAlbum(song.album || '');
  };

  const handleSave = async () => {
    setSaving(true);
    await updateSong(editSong.id, { title: editTitle, artist: editArtist, album: editAlbum });
    setSaving(false);
    setEditSong(null);
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editSong) return;
    await uploadCover(editSong.id, file);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Mi Biblioteca</h1>
          <span style={styles.sub}>{filtered.length} canciones</span>
        </div>
        <div style={styles.headerRight}>
          {activeListeners > 0 && (
            <div style={styles.listenersTag}>
              🎧 {activeListeners}
            </div>
          )}
          <button style={styles.syncBtn} onClick={handleSync} disabled={syncing}>
            <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {' Sync'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchBox}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.searchInput}
          placeholder="Buscar canciones, artistas..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button style={styles.clearBtn} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Lista */}
      <div style={styles.list}>
        {filtered.map((song, index) => {
          const isActive = currentSong?.id === song.id;
          const isFav = favorites.includes(song.id);
          const cover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;
          const justQueued = queuedId === song.id;

          return (
            <div
              key={song.id}
              style={{ ...styles.row, ...(isActive ? styles.rowActive : {}) }}
              onClick={() => playSong(song, filtered)}
            >
              <span style={{ ...styles.idx, ...(isActive ? { color: '#1ed760' } : {}) }}>
                {isActive ? '▶' : index + 1}
              </span>
              {cover
                ? <img src={cover} style={styles.cover} alt="" />
                : <div style={styles.coverEmpty}><span style={{ color: '#333' }}>♪</span></div>
              }
              <div style={styles.meta}>
                <span style={{ ...styles.songTitle, ...(isActive ? { color: '#1ed760' } : {}) }}>
                  {song.title}
                </span>
                <span style={styles.songArtist}>{song.artist} · {fmt(song.duration)}</span>
              </div>
              <button
                style={{ ...styles.iconBtn, ...(justQueued ? { color: '#1ed760' } : {}) }}
                onClick={e => handleAddToQueue(song, e)}
                title="Agregar a la cola"
              >{justQueued ? '✓' : '+'}</button>
              <button
                style={styles.iconBtn}
                onClick={e => openEdit(song, e)}
                title="Editar"
              >✎</button>
              <button
                style={styles.iconBtn}
                onClick={e => { e.stopPropagation(); toggleFavorite(song.id); }}
                title="Favorito"
              >
                <span style={{ color: isFav ? '#1ed760' : '#555', fontSize: 16 }}>
                  {isFav ? '♥' : '♡'}
                </span>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 48 }}>🎵</span>
            <p style={styles.emptyTitle}>Sin canciones</p>
            <p style={styles.emptySub}>No se encontraron resultados</p>
          </div>
        )}
      </div>

      {/* Modal editar */}
      {editSong && (
        <div style={styles.overlay} onClick={() => setEditSong(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Editar canción</h2>

            {/* Cover */}
            <label style={styles.coverEditBtn}>
              {editSong.coverUrl
                ? <img src={`${SERVER_URL}${editSong.coverUrl}`} style={styles.coverPreview} alt="" />
                : <div style={{ ...styles.coverPreview, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>♪</div>
              }
              <div style={styles.coverOverlay}>CAMBIAR</div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
            </label>

            <input style={styles.input} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título" />
            <input style={styles.input} value={editArtist} onChange={e => setEditArtist(e.target.value)} placeholder="Artista" />
            <input style={styles.input} value={editAlbum} onChange={e => setEditAlbum(e.target.value)} placeholder="Álbum" />

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setEditSong(null)}>Cancelar</button>
              <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        button { transition: opacity 0.15s; }
        button:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}

const styles = {
  container: { padding: '0 0 20px 0' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '28px 28px 16px' },
  title: { fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5, margin: 0 },
  sub: { fontSize: 12, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  listenersTag: {
    background: '#1ed76015', border: '1px solid #1ed76030',
    borderRadius: 20, padding: '6px 12px',
    color: '#1ed760', fontSize: 13, fontWeight: 700,
  },
  syncBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 20, padding: '8px 14px',
    color: '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  searchBox: {
    display: 'flex', alignItems: 'center',
    background: '#1a1a1a', borderRadius: 10,
    margin: '0 28px 12px', padding: '0 14px',
    border: '1px solid #252525',
  },
  searchIcon: { fontSize: 14, marginRight: 10, flexShrink: 0 },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: '#fff', fontSize: 15, padding: '12px 0',
  },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 16 },
  list: { paddingBottom: 20 },
  row: {
    display: 'flex', alignItems: 'center',
    padding: '9px 20px', margin: '1px 8px',
    borderRadius: 8, cursor: 'pointer',
    transition: 'background 0.1s',
  },
  rowActive: { background: '#1a1a1a' },
  idx: { width: 28, color: '#555', fontSize: 13, textAlign: 'center', fontWeight: 600, flexShrink: 0 },
  cover: { width: 44, height: 44, borderRadius: 6, marginRight: 12, objectFit: 'cover', flexShrink: 0 },
  coverEmpty: {
    width: 44, height: 44, borderRadius: 6, marginRight: 12,
    background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0,
  },
  meta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  songTitle: { color: '#e0e0e0', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { color: '#666', fontSize: 12 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', color: '#555', fontSize: 16 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 },
  emptySub: { color: '#555', fontSize: 14, margin: 0 },
  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#141414', borderRadius: 20,
    padding: 28, width: 380, display: 'flex', flexDirection: 'column', gap: 12,
    border: '1px solid #222',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 800, margin: 0, textAlign: 'center' },
  coverEditBtn: {
    alignSelf: 'center', position: 'relative',
    cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
  },
  coverPreview: { width: 100, height: 100, borderRadius: 12, display: 'block', objectFit: 'cover' },
  coverOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(0,0,0,0.6)', padding: '5px 0',
    textAlign: 'center', color: '#fff', fontSize: 11, fontWeight: 700,
  },
  input: {
    background: '#1e1e1e', border: '1px solid #2a2a2a',
    borderRadius: 10, padding: 14, color: '#fff', fontSize: 15,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  modalActions: { display: 'flex', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, background: '#1e1e1e', border: 'none',
    borderRadius: 10, padding: 14, color: '#888', fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    flex: 1, background: '#1ed760', border: 'none',
    borderRadius: 10, padding: 14, color: '#000', fontWeight: 800, cursor: 'pointer',
  },
};