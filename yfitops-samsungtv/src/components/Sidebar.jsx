import React from 'react';
import useMusicStore from '../store/MusicStore';
import useSettingsStore from '../store/SettingsStore';
import { useT } from '../i18n';
import logo from '../../public/logo.png';

const TAB_KEYS = [
  { key: 'songs',     labelKey: 'nav.songs',     icon: '⊞' },
  { key: 'favorites', labelKey: 'nav.favorites', icon: '♥' },
  { key: 'playlists', labelKey: 'nav.playlists', icon: '☰' },
  { key: 'settings',  labelKey: 'nav.settings',  icon: '⚙' },
];

export default function Sidebar({ tab, setTab }) {
  const { username, logout, activeListeners } = useMusicStore();
  const { profilePicture, isOnline } = useSettingsStore();
  const t = useT();

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <img src={logo} style={styles.logoImg} alt="YFitops" />
        <span style={styles.logoText}>YFitops</span>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {TAB_KEYS.map(tabDef => (
          <button
            key={tabDef.key}
            style={{ ...styles.navItem, ...(tab === tabDef.key ? styles.navItemActive : {}) }}
            onClick={() => setTab(tabDef.key)}
          >
            <span style={styles.navIcon}>{tabDef.icon}</span>
            <span>{t(tabDef.labelKey)}</span>
            {tab === tabDef.key && <div style={styles.activeDot} />}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div style={styles.bottom}>
        {!isOnline && (
          <div style={styles.offline}>
            <span style={styles.offlineText}>{t('sidebar.offline')}</span>
          </div>
        )}
        {activeListeners > 0 && (
          <div style={styles.listeners}>
            <span>🎧</span>
            <span style={styles.listenersText}>{t('sidebar.listening', activeListeners)}</span>
          </div>
        )}
        <div style={styles.userRow}>
          {profilePicture
            ? <img src={profilePicture} style={styles.avatarImg} alt="" />
            : <div style={styles.avatar}>{username?.[0]?.toUpperCase() || '?'}</div>
          }
          <span style={styles.userName}>{username || 'Usuario'}</span>
          <button style={styles.logoutBtn} onClick={logout} title={t('sidebar.logout')}>⏏</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 220, background: 'var(--bg1)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', padding: '0 0 16px 0',
    flexShrink: 0, paddingTop: 32,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 24px 20px' },
  logoImg: { width: 32, height: 32, borderRadius: 8, objectFit: 'cover' },
  logoText: { fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px', borderRadius: 8,
    background: 'none', border: 'none', color: 'var(--text-dim)',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    width: '100%', textAlign: 'left', position: 'relative',
  },
  navItemActive: { background: 'var(--bg3)', color: 'var(--text)' },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  activeDot: {
    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
    width: 3, height: 20, background: '#1ed760', borderRadius: 2,
  },
  bottom: { marginTop: 'auto', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  offline: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#ff555515', border: '1px solid #ff555540',
    borderRadius: 8, padding: '8px 12px',
  },
  offlineText: { color: '#ff8080', fontSize: 12, fontWeight: 700 },
  listeners: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#1ed76015', border: '1px solid #1ed76030',
    borderRadius: 8, padding: '8px 12px',
  },
  listenersText: { color: '#1ed760', fontSize: 12, fontWeight: 700 },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px',
  },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: '#1ed76033', border: '1px solid #1ed76055',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1ed760', fontWeight: 800, fontSize: 13, flexShrink: 0,
  },
  avatarImg: {
    width: 30, height: 30, borderRadius: '50%', objectFit: 'cover',
    border: '1px solid #1ed76055', flexShrink: 0,
  },
  userName: { flex: 1, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18, padding: 0, flexShrink: 0, lineHeight: 1 },
};
