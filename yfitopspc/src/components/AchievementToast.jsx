import React, { useEffect } from 'react';
import useMusicStore from '../store/MusicStore';
import { useT } from '../i18n';

const AUTO_DISMISS_MS = 6000;

// Apila los logros recién desbloqueados (llegan por la cola
// `achievementToasts` del store) y los va quitando solo tras unos
// segundos. El contenido (icono/título/descripción) viene tal cual del
// servidor: no está hardcodeado ni traducido en el cliente, ya que un
// admin puede crear logros nuevos desde el panel web en cualquier momento.
export default function AchievementToast() {
  const { achievementToasts, dismissAchievementToast } = useMusicStore();
  const t = useT();

  useEffect(() => {
    if (achievementToasts.length === 0) return;
    const timers = achievementToasts.map(toast =>
      setTimeout(() => dismissAchievementToast(toast._toastId), AUTO_DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [achievementToasts]);

  if (achievementToasts.length === 0) return null;

  return (
    <div style={styles.stack}>
      {achievementToasts.map(toast => (
        <div key={toast._toastId} style={styles.toast} onClick={() => dismissAchievementToast(toast._toastId)}>
          <span style={styles.icon}>{toast.icon || '🏆'}</span>
          <div style={styles.body}>
            <span style={styles.label}>{t('profile.toast.unlocked')}</span>
            <span style={styles.title}>{toast.title}</span>
            {toast.description && <span style={styles.desc}>{toast.description}</span>}
          </div>
        </div>
      ))}
      <style>{`
        @keyframes achToastIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  stack: {
    position: 'fixed', top: 44, right: 20, zIndex: 2000,
    display: 'flex', flexDirection: 'column', gap: 10, width: 300, maxWidth: '90vw',
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    background: 'var(--bg2)', border: '1px solid #1ed76050', borderRadius: 14,
    padding: '14px 16px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
    animation: 'achToastIn 0.3s ease-out',
    cursor: 'pointer', pointerEvents: 'auto',
  },
  icon: { fontSize: 26, flexShrink: 0, lineHeight: 1 },
  body: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  label: { color: '#1ed760', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { color: 'var(--text)', fontSize: 14, fontWeight: 800 },
  desc: { color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.4 },
};
