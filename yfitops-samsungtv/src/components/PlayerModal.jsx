import React, { useRef } from 'react';
import useMusicStore from '../store/MusicStore';
import { SERVER_URL } from '../api';
import { useT } from '../i18n';
import { useTvBack } from '../tv/backStack';
import { fmtMs as fmt } from '../tv/format';

export default function PlayerModal({ onClose }) {
  const {
    currentSong, isPlaying, position, duration, isLooping,
    pauseSong, resumeSong, playNext, playPrevious,
    seekTo, toggleLoop, toggleFavorite, favorites,
    uploadCover,
  } = useMusicStore();

  const fileRef = useRef();
  const t = useT();

  // Atrás en el mando cierra este modal.
  useTvBack(onClose);

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
          <span style={styles.headerLabel}>{t('player.nowPlaying')}</span>
          <div style={{ width: 52 }} />
        </div>

        {/* Cover */}
        <div style={styles.coverWrap}>
          {cover
            ? <img src={cover} style={styles.cover} alt="" />
            : <div style={styles.coverEmpty}><span style={{ fontSize: 110, color: 'var(--border-strong)' }}>♫</span></div>
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
            <span style={{ color: isFav ? '#1ed760' : 'var(--text-faint)', fontSize: 34 }}>
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
            title={t('player.repeat')}
          >
            <span style={{ fontSize: 24, color: isLooping ? '#000' : 'var(--text-dim)' }}>🔁</span>
          </button>

          <button style={styles.skipBtn} onClick={playPrevious}>⏮</button>

          <button style={styles.playBtn} onClick={isPlaying ? pauseSong : resumeSong} autoFocus>
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button style={styles.skipBtn} onClick={playNext}>⏭</button>

          {/* Placeholder para simetría */}
          <div style={{ width: 60 }} />
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
    background: 'var(--bg0)', borderRadius: 26,
    width: 600, maxWidth: '95vw',
    padding: '28px 36px 40px',
    border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  closeBtn: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'var(--bg3)', border: 'none', cursor: 'pointer',
    color: 'var(--text)', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerLabel: { color: 'var(--text-faint)', fontSize: 14, fontWeight: 700, letterSpacing: 1.5 },

  coverWrap: {
    borderRadius: 20, overflow: 'hidden',
    // Alto FIJO en vez de "aspect-ratio: 1" (no soportado hasta Chrome 88,
    // muy por encima de lo que trae una Tizen 4.x) — 600px de modal menos
    // 36px de padding a cada lado = 528px de ancho útil, así que el alto
    // se fija igual para que la portada sea siempre cuadrada.
    width: 528, height: 528, background: 'var(--bg2)',
    position: 'relative', marginBottom: 30,
    boxShadow: '0 8px 40px rgba(30,215,96,0.1)',
  },
  cover: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  coverEmpty: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  editCoverBtn: {
    position: 'absolute', bottom: 14, right: 14,
    background: 'rgba(0,0,0,0.7)', border: 'none',
    borderRadius: '50%', width: 48, height: 48,
    cursor: 'pointer', fontSize: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  infoRow: { display: 'flex', alignItems: 'center', marginBottom: 22 },
  songTitle: { fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { fontSize: 19, color: 'var(--text-dim)', margin: 0 },
  favBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 10, flexShrink: 0 },

  seekWrap: { marginBottom: 30 },
  seekTrack: {
    height: 6, background: 'var(--bg4)', borderRadius: 3,
    position: 'relative', cursor: 'pointer', marginBottom: 12,
  },
  seekFill: { height: '100%', background: '#1ed760', borderRadius: 3 },
  seekThumb: {
    position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
    width: 18, height: 18, borderRadius: '50%', background: 'var(--text)',
  },
  timeRow: { display: 'flex', justifyContent: 'space-between' },
  time: { fontSize: 15, color: 'var(--text-faint)', fontWeight: 500 },

  controls: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  sideBtn: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sideBtnActive: { background: '#1ed760' },
  skipBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: 34, width: 64, height: 64,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 92, height: 92, borderRadius: '50%',
    background: '#1ed760', border: 'none', cursor: 'pointer',
    color: '#000', fontSize: 38, fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(30,215,96,0.4)',
  },
};
