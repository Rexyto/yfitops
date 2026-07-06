import React from 'react';
import useMusicStore from '../store/MusicStore';
import logo from '../../public/logo.png';

const TABS = [
  { key: 'songs',     label: 'Biblioteca',  icon: '⊞' },
  { key: 'favorites', label: 'Favoritos',   icon: '♥' },
  { key: 'playlists', label: 'Colecciones', icon: '☰' },
];

export default function Sidebar({ tab, setTab, version }) {
  const { username, logout, activeListeners } = useMusicStore();

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <img src={logo} style={styles.logoImg} alt="YFitops" />
        <span style={styles.logoText}>YFitops</span>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {TABS.map(t => (
          <button
            key={t.key}
            style={{ ...styles.navItem, ...(tab === t.key ? styles.navItemActive : {}) }}
            onClick={() => setTab(t.key)}
          >
            <span style={styles.navIcon}>{t.icon}</span>
            <span>{t.label}</span>
            {tab === t.key && <div style={styles.activeDot} />}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div style={styles.bottom}>
        {activeListeners > 0 && (
          <div style={styles.listeners}>
            <span>🎧</span>
            <span style={styles.listenersText}>{activeListeners} escuchando</span>
          </div>
        )}
        <div style={styles.versionRow}>Versión {version || '1.0.0'}</div>
        <div style={styles.userRow}>
          <div style={styles.avatar}>{username?.[0]?.toUpperCase() || '?'}</div>
          <span style={styles.userName}>{username || 'Usuario'}</span>
          <button style={styles.logoutBtn} onClick={logout} title="Cerrar sesión">⏏</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 220, background: '#0f0f0f', borderRight: '1px solid #1a1a1a',
    display: 'flex', flexDirection: 'column', padding: '0 0 16px 0',
    flexShrink: 0, paddingTop: 32,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 24px 20px' },
  logoImg: { width: 32, height: 32, borderRadius: 8, objectFit: 'cover' },
  logoText: { fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.5 },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px', borderRadius: 8,
    background: 'none', border: 'none', color: '#555',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    width: '100%', textAlign: 'left', position: 'relative',
  },
  navItemActive: { background: '#1a1a1a', color: '#fff' },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  activeDot: {
    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
    width: 3, height: 20, background: '#1ed760', borderRadius: 2,
  },
  bottom: { marginTop: 'auto', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  versionRow: { color: '#888', fontSize: 12, padding: '6px 10px', borderRadius: 8, background: '#141414', border: '1px solid #222', textAlign: 'center' },
  listeners: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#1ed76015', border: '1px solid #1ed76030',
    borderRadius: 8, padding: '8px 12px',
  },
  listenersText: { color: '#1ed760', fontSize: 12, fontWeight: 700 },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#1a1a1a', borderRadius: 10, padding: '10px 12px',
  },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: '#1ed76033', border: '1px solid #1ed76055',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1ed760', fontWeight: 800, fontSize: 13, flexShrink: 0,
  },
  userName: { flex: 1, color: '#ccc', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 18, padding: 0, flexShrink: 0, lineHeight: 1 },
};