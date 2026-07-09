import React, { useState } from 'react';
import useMusicStore from '../store/MusicStore';
import { useT } from '../i18n';
import { SERVER_URL } from '../api';
import { focusableProps } from '../tv/tvNavigation';
import { useTvBack } from '../tv/backStack';
import { fmtDuration as fmt, fmtTotalDuration as fmtTotal } from '../tv/format';

// Ancho/alto fijo de tarjeta (se usa tanto en el layout como en la portada).
const CARD_WIDTH = 300;

// ── Tarjeta de playlist ─────────────────────────────────────
// IMPORTANTE — dos cosas a propósito, por compatibilidad con la TV real:
//  1) El contenedor de la rejilla es un FLEXBOX con "flex-wrap", NO un
//     CSS Grid. El navegador de una Tizen 4.x es un Chromium ~56, y el
//     soporte de "display: grid" en Chromium llegó en la versión 57 —
//     justo la siguiente. En la TV de verdad, un grid así puede caer a
//     bloque normal y las tarjetas se apilan una debajo de otra (aunque
//     en un navegador de PC moderno se vea perfecto). Flexbox lleva
//     soportado desde mucho antes, así que es la opción segura aquí.
//  2) La portada usa un alto FIJO en vez de "aspect-ratio: 1" — esa
//     propiedad tampoco existe hasta Chrome 88, muy por encima de lo que
//     trae la TV. Con ancho y alto fijos la portada es cuadrada siempre,
//     sin depender de ninguna propiedad CSS moderna.
function PlaylistCard({ playlist, type, onClick }) {
  const color = playlist.coverColor || '#1DB954';
  const cover = playlist.coverUrl ? `${SERVER_URL}${playlist.coverUrl}` : null;
  const count = playlist.songs?.length ?? 0;
  const t = useT();

  return (
    <div {...focusableProps(onClick)} style={styles.card}>
      <div style={{ ...styles.cardCover, background: cover ? undefined : color + '22', border: `1px solid ${color}33` }}>
        {cover
          ? <img src={cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <span style={{ fontSize: 64, color }}>🎶</span>
        }
      </div>
      <div style={styles.cardInfo}>
        <span style={styles.cardName}>{playlist.name}</span>
        <span style={styles.cardMeta}>
          {type === 'folder'
            ? t('playlists.songCountAndDuration', count, fmtTotal(playlist.totalDuration))
            : t('playlists.songCount', count)
          }
        </span>
      </div>
      {type === 'manual' && <div style={{ ...styles.cardAccent, background: color }} />}
    </div>
  );
}

// ── Vista detalle de playlist ────────────────────────────────
function PlaylistDetail({ playlist, songs, onBack }) {
  const { playSong, playShuffle, toggleFavorite, favorites, addToQueue, addManyToQueue, currentSong } = useMusicStore();
  const t = useT();
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [queuedId, setQueuedId] = useState(null);

  // Atrás en el mando vuelve a la lista de colecciones.
  useTvBack(onBack);

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
          : <div style={{ ...styles.heroCover, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 110 }}>🎶</div>
        }
        <div style={styles.heroOverlay}>
          <button style={styles.backBtn} onClick={onBack} autoFocus>{t('playlists.back')}</button>
          <div style={styles.heroInfo}>
            <h2 style={styles.heroTitle}>{playlist.name}</h2>
            <span style={styles.heroMeta}>
              {t('playlists.songCount', filtered.length)}
              {playlist.totalDuration ? ` · ${fmtTotal(playlist.totalDuration)}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div style={styles.actionRow}>
        <button style={{ ...styles.shuffleBtn, borderColor: color + '66', color }} onClick={() => playShuffle(allSongs)}>
          {t('playlists.shuffle')}
        </button>
        <button style={{ ...styles.playAllBtn, background: color }} onClick={() => allSongs.length > 0 && playSong(allSongs[0], allSongs)}>
          {t('playlists.play')}
        </button>
        <button
          style={styles.queueAllBtn}
          onClick={() => addManyToQueue(allSongs)}
        >
          {t('playlists.addQueue')}
        </button>
        <button
          style={{ ...styles.searchToggleBtn, background: searchVisible ? color + '22' : 'transparent', borderColor: color + '44' }}
          onClick={() => { setSearchVisible(v => !v); setSearch(''); }}
          title={t('playlists.search')}
        >
          🔍
        </button>
      </div>

      {/* Barra de búsqueda */}
      {searchVisible && (
        <div style={styles.searchBox}>
          <span style={{ fontSize: 20, marginRight: 14 }}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder={t('playlists.searchPlaceholder')}
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
          const isActive = currentSong?.id === song.id;
          const isFav = favorites.includes(song.id);
          const songCover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;
          const justQueued = queuedId === song.id;

          return (
            <div
              key={song.id || index}
              {...focusableProps(() => playSong(song, filtered.length > 0 ? filtered : allSongs))}
              style={{ ...styles.songRow, ...(isActive ? styles.songRowActive : {}) }}
            >
              <span style={{ ...styles.idx, ...(isActive ? { color } : {}) }}>
                {isActive ? '▶' : index + 1}
              </span>
              {songCover
                ? <img src={songCover} style={styles.songCover} alt="" />
                : <div style={styles.songCoverEmpty}>♪</div>
              }
              <div style={styles.songMeta}>
                <span style={styles.titleRow}>
                  <span style={{ ...styles.songTitle, ...(isActive ? { color } : {}) }}>{song.title}</span>
                </span>
                <span style={styles.songArtist}>{song.artist} · {fmt(song.duration)}</span>
              </div>
              <button
                style={styles.favBtn}
                onClick={e => handleAddToQueue(song, e)}
                title={t('playlists.addQueue')}
              >
                <span style={{ color: justQueued ? '#1ed760' : 'var(--text-dim)', fontSize: 26 }}>
                  {justQueued ? '✓' : '+'}
                </span>
              </button>
              <button
                style={styles.favBtn}
                onClick={e => { e.stopPropagation(); toggleFavorite(song.id); }}
              >
                <span style={{ color: isFav ? '#1ed760' : 'var(--text-dim)', fontSize: 26 }}>{isFav ? '♥' : '♡'}</span>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 56 }}>{search ? '🔍' : '📭'}</span>
            <p style={{ color: 'var(--text)', fontWeight: 700, margin: '16px 0 4px', fontSize: 21 }}>
              {search ? t('playlists.noResults') : t('playlists.emptyList')}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 17 }}>
              {search ? t('playlists.noResultsHint', search) : t('playlists.emptyListHint')}
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
  const t = useT();
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
        <h1 style={styles.title}>{t('playlists.title')}</h1>
        <span style={styles.sub}>{t('playlists.count', playlists.length + folderPlaylists.length)}</span>
      </div>

      {folderPlaylists.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>{t('playlists.fromFolders')}</h3>
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
          <h3 style={styles.sectionTitle}>{t('playlists.mine')}</h3>
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
          <span style={{ fontSize: 72 }}>🎶</span>
          <p style={{ color: 'var(--text)', fontSize: 26, fontWeight: 700, margin: '22px 0 8px' }}>{t('playlists.emptyOverall')}</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 17 }}>{t('playlists.emptyOverallHint')}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '0 0 48px 0' },
  header: { padding: '36px 36px 10px' },
  title: { fontSize: 40, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, margin: '0 0 6px' },
  sub: { fontSize: 16, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  section: { padding: '0 32px', marginBottom: 12 },
  sectionTitle: { color: 'var(--text-dim)', fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '28px 0 18px' },
  // Flexbox con salto de línea: las tarjetas se colocan de izquierda a
  // derecha, ocupando todo el ancho disponible, y cuando no cabe una más
  // en la fila, pasa a la siguiente — SIN estirarse nunca (ancho fijo en
  // la tarjeta) y sin depender de "display: grid".
  grid: { display: 'flex', flexWrap: 'wrap', gap: 28 },

  card: {
    width: CARD_WIDTH,
    background: 'var(--bg3)', borderRadius: 20,
    overflow: 'hidden', cursor: 'pointer',
    border: '1px solid var(--border-strong)', transition: 'transform 0.15s, background 0.15s',
    position: 'relative', flexShrink: 0,
  },
  // Portada cuadrada con ANCHO Y ALTO FIJOS (nada de aspect-ratio).
  cardCover: { width: CARD_WIDTH, height: CARD_WIDTH, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  cardInfo: { padding: '18px 20px' },
  cardName: { display: 'block', color: 'var(--text)', fontSize: 19, fontWeight: 700, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardMeta: { color: 'var(--text-muted)', fontSize: 15 },
  cardAccent: { height: 5 },

  // Detail
  detailContainer: { display: 'flex', flexDirection: 'column' },
  hero: { position: 'relative', height: 360, overflow: 'hidden', flexShrink: 0 },
  heroCover: { width: '100%', height: '100%', objectFit: 'cover' },
  heroOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: 36,
  },
  backBtn: {
    alignSelf: 'flex-start', background: 'rgba(0,0,0,0.5)',
    border: 'none', borderRadius: 30, padding: '13px 24px',
    color: '#1ed760', fontSize: 18, fontWeight: 700, cursor: 'pointer',
  },
  heroInfo: {},
  heroTitle: { color: '#ffffff', fontSize: 38, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.5, textShadow: '0 1px 4px rgba(0,0,0,0.4)' },
  heroMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 18 },

  actionRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '24px 36px 12px', flexWrap: 'wrap' },
  shuffleBtn: {
    background: 'none', borderRadius: 30, padding: '15px 24px',
    fontSize: 17, fontWeight: 700, cursor: 'pointer', border: '1px solid',
  },
  playAllBtn: {
    border: 'none', borderRadius: 30, padding: '15px 28px',
    color: '#000', fontSize: 17, fontWeight: 800, cursor: 'pointer',
  },
  queueAllBtn: {
    background: 'none', border: '1px solid var(--border-strong)', borderRadius: 30,
    padding: '15px 24px', color: 'var(--text-muted)', fontSize: 17, fontWeight: 700, cursor: 'pointer',
  },
  searchToggleBtn: {
    border: '1px solid', borderRadius: 30, padding: '15px 20px',
    fontSize: 19, cursor: 'pointer', color: 'var(--text)',
  },

  searchBox: {
    display: 'flex', alignItems: 'center',
    background: 'var(--bg4)', borderRadius: 14,
    margin: '8px 36px', padding: '0 20px',
    border: '1px solid var(--border-strong)',
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: 19, padding: '18px 0',
  },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 19 },

  songList: { paddingBottom: 56, paddingTop: 8 },
  songRow: {
    display: 'flex', alignItems: 'center',
    padding: '18px 32px', margin: '3px 14px',
    borderRadius: 14, cursor: 'pointer', transition: 'background 0.1s',
  },
  songRowActive: { background: 'var(--bg3)' },
  idx: { width: 46, color: 'var(--text-dim)', fontSize: 18, textAlign: 'center', fontWeight: 600, flexShrink: 0 },
  songCover: { width: 72, height: 72, borderRadius: 10, marginRight: 20, objectFit: 'cover', flexShrink: 0 },
  songCoverEmpty: {
    width: 72, height: 72, borderRadius: 10, marginRight: 20,
    background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, color: 'var(--text-faint)', flexShrink: 0,
  },
  songMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  songTitle: { color: 'var(--text-secondary)', fontSize: 21, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { color: 'var(--text-dim)', fontSize: 17 },
  favBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px' },

  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 110 },
};
