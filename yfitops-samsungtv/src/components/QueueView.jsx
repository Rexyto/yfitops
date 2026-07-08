import React from 'react';
import useMusicStore from '../store/MusicStore';
import { SERVER_URL } from '../api';
import { useT } from '../i18n';
import { focusableProps } from '../tv/tvNavigation';
import { useTvBack } from '../tv/backStack';
import { fmtDuration as fmt } from '../tv/format';

export default function QueueView({ onClose }) {
  const { queue, removeFromQueue, moveQueueItem, clearQueue, playFromQueue, currentSong } = useMusicStore();
  const t = useT();

  // Atrás en el mando cierra este panel.
  useTvBack(onClose);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{t('queue.title')}</h2>
            <span style={styles.sub}>{t('queue.waiting', queue.length)}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose} title={t('queue.close')} autoFocus>✕</button>
        </div>

        {currentSong && (
          <div style={styles.nowPlaying}>
            <span style={styles.nowPlayingLabel}>{t('queue.nowPlayingLabel')}</span>
            <span style={styles.nowPlayingTitle}>{currentSong.title}</span>
          </div>
        )}

        {queue.length > 0 && (
          <button style={styles.clearBtn} onClick={clearQueue}>
            {t('queue.clear')}
          </button>
        )}

        <div style={styles.list}>
          {queue.map((song, index) => {
            const cover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;
            return (
              <div key={`${song.id}-${index}`} style={styles.row}>
                <span style={styles.idx}>{index + 1}</span>

                {cover
                  ? <img src={cover} style={styles.cover} alt="" />
                  : <div style={styles.coverEmpty}>♪</div>
                }

                <div {...focusableProps(() => playFromQueue(index))} style={styles.meta} title={t('queue.playNow')}>
                  <span style={styles.songTitle}>{song.title}</span>
                  <span style={styles.songArtist}>{song.artist} · {fmt(song.duration)}</span>
                </div>

                <div style={styles.actions}>
                  <button
                    style={styles.actionBtn}
                    disabled={index === 0}
                    onClick={() => moveQueueItem(index, index - 1)}
                    title={t('queue.moveUp')}
                  >↑</button>
                  <button
                    style={styles.actionBtn}
                    disabled={index === queue.length - 1}
                    onClick={() => moveQueueItem(index, index + 1)}
                    title={t('queue.moveDown')}
                  >↓</button>
                  <button
                    style={{ ...styles.actionBtn, color: '#ff5555' }}
                    onClick={() => removeFromQueue(index)}
                    title={t('queue.remove')}
                  >✕</button>
                </div>
              </div>
            );
          })}

          {queue.length === 0 && (
            <div style={styles.empty}>
              <span style={{ fontSize: 40 }}>🗒️</span>
              <p style={styles.emptyTitle}>{t('queue.empty')}</p>
              <p style={styles.emptySub}>{t('queue.emptyHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', justifyContent: 'flex-end', zIndex: 600,
  },
  panel: {
    width: 420, maxWidth: '90vw', height: '100%',
    background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', padding: '20px 0',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 20px 14px' },
  title: { color: 'var(--text)', fontSize: 18, fontWeight: 800, margin: 0 },
  sub: { color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  closeBtn: {
    background: 'var(--bg3)', border: 'none', borderRadius: '50%',
    width: 28, height: 28, color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nowPlaying: {
    margin: '0 20px 14px', padding: '10px 14px',
    background: '#1ed76015', border: '1px solid #1ed76030', borderRadius: 10,
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  nowPlayingLabel: { color: '#1ed760', fontSize: 10, fontWeight: 800, letterSpacing: 1 },
  nowPlayingTitle: { color: 'var(--text)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  clearBtn: {
    margin: '0 20px 12px', background: 'none', border: '1px solid var(--border-strong)',
    borderRadius: 8, padding: '7px 14px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', alignSelf: 'flex-start',
  },
  list: { flex: 1, overflowY: 'auto', padding: '0 8px 20px' },
  row: {
    display: 'flex', alignItems: 'center', padding: '8px 12px',
    margin: '1px 4px', borderRadius: 8, gap: 8,
  },
  idx: { width: 20, color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', flexShrink: 0, fontWeight: 600 },
  cover: { width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 },
  coverEmpty: {
    width: 40, height: 40, borderRadius: 6, background: 'var(--bg3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', flexShrink: 0,
  },
  meta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, cursor: 'pointer' },
  songTitle: { color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { color: 'var(--text-dim)', fontSize: 12 },
  actions: { display: 'flex', gap: 2, flexShrink: 0 },
  actionBtn: {
    background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13,
    cursor: 'pointer', padding: '4px 6px', borderRadius: 4,
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 70, gap: 4 },
  emptyTitle: { color: 'var(--text)', fontWeight: 700, margin: '10px 0 0', fontSize: 15 },
  emptySub: { color: 'var(--text-dim)', fontSize: 13, margin: 0, textAlign: 'center', padding: '0 24px' },
};
