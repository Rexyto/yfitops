 
import React from 'react';
import useMusicStore from '../store/MusicStore';
import { SERVER_URL } from '../api';

const fmt = (s) => {
  if (!s || s < 1) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function FavoritesView() {
  const { songs, favorites, playSong, toggleFavorite, currentSong, playShuffle } = useMusicStore();
  const favSongs = songs.filter(s => favorites.includes(s.id));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Favoritos</h1>
          <span style={styles.sub}>{favSongs.length} canciones</span>
        </div>
        {favSongs.length > 0 && (
          <div style={styles.headerActions}>
            <button style={styles.shuffleBtn} onClick={() => playShuffle(favSongs)}>
              🔀 Aleatorio
            </button>
            <button style={styles.playBtn} onClick={() => playSong(favSongs[0], favSongs)}>
              ▶ Play
            </button>
          </div>
        )}
      </div>

      <div style={styles.list}>
        {favSongs.map((song, index) => {
          const isActive = currentSong?.id === song.id;
          const cover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;
          return (
            <div
              key={song.id}
              style={{ ...styles.row, ...(isActive ? styles.rowActive : {}) }}
              onClick={() => playSong(song, favSongs)}
            >
              <span style={{ ...styles.idx, ...(isActive ? { color: '#1ed760' } : {}) }}>
                {isActive ? '▶' : index + 1}
              </span>
              {cover
                ? <img src={cover} style={styles.cover} alt="" />
                : <div style={styles.coverEmpty}>♪</div>
              }
              <div style={styles.meta}>
                <span style={{ ...styles.songTitle, ...(isActive ? { color: '#1ed760' } : {}) }}>
                  {song.title}
                </span>
                <span style={styles.songArtist}>{song.artist} · {fmt(song.duration)}</span>
              </div>
              <button
                style={styles.favBtn}
                onClick={e => { e.stopPropagation(); toggleFavorite(song.id); }}
              >
                <span style={{ color: '#1ed760', fontSize: 18 }}>♥</span>
              </button>
            </div>
          );
        })}

        {favSongs.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 56 }}>🤍</span>
            <p style={styles.emptyTitle}>Sin favoritos</p>
            <p style={styles.emptySub}>Dale a ♥ en cualquier canción para añadirla aquí</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '0 0 20px 0' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '28px 28px 16px' },
  title: { fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5, margin: 0 },
  sub: { fontSize: 12, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center' },
  shuffleBtn: {
    background: 'none', border: '1px solid #1ed76055',
    borderRadius: 20, padding: '8px 16px',
    color: '#1ed760', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  playBtn: {
    background: '#1ed760', border: 'none',
    borderRadius: 20, padding: '8px 18px',
    color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer',
  },
  list: {},
  row: {
    display: 'flex', alignItems: 'center',
    padding: '9px 20px', margin: '1px 8px',
    borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s',
  },
  rowActive: { background: '#1a1a1a' },
  idx: { width: 28, color: '#555', fontSize: 13, textAlign: 'center', fontWeight: 600, flexShrink: 0 },
  cover: { width: 44, height: 44, borderRadius: 6, marginRight: 12, objectFit: 'cover', flexShrink: 0 },
  coverEmpty: {
    width: 44, height: 44, borderRadius: 6, marginRight: 12,
    background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: '#333', flexShrink: 0,
  },
  meta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  songTitle: { color: '#e0e0e0', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { color: '#666', fontSize: 12 },
  favBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 },
  emptySub: { color: '#555', fontSize: 14, margin: 0, textAlign: 'center' },
};