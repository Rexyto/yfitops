import React, { useState, useEffect } from 'react';
import useMusicStore from '../store/MusicStore';
import useSettingsStore from '../store/SettingsStore';
import { useT } from '../i18n';
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
  const { downloadedSongIds } = useSettingsStore();
  const t = useT();
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
    const interval = setInterval(fetchListeners, 30000);
    return () => clearInterval(interval);
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
          <h1 style={styles.title}>{t('songs.title')}</h1>
          <span style={styles.sub}>{t('songs.count', filtered.length)}</span>
        </div>
        <div style={styles.headerRight}>
          {activeListeners > 0 && (
            <div style={styles.listenersTag}>
              🎧 {activeListeners}
            </div>
          )}
          <button style={styles.syncBtn} onClick={handleSync} disabled={syncing}>
            <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {' ' + t('songs.sync')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchBox}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.searchInput}
          placeholder={t('songs.searchPlaceholder')}
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
          const isDownloaded = downloadedSongIds.includes(String(song.id));
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
                : <div style={styles.coverEmpty}><span style={{ color: 'var(--text-faint)' }}>♪</span></div>
              }
              <div style={styles.meta}>
                <span style={styles.titleRow}>
                  <span style={{ ...styles.songTitle, ...(isActive ? { color: '#1ed760' } : {}) }}>
                    {song.title}
                  </span>
                  {isDownloaded && <span style={styles.downloadedDot} title={t('songs.downloadedTooltip')}>⬇</span>}
                </span>
                <span style={styles.songArtist}>{song.artist} · {fmt(song.duration)}</span>
              </div>
              <button
                style={{ ...styles.iconBtn, ...(justQueued ? { color: '#1ed760' } : {}) }}
                onClick={e => handleAddToQueue(song, e)}
                title={t('songs.addToQueue')}
              >{justQueued ? '✓' : '+'}</button>
              <button
                style={styles.iconBtn}
                onClick={e => openEdit(song, e)}
                title={t('songs.edit')}
              >✎</button>
              <button
                style={styles.iconBtn}
                onClick={e => { e.stopPropagation(); toggleFavorite(song.id); }}
                title={t('songs.favorite')}
              >
                <span style={{ color: isFav ? '#1ed760' : 'var(--text-dim)', fontSize: 16 }}>
                  {isFav ? '♥' : '♡'}
                </span>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 48 }}>🎵</span>
            <p style={styles.emptyTitle}>{t('songs.empty')}</p>
            <p style={styles.emptySub}>{t('songs.emptyHint')}</p>
          </div>
        )}
      </div>

      {/* Modal editar */}
      {editSong && (
        <div style={styles.overlay} onClick={() => setEditSong(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>{t('songs.editModalTitle')}</h2>

            {/* Cover */}
            <label style={styles.coverEditBtn}>
              {editSong.coverUrl
                ? <img src={`${SERVER_URL}${editSong.coverUrl}`} style={styles.coverPreview} alt="" />
                : <div style={{ ...styles.coverPreview, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>♪</div>
              }
              <div style={styles.coverOverlay}>{t('songs.changeCover')}</div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
            </label>

            <input style={styles.input} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder={t('songs.fieldTitle')} />
            <input style={styles.input} value={editArtist} onChange={e => setEditArtist(e.target.value)} placeholder={t('songs.fieldArtist')} />
            <input style={styles.input} value={editAlbum} onChange={e => setEditAlbum(e.target.value)} placeholder={t('songs.fieldAlbum')} />

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setEditSong(null)}>{t('songs.cancel')}</button>
              <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? t('songs.saving') : t('songs.save')}
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
  title: { fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, margin: 0 },
  sub: { fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  listenersTag: {
    background: '#1ed76015', border: '1px solid #1ed76030',
    borderRadius: 20, padding: '6px 12px',
    color: '#1ed760', fontSize: 13, fontWeight: 700,
  },
  syncBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 20, padding: '8px 14px',
    color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  searchBox: {
    display: 'flex', alignItems: 'center',
    background: 'var(--bg3)', borderRadius: 10,
    margin: '0 28px 12px', padding: '0 14px',
    border: '1px solid var(--border-strong)',
  },
  searchIcon: { fontSize: 14, marginRight: 10, flexShrink: 0 },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: 15, padding: '12px 0',
  },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 16 },
  list: { paddingBottom: 20 },
  row: {
    display: 'flex', alignItems: 'center',
    padding: '9px 20px', margin: '1px 8px',
    borderRadius: 8, cursor: 'pointer',
    transition: 'background 0.1s',
  },
  rowActive: { background: 'var(--bg3)' },
  idx: { width: 28, color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', fontWeight: 600, flexShrink: 0 },
  cover: { width: 44, height: 44, borderRadius: 6, marginRight: 12, objectFit: 'cover', flexShrink: 0 },
  coverEmpty: {
    width: 44, height: 44, borderRadius: 6, marginRight: 12,
    background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0,
  },
  meta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  songTitle: { color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { color: 'var(--text-dim)', fontSize: 12 },
  downloadedDot: { color: '#1ed760', fontSize: 11, flexShrink: 0 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', color: 'var(--text-dim)', fontSize: 16 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { color: 'var(--text)', fontSize: 20, fontWeight: 700, margin: 0 },
  emptySub: { color: 'var(--text-dim)', fontSize: 14, margin: 0 },
  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--bg2)', borderRadius: 20,
    padding: 28, width: 380, display: 'flex', flexDirection: 'column', gap: 12,
    border: '1px solid var(--border)',
  },
  modalTitle: { color: 'var(--text)', fontSize: 20, fontWeight: 800, margin: 0, textAlign: 'center' },
  coverEditBtn: {
    alignSelf: 'center', position: 'relative',
    cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
  },
  coverPreview: { width: 100, height: 100, borderRadius: 12, display: 'block', objectFit: 'cover' },
  coverOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(0,0,0,0.6)', padding: '5px 0',
    textAlign: 'center', color: '#ffffff', fontSize: 11, fontWeight: 700,
  },
  input: {
    background: 'var(--bg4)', border: '1px solid var(--border-strong)',
    borderRadius: 10, padding: 14, color: 'var(--text)', fontSize: 15,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  modalActions: { display: 'flex', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, background: 'var(--bg4)', border: 'none',
    borderRadius: 10, padding: 14, color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    flex: 1, background: '#1ed760', border: 'none',
    borderRadius: 10, padding: 14, color: '#000', fontWeight: 800, cursor: 'pointer',
  },
};
