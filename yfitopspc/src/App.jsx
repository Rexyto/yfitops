import React, { useState, useEffect } from 'react';
import useMusicStore from './store/MusicStore';
import useSettingsStore from './store/SettingsStore';
import { useT } from './i18n';
import { pcVersion, pcChangelog, pcVerify } from './api';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import SongsView from './components/SongsView';
import FavoritesView from './components/FavoritesView';
import PlaylistsView from './components/PlaylistsView';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';
import PlayerBar from './components/PlayerBar';

// Barra de título custom (frameless window)
function TitleBar() {
  const t = useT();
  return (
    <div style={titleStyles.bar}>
      {/* Región draggable — ocupa todo el espacio */}
      <div style={titleStyles.drag} />
      {/* Botones de ventana */}
      <div style={titleStyles.controls}>
        <button style={titleStyles.btn} onClick={() => window.electronAPI?.minimize()} title={t('title.minimize')}>─</button>
        <button style={titleStyles.btn} onClick={() => window.electronAPI?.maximize()} title={t('title.maximize')}>□</button>
        <button style={{ ...titleStyles.btn, ...titleStyles.closeBtn }} onClick={() => window.electronAPI?.close()} title={t('title.close')}>✕</button>
      </div>
    </div>
  );
}

const titleStyles = {
  bar: {
    height: 32, background: 'var(--bg0)',
    display: 'flex', alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    // Sin -webkit-app-region aquí — lo ponemos solo en el área de drag
  },
  drag: {
    flex: 1, height: '100%',
    WebkitAppRegion: 'drag',   // ← solo esta zona arrastra la ventana
  },
  controls: {
    display: 'flex', alignItems: 'center',
    WebkitAppRegion: 'no-drag', // ← botones NO arrastran
  },
  btn: {
    width: 46, height: 32,
    background: 'none', border: 'none',
    color: 'var(--text-muted)', fontSize: 14,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.1s',
  },
  closeBtn: { color: 'var(--text)' },
};

// Aviso de "sin conexión" — aparece y desaparece solo, sin recargar nada
function OfflineBanner() {
  const t = useT();
  return (
    <div style={styles.offlineBanner}>
      {t('offline.banner')}
    </div>
  );
}

