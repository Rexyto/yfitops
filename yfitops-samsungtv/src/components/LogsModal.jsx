import React, { useState } from 'react';
import { getLogs, clearLogs } from '../tv/logger';
import { useTvBack } from '../tv/backStack';
import { useT } from '../i18n';

const colorFor = (level) => (level === 'error' ? '#ff5555' : level === 'warn' ? '#e0b23c' : 'var(--text-secondary)');

export default function LogsModal({ onClose }) {
  const [logs, setLogs] = useState(() => getLogs());
  const t = useT();

  useTvBack(onClose);

  const handleClear = () => {
    clearLogs();
    setLogs([]);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{t('settings.logs.title')}</h2>
            <span style={styles.sub}>{t('settings.logs.count', logs.length)}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose} autoFocus>✕</button>
        </div>

        {logs.length > 0 && (
          <button style={styles.clearBtn} onClick={handleClear}>{t('settings.logs.clear')}</button>
        )}

        <div style={styles.list}>
          {logs.length === 0 && <p style={styles.empty}>{t('settings.logs.empty')}</p>}
          {logs.map((entry, i) => (
            <div key={i} style={styles.entry}>
              <span style={{ ...styles.level, color: colorFor(entry.level) }}>{entry.level.toUpperCase()}</span>
              <span style={styles.time}>{entry.time.slice(11, 19)}</span>
              <span style={styles.text}>{entry.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800,
  },
  modal: {
    width: 940, maxWidth: '92vw', height: '78vh',
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20,
    display: 'flex', flexDirection: 'column', padding: 26,
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: 'var(--text)', fontSize: 19, fontWeight: 800, margin: 0 },
  sub: { color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  closeBtn: {
    background: 'var(--bg3)', border: 'none', borderRadius: '50%',
    width: 32, height: 32, color: 'var(--text-muted)', fontSize: 15, cursor: 'pointer', flexShrink: 0,
  },
  clearBtn: {
    alignSelf: 'flex-start', marginBottom: 12,
    background: 'none', border: '1px solid var(--border-strong)', borderRadius: 8,
    padding: '7px 16px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  list: {
    flex: 1, overflowY: 'auto', background: 'var(--bg0)',
    border: '1px solid var(--border)', borderRadius: 12, padding: 14,
  },
  entry: {
    display: 'flex', gap: 12, padding: '5px 0',
    borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'baseline',
    fontFamily: 'monospace',
  },
  level: { fontWeight: 800, width: 50, flexShrink: 0 },
  time: { color: 'var(--text-faint)', width: 66, flexShrink: 0 },
  text: { color: 'var(--text-secondary)', wordBreak: 'break-word' },
  empty: { color: 'var(--text-dim)', textAlign: 'center', marginTop: 60, fontSize: 14 },
};
