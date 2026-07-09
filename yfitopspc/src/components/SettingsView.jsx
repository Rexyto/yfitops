import React, { useRef, useState } from 'react';
import useMusicStore from '../store/MusicStore';
import useSettingsStore, { THEMES } from '../store/SettingsStore';
import { useT } from '../i18n';
import { SERVER_URL } from '../api';

const fmtTotal = (secs) => {
  if (!secs) return null;
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

function resolveSongsForPlaylist(playlist, type, allSongs) {
  if (type === 'folder') return playlist.songs || [];
  return allSongs.filter(s => playlist.songs?.includes(s.id));
}

const SECTION_IDS = ['profile', 'appearance', 'system', 'downloads', 'storage', 'credits', 'version'];

// ── Sección genérica reutilizable ───────────────────────────
const Section = React.forwardRef(function Section({ title, subtitle, children }, ref) {
  return (
    <section ref={ref} style={styles.section}>
      <div style={styles.sectionHead}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        {subtitle && <span style={styles.sectionSubtitle}>{subtitle}</span>}
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
});

// ── Fila de descarga de una playlist ────────────────────────
function DownloadableRow({ playlist, type, allSongs, isOnline }) {
  const t = useT();
  const {
    isPlaylistDownloaded, downloadPlaylist, removeOfflinePlaylist,
    downloadingIds, downloadProgress,
  } = useSettingsStore();

  const downloaded = isPlaylistDownloaded(playlist.id);
  const downloading = downloadingIds.includes(playlist.id);
  const progress = downloadProgress[playlist.id];
  const count = playlist.songs?.length ?? 0;
  const color = playlist.coverColor || '#1ed760';
  const cover = playlist.coverUrl ? `${SERVER_URL}${playlist.coverUrl}` : null;

  const handleDownload = () => {
    const resolved = resolveSongsForPlaylist(playlist, type, allSongs)
      .map(s => ({ ...s, _fullUrl: `${SERVER_URL}${s.url}` }));
    if (resolved.length === 0) return;
    downloadPlaylist(
      { id: playlist.id, name: playlist.name, type, coverColor: playlist.coverColor, coverUrl: playlist.coverUrl, totalDuration: playlist.totalDuration },
      resolved,
    );
  };

  return (
    <div style={styles.row}>
      <div style={{ ...styles.rowCover, background: cover ? undefined : color + '22', border: `1px solid ${color}33` }}>
        {cover ? <img src={cover} style={styles.rowCoverImg} alt="" /> : <span style={{ fontSize: 18, color }}>🎶</span>}
      </div>
      <div style={styles.rowMeta}>
        <span style={styles.rowName}>{playlist.name}</span>
        <span style={styles.rowSub}>{t('settings.downloads.songCount', count)}</span>
      </div>

      {downloading ? (
        <span style={styles.progressTag}>
          {progress ? t('settings.downloads.downloading', progress.done, progress.total) : t('settings.downloads.downloadingGeneric')}
        </span>
      ) : downloaded ? (
        <div style={styles.rowActions}>
          <span style={styles.downloadedTag}>{t('settings.downloads.downloaded')}</span>
          <button style={styles.dangerBtn} onClick={() => removeOfflinePlaylist(playlist.id)}>
            {t('settings.downloads.remove')}
          </button>
        </div>
      ) : (
        <button
          style={{ ...styles.downloadBtn, ...(isOnline ? {} : styles.downloadBtnDisabled) }}
          onClick={handleDownload}
          disabled={!isOnline || count === 0}
          title={!isOnline ? t('settings.downloads.offlineTooltip') : undefined}
        >
          {t('settings.downloads.download')}
        </button>
      )}
    </div>
  );
}

export default function SettingsView({ appVersion }) {
  const { playlists, folderPlaylists, songs } = useMusicStore();
  const {
    theme, setTheme, language, setLanguage,
    profilePicture, uploadProfilePicture, removeProfilePicture,
    isOnline, cacheBytes, cacheSizeLabel, clearCache, offlinePlaylists,
    launchOnStartup, setLaunchOnStartup,
  } = useSettingsStore();
  const t = useT();

  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const sectionRefs = useRef({});
  const scrollTo = (id) => sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handlePicChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError(t('settings.profile.errorType'));
      return;
    }
    setError('');
    setUploading(true);
    try {
      await uploadProfilePicture(file);
    } catch (err) {
      setError(err.message || t('settings.profile.errorGeneric'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleClearCache = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setClearing(true);
    try { await clearCache(); } finally { setClearing(false); setConfirmClear(false); }
  };

  const totalOfflineCount = offlinePlaylists.length;

  const INDEX = [
    { id: 'profile', icon: '👤', label: t('settings.index.profile') },
    { id: 'appearance', icon: '🎨', label: t('settings.index.appearance') },
    { id: 'system', icon: '🖥️', label: t('settings.index.system') },
    { id: 'downloads', icon: '⬇️', label: t('settings.index.downloads') },
    { id: 'storage', icon: '💾', label: t('settings.index.storage') },
    { id: 'credits', icon: '✨', label: t('settings.index.credits') },
    { id: 'version', icon: 'ℹ️', label: t('settings.index.version') },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('settings.title')}</h1>
        <span style={styles.sub}>{t('settings.subtitle')}</span>
      </div>

      {!isOnline && (
        <div style={styles.offlineNotice}>{t('offline.banner')}</div>
      )}

      <div style={styles.layout}>
        {/* Índice de navegación */}
        <nav style={styles.indexNav}>
          {INDEX.map(item => (
            <button key={item.id} style={styles.indexItem} onClick={() => scrollTo(item.id)}>
              <span style={styles.indexIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.sectionsCol}>
          {/* Perfil */}
          <Section
            ref={el => (sectionRefs.current.profile = el)}
            title={t('settings.profile.title')}
            subtitle={t('settings.profile.subtitle')}
          >
            <div style={styles.profileRow}>
              <div style={styles.avatarWrap}>
                {profilePicture
                  ? <img src={profilePicture} style={styles.avatarImg} alt="" />
                  : <div style={styles.avatarEmpty}>👤</div>
                }
              </div>
              <div style={styles.profileActions}>
                <button style={styles.primaryBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? t('settings.profile.uploading') : (profilePicture ? t('settings.profile.change') : t('settings.profile.upload'))}
                </button>
                {profilePicture && (
                  <button style={styles.secondaryBtn} onClick={removeProfilePicture}>
                    {t('settings.profile.remove')}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png, image/jpeg"
                  style={{ display: 'none' }}
                  onChange={handlePicChange}
                />
              </div>
            </div>
            {error && <p style={styles.errorText}>{error}</p>}
          </Section>

          {/* Apariencia */}
          <Section
            ref={el => (sectionRefs.current.appearance = el)}
            title={t('settings.appearance.title')}
            subtitle={t('settings.appearance.subtitle')}
          >
            <div style={styles.themeBlock}>
              <div>
                <span style={styles.toggleLabel}>{t('settings.appearance.themeLabel', t(`theme.${theme}`))}</span>
                <p style={styles.toggleHint}>{t('settings.appearance.themeHint')}</p>
              </div>
              <div style={styles.themePicker}>
                {THEMES.map(themeDef => {
                  const isActive = theme === themeDef.id;
                  return (
                    <button
                      key={themeDef.id}
                      style={styles.themeSwatchBtn}
                      onClick={() => setTheme(themeDef.id)}
                      title={t(`theme.${themeDef.id}`)}
                      aria-label={t(`theme.${themeDef.id}`)}
                      aria-pressed={isActive}
                    >
                      <span
                        style={{
                          ...styles.themeSwatch,
                          background: `linear-gradient(135deg, ${themeDef.swatch[0]} 50%, ${themeDef.swatch[1]} 50%)`,
                          ...(isActive ? styles.themeSwatchActive : {}),
                        }}
                      >
                        {isActive && <span style={styles.themeSwatchCheck}>✓</span>}
                      </span>
                      <span style={styles.themeSwatchLabel}>{t(`theme.${themeDef.id}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.toggleRow}>
              <div>
                <span style={styles.toggleLabel}>{t('settings.appearance.languageLabel')}</span>
                <p style={styles.toggleHint}>{t('settings.appearance.languageHint')}</p>
              </div>
              <select style={styles.select} value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
          </Section>

          {/* Sistema */}
          <Section
            ref={el => (sectionRefs.current.system = el)}
            title={t('settings.system.title')}
            subtitle={t('settings.system.subtitle')}
          >
            <div style={styles.toggleRow}>
              <div>
                <span style={styles.toggleLabel}>{t('settings.system.startupLabel')}</span>
                <p style={styles.toggleHint}>{t('settings.system.startupHint')}</p>
              </div>
              <button
                style={{ ...styles.switch, ...(launchOnStartup ? styles.switchOn : {}) }}
                onClick={() => setLaunchOnStartup(!launchOnStartup)}
                role="switch"
                aria-checked={launchOnStartup}
              >
                <span style={{ ...styles.switchDot, ...(launchOnStartup ? styles.switchDotOn : {}) }} />
              </button>
            </div>
          </Section>

          {/* Descargas offline */}
          <Section
            ref={el => (sectionRefs.current.downloads = el)}
            title={t('settings.downloads.title')}
            subtitle={t('settings.downloads.subtitle')}
          >
            {folderPlaylists.length === 0 && playlists.length === 0 && (
              <p style={styles.emptyHint}>{t('settings.downloads.none')}</p>
            )}
            {folderPlaylists.map(pl => (
              <DownloadableRow key={`f-${pl.id}`} playlist={pl} type="folder" allSongs={songs} isOnline={isOnline} />
            ))}
            {playlists.map(pl => (
              <DownloadableRow key={`m-${pl.id}`} playlist={pl} type="manual" allSongs={songs} isOnline={isOnline} />
            ))}
          </Section>

          {/* Almacenamiento / caché */}
          <Section
            ref={el => (sectionRefs.current.storage = el)}
            title={t('settings.storage.title')}
            subtitle={t('settings.storage.subtitle')}
          >
            <div style={styles.storageRow}>
              <div>
                <span style={styles.storageSize}>{cacheSizeLabel()}</span>
                <p style={styles.toggleHint}>
                  {totalOfflineCount > 0
                    ? t('settings.storage.collectionsCount', totalOfflineCount)
                    : t('settings.storage.none')}
                </p>
              </div>
              <button
                style={{ ...styles.dangerBtnLg, ...(cacheBytes === 0 ? styles.disabledBtn : {}) }}
                onClick={handleClearCache}
                disabled={cacheBytes === 0 || clearing}
              >
                {clearing ? t('settings.storage.clearing') : confirmClear ? t('settings.storage.confirm') : t('settings.storage.clear')}
              </button>
            </div>
            {confirmClear && (
              <button style={styles.linkBtn} onClick={() => setConfirmClear(false)}>{t('settings.storage.cancel')}</button>
            )}
          </Section>

          {/* Créditos */}
          <Section ref={el => (sectionRefs.current.credits = el)} title={t('settings.credits.title')}>
            <p style={styles.creditsText}>
              {t('settings.credits.text')} <strong style={{ color: 'var(--text)' }}>Rexy</strong>.
            </p>
            <div style={styles.creditsLinks}>
              <button style={styles.linkChip} onClick={() => window.electronAPI?.openExternal('https://github.com/Rexyto/yfitops')}>
                {t('settings.credits.source')}
              </button>
              <button style={styles.linkChip} onClick={() => window.electronAPI?.openExternal('https://github.com/Rexyto')}>
                {t('settings.credits.author')}
              </button>
            </div>
          </Section>

          {/* Versión */}
          <Section ref={el => (sectionRefs.current.version = el)} title={t('settings.version.title')}>
            <span style={styles.versionTag}>YFitops v{appVersion || '...'}</span>
          </Section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '0 0 40px 0' },
  header: { padding: '28px 28px 8px' },
  title: { fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, margin: '0 0 4px' },
  sub: { fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },

  offlineNotice: {
    margin: '4px 24px 8px', padding: '12px 16px',
    background: '#ff555515', border: '1px solid #ff555540', borderRadius: 10,
    color: '#ff8080', fontSize: 13, fontWeight: 600, lineHeight: 1.5,
  },

  layout: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0 24px' },
  indexNav: {
    width: 176, flexShrink: 0, position: 'sticky', top: 0,
    display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4,
  },
  indexItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'none', border: 'none', borderRadius: 8,
    padding: '9px 10px', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textAlign: 'left',
  },
  indexIcon: { fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 },

  sectionsCol: { flex: 1, minWidth: 0 },
  section: { margin: '0 0 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, scrollMarginTop: 12 },
  sectionHead: { marginBottom: 14 },
  sectionTitle: { color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: 0 },
  sectionSubtitle: { color: 'var(--text-dim)', fontSize: 12, display: 'block', marginTop: 4 },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 12 },

  profileRow: { display: 'flex', alignItems: 'center', gap: 20 },
  avatarWrap: { width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #1ed76055' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarEmpty: { width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--text-faint)' },
  profileActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  errorText: { color: '#ff5555', fontSize: 13, margin: 0 },

  primaryBtn: {
    background: '#1ed760', border: 'none', borderRadius: 10,
    padding: '10px 16px', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 10,
    padding: '10px 16px', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },

  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  toggleLabel: { color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  toggleHint: { color: 'var(--text-dim)', fontSize: 12, margin: '2px 0 0' },
  switch: {
    width: 46, height: 26, borderRadius: 20, background: 'var(--bg4)', border: '1px solid var(--border-strong)',
    position: 'relative', cursor: 'pointer', flexShrink: 0, padding: 0,
  },
  switchOn: { background: '#1ed76040', borderColor: '#1ed76070' },
  switchDot: {
    position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%',
    background: '#fff', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  switchDotOn: { transform: 'translateX(20px)', background: '#1ed760' },
  select: {
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 8,
    padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
  },

  themeBlock: { display: 'flex', flexDirection: 'column', gap: 12 },
  themePicker: { display: 'flex', flexWrap: 'wrap', gap: 14, paddingTop: 2 },
  themeSwatchBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    background: 'none', border: 'none', cursor: 'pointer', padding: 2, width: 60,
  },
  themeSwatch: {
    width: 40, height: 40, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    border: '2px solid var(--border-strong)', boxSizing: 'border-box',
    transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s',
  },
  themeSwatchActive: {
    border: '2px solid #1ed760',
    boxShadow: '0 0 0 3px #1ed76030',
    transform: 'scale(1.06)',
  },
  themeSwatchCheck: {
    color: '#1ed760', fontSize: 15, fontWeight: 900,
    textShadow: '0 1px 3px rgba(0,0,0,0.6), 0 0 4px rgba(255,255,255,0.5)',
  },
  themeSwatchLabel: {
    color: 'var(--text-dim)', fontSize: 10.5, fontWeight: 700,
    textAlign: 'center', lineHeight: 1.2,
  },

  emptyHint: { color: 'var(--text-dim)', fontSize: 13, margin: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  rowCover: { width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  rowCoverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  rowMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  rowName: { color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowSub: { color: 'var(--text-dim)', fontSize: 12 },
  rowActions: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  downloadedTag: { color: '#1ed760', fontSize: 12, fontWeight: 700 },
  progressTag: { color: 'var(--text-dim)', fontSize: 12, fontWeight: 700, flexShrink: 0 },

  downloadBtn: {
    background: 'none', border: '1px solid #1ed76055', borderRadius: 20,
    padding: '7px 14px', color: '#1ed760', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
  },
  downloadBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  dangerBtn: {
    background: 'none', border: '1px solid #ff555540', borderRadius: 20,
    padding: '6px 12px', color: '#ff5555', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },

  storageRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  storageSize: { color: 'var(--text)', fontSize: 22, fontWeight: 800 },
  dangerBtnLg: {
    background: '#ff555515', border: '1px solid #ff555550', borderRadius: 10,
    padding: '10px 16px', color: '#ff5555', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  disabledBtn: { opacity: 0.4, cursor: 'not-allowed' },
  linkBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', padding: 0 },

  creditsText: { color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.6 },
  creditsLinks: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  linkChip: {
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 20,
    padding: '9px 16px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  versionTag: {
    display: 'inline-block', background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 8, padding: '8px 14px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
  },
};