export default function App() {
  const { token, login, currentSong } = useMusicStore();
  const { isOnline } = useSettingsStore();
  const t = useT();
  const [tab, setTab] = useState('songs');
  const [checking, setChecking] = useState(true);
  const [appVersion, setAppVersion] = useState(null);
  const [serverVersion, setServerVersion] = useState(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogNotes, setChangelogNotes] = useState('');

  // Inicializar ajustes (tema, foto de perfil, descargas, conectividad)
  useEffect(() => {
    useSettingsStore.getState().init();
  }, []);

  // Al arrancar: recuperar sesión guardada en disco
  useEffect(() => {
    (async () => {
      try {
        const { token: saved, username: savedUser } = await window.electronAPI?.getSession() || {};
        const cleanSaved = typeof saved === 'string' ? saved.trim() : '';
        if (cleanSaved) {
          // Verificar que el token siga siendo válido con la API PC.
          try {
            const data = await pcVerify(cleanSaved);
            if (data?.valid) {
              await useMusicStore.getState().login(cleanSaved, data.username || savedUser || '');
            } else {
              await window.electronAPI?.clearSession();
            }
          } catch {
            await window.electronAPI?.clearSession();
          }
        }
      } catch {
        // Sin conexión: intentar entrar igual con lo que hay guardado
        const { token: saved, username: savedUser } = await window.electronAPI?.getSession().catch(() => ({})) || {};
        const cleanSaved = typeof saved === 'string' ? saved.trim() : '';
        if (cleanSaved) await useMusicStore.getState().login(cleanSaved, savedUser || '');
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    async function checkAppVersion() {
      const localVersion = await window.electronAPI?.getAppVersion().catch(() => null);
      if (localVersion) setAppVersion(localVersion);

      if (!token) return;

      try {
        const server = await pcVersion(token);
        if (!server?.version) return;

        setServerVersion(server.version);
        const currentLocalVersion = localVersion || (await window.electronAPI?.getAppVersion().catch(() => null));
        const isFirstRun = !localStorage.getItem('yfitops_first_run');

        if (isFirstRun) {
          localStorage.setItem('yfitops_first_run', '1');
        }

        // ❌ CAMBIO: No bloquear si versiones no coinciden, solo mostrar notificación
        // if (currentLocalVersion && server.version && currentLocalVersion !== server.version) {
        //   setShowUpdatePrompt(true);
        //   return;
        // }

        // ✅ Mostrar changelog solo en primera ejecución si versiones coinciden
        if (isFirstRun && currentLocalVersion && server.version && currentLocalVersion === server.version) {
          const changelog = await pcChangelog(token);
          if (changelog?.notes) {
            setChangelogNotes(changelog.notes);
            setShowChangelog(true);
          }
        }
      } catch {
        // No interrumpimos el arranque si falla la comprobación de versión.
      }
    }

    checkAppVersion();
  }, [token]);

  if (checking) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'var(--bg0)', display: 'flex', flexDirection: 'column' }}>
        <TitleBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t('app.loading')}</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'var(--bg0)', display: 'flex', flexDirection: 'column' }}>
        <TitleBar />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LoginScreen />
        </div>
      </div>
    );
  }

  const renderView = () => {
    if (tab === 'songs')     return <SongsView />;
    if (tab === 'favorites') return <FavoritesView />;
    if (tab === 'playlists') return <PlaylistsView />;
    if (tab === 'profile')   return <ProfileView />;
    if (tab === 'settings')  return <SettingsView appVersion={appVersion} />;
    return null;
  };

  return (
    <div style={styles.root}>
      <TitleBar />
      {!isOnline && <OfflineBanner />}
      <div style={styles.body}>
        <Sidebar tab={tab} setTab={setTab} />
        <div style={styles.main}>
          <div style={{ ...styles.content, paddingBottom: currentSong ? 96 : 0 }}>
            {renderView()}
          </div>
          {currentSong && <PlayerBar />}
        </div>
      </div>

      {showUpdatePrompt && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>{t('update.available')}</h2>
            <p style={styles.modalText}>
              {t('update.localVersion')} {appVersion || '—'}<br />
              {t('update.serverVersion')} {serverVersion || '—'}
            </p>
            <div style={styles.modalActions}>
              <button style={styles.primaryBtn} onClick={() => window.electronAPI?.openExternal('https://yfitops.duckdns.org')}>
                {t('update.download')}
              </button>
              <button style={styles.secondaryBtn} onClick={() => setShowUpdatePrompt(false)}>
                {t('update.continueAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangelog && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>{t('changelog.title', serverVersion || appVersion)}</h2>
            <p style={styles.modalText}>{t('changelog.upToDate')}</p>
            <div style={styles.changelogContent}>
              {changelogNotes.split('\n').map((line, index) => line.trim() ? (
                <p key={index} style={styles.changelogLine}>{line.trim()}</p>
              ) : null)}
            </div>
            <button style={styles.primaryBtn} onClick={() => setShowChangelog(false)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    display: 'flex', flexDirection: 'column',
    width: '100vw', height: '100vh',
    background: 'var(--bg0)', overflow: 'hidden',
  },
  offlineBanner: {
    flexShrink: 0, padding: '8px 20px',
    background: '#ff555518', borderBottom: '1px solid #ff555540',
    color: '#ff8080', fontSize: 12.5, fontWeight: 700, textAlign: 'center',
  },
  body: {
    flex: 1, display: 'flex', overflow: 'hidden',
  },
  main: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', position: 'relative',
  },
  content: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'var(--overlay)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modalBox: {
    width: 520, maxWidth: '90%', background: 'var(--bg2)', border: '1px solid var(--border-strong)', borderRadius: 18,
    padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.45)', color: 'var(--text)',
  },
  modalTitle: { margin: 0, fontSize: 22, color: 'var(--text)' },
  modalText: { marginTop: 16, lineHeight: 1.6, color: 'var(--text-secondary)', fontSize: 14 },
  modalActions: { marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' },
  primaryBtn: {
    background: '#1ed760', color: '#000', border: 'none', borderRadius: 10,
    padding: '12px 18px', cursor: 'pointer', fontWeight: 700, minWidth: 180,
  },
  secondaryBtn: {
    background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 10,
    padding: '12px 18px', cursor: 'pointer', fontWeight: 700, minWidth: 180,
  },
  changelogContent: {
    marginTop: 18, padding: 16, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)', maxHeight: 320,
    overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-secondary)',
  },
  changelogLine: { margin: '8px 0' },
};