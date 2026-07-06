import React, { useState } from 'react';
import useMusicStore from '../store/MusicStore';
import { SERVER_URL } from '../api';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fmt = (s) => {
  if (!s || s < 1) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const fmtTotal = (secs) => {
  if (!secs) return '0 min';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

const COLORS = ['#1DB954','#E91E63','#9C27B0','#2196F3','#FF5722','#FF9800','#009688','#607D8B'];

// ── Tarjeta de playlist ─────────────────────────────────────
function PlaylistCard({ playlist, type, onClick }) {
  const color = playlist.coverColor || '#1DB954';
  const cover = playlist.coverUrl ? `${SERVER_URL}${playlist.coverUrl}` : null;
  const count = playlist.songs?.length ?? 0;

  return (
    <div style={styles.card} onClick={onClick}>
      <div style={{ ...styles.cardCover, background: cover ? undefined : color + '22', border: `1px solid ${color}33` }}>
        {cover
          ? <img src={cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <span style={{ fontSize: 36, color }}>🎶</span>
        }
      </div>
      <div style={styles.cardInfo}>
        <span style={styles.cardName}>{playlist.name}</span>
        <span style={styles.cardMeta}>
          {type === 'folder'
            ? `${count} canciones · ${fmtTotal(playlist.totalDuration)}`
            : `${count} canciones`
          }
        </span>
      </div>
      {type === 'manual' && <div style={{ ...styles.cardAccent, background: color }} />}
    </div>
  );
}

// ── Vista detalle de playlist ────────────────────────────────
function PlaylistDetail({ playlist, songs, onBack }) {
  const { playSong, playShuffle, toggleFavorite, favorites, addToQueue, addManyToQueue } = useMusicStore();
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [queuedId, setQueuedId] = useState(null);

  const allSongs = songs;
  const filtered = search.trim()
    ? allSongs.filter(s =>
        s.title?.toLowerCase().includes(search.toLowerCase()) ||
        s.artist?.toLowerCase().includes(search.toLowerCase())
      )
    : allSongs;

  const color = playlist.coverColor || '#1ed760';
  const cover = playlist.coverUrl ? `${SERVER_URL}${playlist.coverUrl}` : null;

  const handleAddToQueue = (song, e) => {
    e.stopPropagation();
    addToQueue(song);
    setQueuedId(song.id);
    setTimeout(() => setQueuedId(null), 900);
  };

  return (
    <div style={styles.detailContainer}>
      {/* Hero */}
      <div style={styles.hero}>
        {cover
          ? <img src={cover} style={styles.heroCover} alt="" />
          : <div style={{ ...styles.heroCover, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>🎶</div>
        }
        <div style={styles.heroOverlay}>
          <button style={styles.backBtn} onClick={onBack}>← Volver</button>
          <div style={styles.heroInfo}>
            <h2 style={styles.heroTitle}>{playlist.name}</h2>
            <span style={styles.heroMeta}>{filtered.length} canciones{playlist.totalDuration ? ` · ${fmtTotal(playlist.totalDuration)}` : ''}</span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div style={styles.actionRow}>
        <button style={{ ...styles.shuffleBtn, borderColor: color + '66', color }} onClick={() => playShuffle(allSongs)}>
          🔀 Aleatorio
        </button>
        <button style={{ ...styles.playAllBtn, background: color }} onClick={() => allSongs.length > 0 && playSong(allSongs[0], allSongs)}>
          ▶ Play
        </button>
        <button
          style={styles.queueAllBtn}
          onClick={() => addManyToQueue(allSongs)}
          title="Agregar toda la lista a la cola"
        >
          + Cola
        </button>
        <button
          style={{ ...styles.searchToggleBtn, background: searchVisible ? color + '22' : 'transparent', borderColor: color + '44' }}
          onClick={() => { setSearchVisible(v => !v); setSearch(''); }}
          title="Buscar"
        >
          🔍
        </button>
      </div>

      {/* Barra de búsqueda */}
      {searchVisible && (
        <div style={styles.searchBox}>
          <span style={{ fontSize: 14, marginRight: 10 }}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Buscar en esta lista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && <button style={styles.clearBtn} onClick={() => setSearch('')}>✕</button>}
        </div>
      )}

      {/* Canciones */}
      <div style={styles.songList}>
        {filtered.map((song, index) => {
          const { currentSong } = useMusicStore.getState();
          const isActive = currentSong?.id === song.id;
          const isFav = favorites.includes(song.id);
          const songCover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;
          const justQueued = queuedId === song.id;

          return (
            <div
              key={song.id || index}
              style={{ ...styles.songRow, ...(isActive ? styles.songRowActive : {}) }}
              onClick={() => playSong(song, filtered.length > 0 ? filtered : allSongs)}
            >
              <span style={{ ...styles.idx, ...(isActive ? { color } : {}) }}>
                {isActive ? '▶' : index + 1}
              </span>
              {songCover
                ? <img src={songCover} style={styles.songCover} alt="" />
                : <div style={styles.songCoverEmpty}>♪</div>
              }
              <div style={styles.songMeta}>
                <span style={{ ...styles.songTitle, ...(isActive ? { color } : {}) }}>{song.title}</span>
                <span style={styles.songArtist}>{song.artist} · {fmt(song.duration)}</span>
              </div>
              <button
                style={styles.favBtn}
                onClick={e => handleAddToQueue(song, e)}
                title="Agregar a la cola"
              >
                <span style={{ color: justQueued ? '#1ed760' : '#555', fontSize: 16 }}>
                  {justQueued ? '✓' : '+'}
                </span>
              </button>
              <button
                style={styles.favBtn}
                onClick={e => { e.stopPropagation(); toggleFavorite(song.id); }}
              >
                <span style={{ color: isFav ? '#1ed760' : '#555', fontSize: 16 }}>{isFav ? '♥' : '♡'}</span>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 40 }}>{search ? '🔍' : '📭'}</span>
            <p style={{ color: '#fff', fontWeight: 700, margin: '10px 0 4px' }}>
              {search ? 'Sin resultados' : 'Lista vacía'}
            </p>
            <p style={{ color: '#555', fontSize: 14 }}>
              {search ? `No hay canciones con "${search}"` : 'Esta lista no tiene canciones'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────
export default function PlaylistsView() {
  const { playlists, folderPlaylists, songs } = useMusicStore();
  const [detail, setDetail] = useState(null); // { type, playlist }

  if (detail) {
    const resolvedSongs = detail.type === 'folder'
      ? (detail.playlist.songs || [])
      : songs.filter(s => detail.playlist.songs?.includes(s.id));

    return (
      <PlaylistDetail
        playlist={detail.playlist}
        songs={resolvedSongs}
        onBack={() => setDetail(null)}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Colecciones</h1>
        <span style={styles.sub}>{playlists.length + folderPlaylists.length} listas</span>
      </div>

      {folderPlaylists.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Desde carpetas</h3>
          <div style={styles.grid}>
            {folderPlaylists.map(pl => (
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                type="folder"
                onClick={() => setDetail({ type: 'folder', playlist: pl })}
              />
            ))}
          </div>
        </section>
      )}

      {playlists.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Mis colecciones</h3>
          <div style={styles.grid}>
            {playlists.map(pl => (
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                type="manual"
                onClick={() => setDetail({ type: 'manual', playlist: pl })}
              />
            ))}
          </div>
        </section>
      )}

      {playlists.length === 0 && folderPlaylists.length === 0 && (
        <div style={styles.empty}>
          <span style={{ fontSize: 56 }}>🎶</span>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '16px 0 8px' }}>Sin colecciones</p>
          <p style={{ color: '#555', fontSize: 14 }}>Las colecciones se crean desde la app móvil</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '0 0 40px 0' },
  header: { padding: '28px 28px 8px' },
  title: { fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5, margin: '0 0 4px' },
  sub: { fontSize: 12, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  section: { padding: '0 24px', marginBottom: 8 },
  sectionTitle: { color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 12px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 },

  card: {
    background: '#1a1a1a', borderRadius: 14,
    overflow: 'hidden', cursor: 'pointer',
    border: '1px solid #252525', transition: 'transform 0.15s, background 0.15s',
    position: 'relative',
  },
  cardCover: { height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardInfo: { padding: '12px 14px' },
  cardName: { display: 'block', color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardMeta: { color: '#888', fontSize: 12 },
  cardAccent: { height: 3 },

  // Detail
  detailContainer: { display: 'flex', flexDirection: 'column' },
  hero: { position: 'relative', height: 220, overflow: 'hidden', flexShrink: 0 },
  heroCover: { width: '100%', height: '100%', objectFit: 'cover' },
  heroOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: 20,
  },
  backBtn: {
    alignSelf: 'flex-start', background: 'rgba(0,0,0,0.5)',
    border: 'none', borderRadius: 20, padding: '6px 14px',
    color: '#1ed760', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  heroInfo: {},
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: 800, margin: '0 0 4px', letterSpacing: -0.5 },
  heroMeta: { color: '#aaa', fontSize: 13 },

  actionRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px 6px', flexWrap: 'wrap' },
  shuffleBtn: {
    background: 'none', borderRadius: 20, padding: '8px 16px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid',
  },
  playAllBtn: {
    border: 'none', borderRadius: 20, padding: '8px 20px',
    color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer',
  },
  queueAllBtn: {
    background: 'none', border: '1px solid #333', borderRadius: 20,
    padding: '8px 16px', color: '#aaa', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  searchToggleBtn: {
    border: '1px solid', borderRadius: 20, padding: '8px 12px',
    fontSize: 14, cursor: 'pointer', color: '#fff',
  },

  searchBox: {
    display: 'flex', alignItems: 'center',
    background: '#1e1e1e', borderRadius: 10,
    margin: '4px 20px', padding: '0 14px',
    border: '1px solid #2a2a2a',
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: '#fff', fontSize: 15, padding: '12px 0',
  },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14 },

  songList: { paddingBottom: 40 },
  songRow: {
    display: 'flex', alignItems: 'center',
    padding: '9px 20px', margin: '1px 8px',
    borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s',
  },
  songRowActive: { background: '#1a1a1a' },
  idx: { width: 28, color: '#555', fontSize: 13, textAlign: 'center', fontWeight: 600, flexShrink: 0 },
  songCover: { width: 44, height: 44, borderRadius: 6, marginRight: 12, objectFit: 'cover', flexShrink: 0 },
  songCoverEmpty: {
    width: 44, height: 44, borderRadius: 6, marginRight: 12,
    background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: '#333', flexShrink: 0,
  },
  songMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  songTitle: { color: '#e0e0e0', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { color: '#666', fontSize: 12 },
  favBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' },

  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 },
};