 
import React, { useRef } from 'react';
import useMusicStore from '../store/MusicStore';
import { SERVER_URL } from '../api';

const fmt = (ms) => {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

export default function PlayerModal({ onClose }) {
  const {
    currentSong, isPlaying, position, duration, isLooping,
    pauseSong, resumeSong, playNext, playPrevious,
    seekTo, setPosition, toggleLoop, toggleFavorite, favorites,
    uploadCover,
  } = useMusicStore();

  const fileRef = useRef();

  if (!currentSong) return null;

  const isFav = favorites.includes(currentSong.id);
  const cover = currentSong.coverUrl ? `${SERVER_URL}${currentSong.coverUrl}` : null;
  const progress = duration > 0 ? position / duration : 0;

  const handleSeekClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * duration);
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadCover(currentSong.id, file);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <button style={styles.closeBtn} onClick={onClose}>⌄</button>
          <span style={styles.headerLabel}>REPRODUCIENDO</span>
          <div style={{ width: 40 }} />
        </div>

        {/* Cover */}
        <div style={styles.coverWrap}>
          {cover
            ? <img src={cover} style={styles.cover} alt="" />
            : <div style={styles.coverEmpty}><span style={{ fontSize: 80, color: '#2a2a2a' }}>♫</span></div>
          }
          <button style={styles.editCoverBtn} onClick={() => fileRef.current?.click()}>📷</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
        </div>

        {/* Info + fav */}
        <div style={styles.infoRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={styles.songTitle}>{currentSong.title}</p>
            <p style={styles.songArtist}>{currentSong.artist}</p>
          </div>
          <button style={styles.favBtn} onClick={() => toggleFavorite(currentSong.id)}>
            <span style={{ color: isFav ? '#1ed760' : '#444', fontSize: 26 }}>
              {isFav ? '♥' : '♡'}
            </span>
          </button>
        </div>

        {/* Seekbar */}
        <div style={styles.seekWrap}>
          <div style={styles.seekTrack} onClick={handleSeekClick}>
            <div style={{ ...styles.seekFill, width: `${progress * 100}%` }} />
            <div style={{ ...styles.seekThumb, left: `${progress * 100}%` }} />
          </div>
          <div style={styles.timeRow}>
            <span style={styles.time}>{fmt(position)}</span>
            <span style={styles.time}>{fmt(duration)}</span>
          </div>
        </div>

        {/* Controles */}
        <div style={styles.controls}>
          {/* Loop */}
          <button
            style={{ ...styles.sideBtn, ...(isLooping ? styles.sideBtnActive : {}) }}
            onClick={toggleLoop}
            title="Repetir"
          >
            <span style={{ fontSize: 18, color: isLooping ? '#000' : '#555' }}>🔁</span>
          </button>

          <button style={styles.skipBtn} onClick={playPrevious}>⏮</button>

          <button style={styles.playBtn} onClick={isPlaying ? pauseSong : resumeSong}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button style={styles.skipBtn} onClick={playNext}>⏭</button>

          {/* Placeholder para simetría */}
          <div style={{ width: 44 }} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 500,
  },
  modal: {
    background: '#0a0a0a', borderRadius: 20,
    width: 420, maxWidth: '95vw',
    padding: '20px 28px 32px',
    border: '1px solid #1a1a1a',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  closeBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: '#1a1a1a', border: 'none', cursor: 'pointer',
    color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerLabel: { color: '#444', fontSize: 11, fontWeight: 700, letterSpacing: 1.5 },

  coverWrap: {
    borderRadius: 16, overflow: 'hidden',
    aspectRatio: '1', background: '#141414',
    position: 'relative', marginBottom: 24,
    boxShadow: '0 8px 40px rgba(30,215,96,0.1)',
  },
  cover: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  coverEmpty: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  editCoverBtn: {
    position: 'absolute', bottom: 10, right: 10,
    background: 'rgba(0,0,0,0.7)', border: 'none',
    borderRadius: '50%', width: 34, height: 34,
    cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  infoRow: { display: 'flex', alignItems: 'center', marginBottom: 16 },
  songTitle: { fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { fontSize: 15, color: '#666', margin: 0 },
  favBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexShrink: 0 },

  seekWrap: { marginBottom: 24 },
  seekTrack: {
    height: 4, background: '#2a2a2a', borderRadius: 2,
    position: 'relative', cursor: 'pointer', marginBottom: 8,
  },
  seekFill: { height: '100%', background: '#1ed760', borderRadius: 2 },
  seekThumb: {
    position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
    width: 12, height: 12, borderRadius: '50%', background: '#fff',
  },
  timeRow: { display: 'flex', justifyContent: 'space-between' },
  time: { fontSize: 12, color: '#444', fontWeight: 500 },

  controls: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sideBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sideBtnActive: { background: '#1ed760' },
  skipBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#ccc', fontSize: 26, width: 50, height: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#1ed760', border: 'none', cursor: 'pointer',
    color: '#000', fontSize: 30, fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(30,215,96,0.4)',
  },
};