import React, { useState } from 'react';
import useMusicStore from '../store/MusicStore';
import useSettingsStore from '../store/SettingsStore';
import { useT } from '../i18n';
import { SERVER_URL } from '../api';

const fmt = (s) => {
  if (!s || s < 1) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function FavoritesView() {
  const { songs, favorites, playSong, toggleFavorite, currentSong, playShuffle, addToQueue, addManyToQueue } = useMusicStore();
  const { downloadedSongIds } = useSettingsStore();
  const t = useT();
  const favSongs = songs.filter(s => favorites.includes(s.id));
  const [queuedId, setQueuedId] = useState(null);

  const handleAddToQueue = (song, e) => {
    e.stopPropagation();
    addToQueue(song);
    setQueuedId(song.id);
    setTimeout(() => setQueuedId(null), 900);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('favorites.title')}</h1>
          <span style={styles.sub}>{t('favorites.count', favSongs.length)}</span>
        </div>
        {favSongs.length > 0 && (
          <div style={styles.headerActions}>
            <button style={styles.queueAllBtn} onClick={() => addManyToQueue(favSongs)}>
              {t('favorites.addAllToQueue')}
            </button>
            <button style={styles.shuffleBtn} onClick={() => playShuffle(favSongs)}>
              {t('favorites.shuffle')}
            </button>
            <button style={styles.playBtn} onClick={() => playSong(favSongs[0], favSongs)}>
              {t('favorites.play')}
            </button>
          </div>
        )}
      </div>

      <div style={styles.list}>
        {favSongs.map((song, index) => {
          const isActive = currentSong?.id === song.id;
          const isDownloaded = downloadedSongIds.includes(String(song.id));
          const cover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;
          const justQueued = queuedId === song.id;
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
                <span style={styles.titleRow}>
                  <span style={{ ...styles.songTitle, ...(isActive ? { color: '#1ed760' } : {}) }}>
                    {song.title}
                  </span>
                  {isDownloaded && <span style={styles.downloadedDot} title={t('songs.downloadedTooltip')}>⬇</span>}
                </span>
                <span style={styles.songArtist}>{song.artist} · {fmt(song.duration)}</span>
              </div>
              <button
                style={{ ...styles.favBtn, ...(justQueued ? { color: '#1ed760' } : {}) }}
                onClick={e => handleAddToQueue(song, e)}
                title={t('favorites.addToQueue')}
              >
                <span style={{ color: justQueued ? '#1ed760' : 'var(--text-dim)', fontSize: 18 }}>
                  {justQueued ? '✓' : '+'}
                </span>
              </button>
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
            <p style={styles.emptyTitle}>{t('favorites.empty')}</p>
            <p style={styles.emptySub}>{t('favorites.emptyHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '0 0 20px 0' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '28px 28px 16px' },
  title: { fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, margin: 0 },
  sub: { fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  queueAllBtn: {
    background: 'none', border: '1px solid var(--border-strong)',
    borderRadius: 20, padding: '8px 14px',
    color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
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
  rowActive: { background: 'var(--bg3)' },
  idx: { width: 28, color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', fontWeight: 600, flexShrink: 0 },
  cover: { width: 44, height: 44, borderRadius: 6, marginRight: 12, objectFit: 'cover', flexShrink: 0 },
  coverEmpty: {
    width: 44, height: 44, borderRadius: 6, marginRight: 12,
    background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: 'var(--text-faint)', flexShrink: 0,
  },
  meta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  songTitle: { color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { color: 'var(--text-dim)', fontSize: 12 },
  downloadedDot: { color: '#1ed760', fontSize: 11, flexShrink: 0 },
  favBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyTitle: { color: 'var(--text)', fontSize: 20, fontWeight: 700, margin: 0 },
  emptySub: { color: 'var(--text-dim)', fontSize: 14, margin: 0, textAlign: 'center' },
};
