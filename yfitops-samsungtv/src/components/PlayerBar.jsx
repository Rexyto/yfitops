import React from 'react';
import useMusicStore from '../store/MusicStore';
import { SERVER_URL } from '../api';
import PlayerModal from './PlayerModal';
import QueueView from './QueueView';
import { useState } from 'react';
import { useT } from '../i18n';
import { focusableProps, useTvMediaKeys } from '../tv/tvNavigation';

const VolumeIcon = ({ volume }) => {
  if (volume === 0) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  );
  if (volume < 0.5) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
};

const QueueIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1ed760' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

export default function PlayerBar() {
  const {
    currentSong, isPlaying, position, duration,
    pauseSong, resumeSong, playNext, playPrevious,
    volume, setVolume, queue,
  } = useMusicStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const t = useT();

  // Botones ▶️⏸⏭⏮ del mando: funcionan desde cualquier pantalla, no solo
  // cuando el foco visual está sobre la barra del reproductor.
  useTvMediaKeys({
    onPlayPause: () => (isPlaying ? pauseSong() : resumeSong()),
    onNext: playNext,
    onPrevious: playPrevious,
  });

  if (!currentSong) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const cover = currentSong.coverUrl ? `${SERVER_URL}${currentSong.coverUrl}` : null;

  return (
    <>
      <div style={styles.bar}>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>

        <div style={styles.inner}>
          {/* Cover + info */}
          <div {...focusableProps(() => setModalOpen(true))} style={styles.left}>
            <div style={styles.coverWrap}>
              {cover
                ? <img src={cover} style={styles.cover} alt="" />
                : <div style={styles.coverEmpty}>♪</div>
              }
              {isPlaying && <div style={styles.playingRing} />}
            </div>
            <div style={styles.info}>
              <span style={styles.title}>{currentSong.title}</span>
              <span style={styles.artist}>{currentSong.artist}</span>
            </div>
            {isPlaying && (
              <div style={styles.equalizer}>
                <span className="eq-bar" style={{ animationDelay: '0s' }} />
                <span className="eq-bar" style={{ animationDelay: '0.25s' }} />
                <span className="eq-bar" style={{ animationDelay: '0.5s' }} />
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={styles.controls}>
            <button style={styles.btn} onClick={playPrevious}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <button style={styles.playBtn} onClick={isPlaying ? pauseSong : resumeSong}>
              {isPlaying
                ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>
            <button style={styles.btn} onClick={playNext}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z"/></svg>
            </button>
          </div>

          {/* Cola + Volumen */}
          <div style={styles.right}>
            <button
              style={{ ...styles.queueBtn, ...(queueOpen ? styles.queueBtnActive : {}) }}
              onClick={() => setQueueOpen(v => !v)}
              title={t('player.queue')}
            >
              <QueueIcon active={queueOpen} />
              {queue.length > 0 && <span style={styles.queueBadge}>{queue.length}</span>}
            </button>

            <div style={styles.volWrap}>
              <button
                style={styles.volBtn}
                onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
                title={t('player.mute')}
              >
                <VolumeIcon volume={volume} />
              </button>
              <div style={styles.volTrackWrap}>
                <div style={styles.volTrackBg} />
                <div style={{ ...styles.volTrackFill, width: `${volume * 100}%` }} />
                <input
                  type="range"
                  min={0} max={1} step={0.01}
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  className="vol-range"
                />
              </div>
              <span style={styles.volPct}>{Math.round(volume * 100)}</span>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && <PlayerModal onClose={() => setModalOpen(false)} />}
      {queueOpen && <QueueView onClose={() => setQueueOpen(false)} />}

      <style>{`
        @keyframes eq1 { 0%, 100% { height: 6px; } 50% { height: 20px; } }
        .eq-bar { display: inline-block; width: 4px; background: #1ed760; border-radius: 2px; animation: eq1 0.8s ease-in-out infinite; }
        .vol-range { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; width: 100%; height: 6px; position: absolute; inset: 0; margin: 0; z-index: 2; }
        .vol-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.5); transition: transform 0.15s, background 0.15s; }
        .vol-range:hover::-webkit-slider-thumb { transform: scale(1.3); background: #1ed760; }
        .vol-range::-webkit-slider-runnable-track { background: transparent; height: 6px; }
        .vol-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--text); border: none; cursor: pointer; }
        .vol-range::-moz-range-track { background: transparent; height: 6px; }
      `}</style>
    </>
  );
}

const styles = {
  bar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(to top, var(--playerbar-grad-1) 0%, var(--playerbar-grad-2) 100%)',
    borderTop: '1px solid var(--border)',
    zIndex: 100,
  },
  progressTrack: { height: 3, background: 'var(--bg4)' },
  progressFill: {
    height: 3,
    background: 'linear-gradient(90deg, #1ed760, #17a349)',
    transition: 'width 0.5s linear',
    boxShadow: '0 0 8px rgba(30,215,96,0.4)',
  },
  inner: { display: 'flex', alignItems: 'center', padding: '16px 32px', gap: 22 },
  left: { display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0, cursor: 'pointer' },
  coverWrap: { position: 'relative', flexShrink: 0 },
  cover: { width: 64, height: 64, borderRadius: 10, objectFit: 'cover', display: 'block' },
  coverEmpty: {
    width: 64, height: 64, borderRadius: 10,
    background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-faint)', fontSize: 24,
  },
  playingRing: {
    position: 'absolute', inset: -3, borderRadius: 13,
    border: '2px solid #1ed76060', pointerEvents: 'none',
  },
  info: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  title: { color: 'var(--text)', fontSize: 19, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  artist: { color: 'var(--text-dim)', fontSize: 16 },
  equalizer: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 22, marginLeft: 10, flexShrink: 0 },

  controls: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  btn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
    width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%',
  },
  playBtn: {
    background: '#1ed760', border: 'none', cursor: 'pointer', color: '#000',
    width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', boxShadow: '0 0 16px rgba(30,215,96,0.3)',
  },

  right: { flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 },

  queueBtn: {
    position: 'relative', background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: '50%', width: 52, height: 52, cursor: 'pointer',
    color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  queueBtnActive: { background: '#1ed76015', borderColor: '#1ed76050' },
  queueBadge: {
    position: 'absolute', top: -6, right: -6,
    background: '#1ed760', color: '#000', fontSize: 13, fontWeight: 800,
    borderRadius: 12, minWidth: 22, height: 22, padding: '0 5px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },

  volWrap: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 30, padding: '10px 20px',
  },
  volBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0,
  },
  volTrackWrap: { position: 'relative', width: 120, height: 6, display: 'flex', alignItems: 'center' },
  volTrackBg: { position: 'absolute', inset: 0, background: 'var(--border-strong)', borderRadius: 3 },
  volTrackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#1ed760', borderRadius: 3, pointerEvents: 'none', transition: 'width 0.05s' },
  volPct: { color: 'var(--text-dim)', fontSize: 14, fontWeight: 700, width: 32, textAlign: 'right', flexShrink: 0 },
};
