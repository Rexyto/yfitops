import React, { useEffect } from 'react';
import useMusicStore from '../store/MusicStore';

const AUTO_DISMISS_MS = 7000;

// Aviso amistoso (estilo "vas muy rápido") que manda el servidor cuando un
// usuario se está acercando al límite de peticiones, ANTES de llegar a
// bloquearlo de verdad (ver lib/rateLimit.js -> warnAt). No corta nada, es
// solo un toast informativo para que la persona baje el ritmo.
export default function RateLimitWarningToast() {
  const { rateLimitWarning, dismissRateLimitWarning } = useMusicStore();

  useEffect(() => {
    if (!rateLimitWarning) return;
    const timer = setTimeout(() => dismissRateLimitWarning(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [rateLimitWarning]);

  if (!rateLimitWarning) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.toast} onClick={dismissRateLimitWarning}>
        <span style={styles.badge}>!</span>
        <span style={styles.message}>{rateLimitWarning.message}</span>
      </div>
      <style>{`
        @keyframes rateLimitToastIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)',
    zIndex: 2000, pointerEvents: 'none',
  },
  toast: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg2)', border: '1px solid #ff9f4355', borderRadius: 12,
    padding: '11px 16px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
    animation: 'rateLimitToastIn 0.25s ease-out',
    cursor: 'pointer', pointerEvents: 'auto', maxWidth: '80vw',
  },
  badge: {
    flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
    background: '#ff9f4322', color: '#ff9f43', fontWeight: 900, fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  message: { color: 'var(--text)', fontSize: 13, fontWeight: 600, lineHeight: 1.4 },
};