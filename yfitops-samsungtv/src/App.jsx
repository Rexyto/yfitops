import React, { useState, useEffect } from 'react';
import useMusicStore from './store/MusicStore';
import useSettingsStore from './store/SettingsStore';
import { useT } from './i18n';
import { pcVersion, pcChangelog, pcVerify } from './api';
import { useTvNavigation } from './tv/tvNavigation';
import { useTvBack } from './tv/backStack';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import SongsView from './components/SongsView';
import FavoritesView from './components/FavoritesView';
import PlaylistsView from './components/PlaylistsView';
import SettingsView from './components/SettingsView';
import PlayerBar from './components/PlayerBar';

// La versión de la app de TV es fija: aquí no hay proceso Electron que la
// reporte (viene de package.json / config.xml, ambos en 1.2.0).
const APP_VERSION = '1.2.0';

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
  const { token, currentSong } = useMusicStore();
  const { isOnline } = useSettingsStore();
  const t = useT();
  const [tab, setTab] = useState('songs');
  const [checking, setChecking] = useState(true);
  const [serverVersion, setServerVersion] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogNotes, setChangelogNotes] = useState('');

  // Activa la navegación por mando (flechas + OK + Atrás) para toda la app.
  useTvNavigation();

  // Cierra el modal de changelog con la tecla Atrás del mando.
  useTvBack(showChangelog ? () => setShowChangelog(false) : null);

  // Inicializar ajustes (tema, foto de perfil, conectividad)
  useEffect(() => {
    useSettingsStore.getState().init();
  }, []);

  // Al arrancar: recuperar sesión guardada (localStorage en esta versión TV)
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

  // Changelog solo la primera vez que se abre la app, si la versión coincide con el servidor.
  useEffect(() => {
    async function checkChangelog() {
      if (!token) return;
      try {
        const server = await pcVersion(token);
        if (!server?.version) return;
        setServerVersion(server.version);

        const isFirstRun = !localStorage.getItem('yfitops_first_run');
        if (isFirstRun) {
          localStorage.setItem('yfitops_first_run', '1');
          if (server.version === APP_VERSION) {
            const changelog = await pcChangelog(token);
            if (changelog?.notes) {
              setChangelogNotes(changelog.notes);
              setShowChangelog(true);
            }
          }
        }
      } catch {
        // No interrumpimos el arranque si falla la comprobación de versión.
      }
    }
    checkChangelog();
  }, [token]);

  if (checking) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 22 }}>{t('app.loading')}</span>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'var(--bg0)' }}>
        <LoginScreen />
      </div>
    );
  }

  const renderView = () => {
    if (tab === 'songs')     return <SongsView />;
    if (tab === 'favorites') return <FavoritesView />;
    if (tab === 'playlists') return <PlaylistsView />;
    if (tab === 'settings')  return <SettingsView appVersion={APP_VERSION} />;
    return null;
  };

  return (
    <div style={styles.root}>
      {!isOnline && <OfflineBanner />}
      <div style={styles.body}>
        <Sidebar tab={tab} setTab={setTab} />
        <div style={styles.main}>
          <div style={{ ...styles.content, paddingBottom: currentSong ? 128 : 0 }}>
            {renderView()}
          </div>
          {currentSong && <PlayerBar />}
        </div>
      </div>

      {showChangelog && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>{t('changelog.title', serverVersion || APP_VERSION)}</h2>
            <p style={styles.modalText}>{t('changelog.upToDate')}</p>
            <div style={styles.changelogContent}>
              {changelogNotes.split('\n').map((line, index) => line.trim() ? (
                <p key={index} style={styles.changelogLine}>{line.trim()}</p>
              ) : null)}
            </div>
            <button style={styles.primaryBtn} onClick={() => setShowChangelog(false)} autoFocus>
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
    flexShrink: 0, padding: '12px 26px',
    background: '#ff555518', borderBottom: '1px solid #ff555540',
    color: '#ff8080', fontSize: 16, fontWeight: 700, textAlign: 'center',
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
    width: 680, maxWidth: '90%', background: 'var(--bg2)', border: '1px solid var(--border-strong)', borderRadius: 24,
    padding: 38, boxShadow: '0 24px 60px rgba(0,0,0,0.45)', color: 'var(--text)',
  },
  modalTitle: { margin: 0, fontSize: 28, color: 'var(--text)' },
  modalText: { marginTop: 20, lineHeight: 1.6, color: 'var(--text-secondary)', fontSize: 18 },
  primaryBtn: {
    marginTop: 26,
    background: '#1ed760', color: '#000', border: 'none', borderRadius: 12,
    padding: '16px 24px', cursor: 'pointer', fontWeight: 700, minWidth: 220, fontSize: 17,
  },
  changelogContent: {
    marginTop: 22, padding: 20, background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--border)', maxHeight: 380,
    overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 16, color: 'var(--text-secondary)',
  },
  changelogLine: { margin: '10px 0' },
};
