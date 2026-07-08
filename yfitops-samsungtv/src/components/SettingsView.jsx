import React, { useRef, useState } from 'react';
import useSettingsStore from '../store/SettingsStore';
import { useT } from '../i18n';
import LogsModal from './LogsModal';

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

export default function SettingsView({ appVersion }) {
  const {
    theme, toggleTheme, language, setLanguage,
    profilePicture, uploadProfilePicture, removeProfilePicture,
    isOnline,
  } = useSettingsStore();
  const t = useT();

  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);

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

  const INDEX = [
    { id: 'profile', icon: '👤', label: t('settings.index.profile') },
    { id: 'appearance', icon: '🎨', label: t('settings.index.appearance') },
    { id: 'logs', icon: '🐞', label: t('settings.index.logs') },
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
            <div style={styles.toggleRow}>
              <div>
                <span style={styles.toggleLabel}>{t('settings.appearance.themeLabel', theme)}</span>
                <p style={styles.toggleHint}>{t('settings.appearance.themeHint')}</p>
              </div>
              <button
                style={{ ...styles.switch, ...(theme === 'light' ? styles.switchOn : {}) }}
                onClick={toggleTheme}
                role="switch"
                aria-checked={theme === 'light'}
              >
                <span style={{ ...styles.switchDot, ...(theme === 'light' ? styles.switchDotOn : {}) }} />
              </button>
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

          {/* Registro (logs) */}
          <Section
            ref={el => (sectionRefs.current.logs = el)}
            title={t('settings.logs.title')}
            subtitle={t('settings.logs.subtitle')}
          >
            <button style={styles.primaryBtn} onClick={() => setLogsOpen(true)}>
              {t('settings.logs.open')}
            </button>
          </Section>

          {/* Créditos */}
          <Section ref={el => (sectionRefs.current.credits = el)} title={t('settings.credits.title')}>
            <p style={styles.creditsText}>
              {t('settings.credits.text')} <strong style={{ color: 'var(--text)' }}>Rexy</strong>.
            </p>
            {/* En una TV no hay navegador para abrir enlaces externos, así que
                solo se muestran como texto informativo (no son interactivos). */}
            <div style={styles.creditsLinks}>
              <span style={styles.linkChip}>{t('settings.credits.source')}</span>
              <span style={styles.linkChip}>{t('settings.credits.author')}</span>
            </div>
          </Section>

          {/* Versión */}
          <Section ref={el => (sectionRefs.current.version = el)} title={t('settings.version.title')}>
            <span style={styles.versionTag}>YFitops TV v{appVersion || '1.0.0'}</span>
          </Section>
        </div>
      </div>

      {logsOpen && <LogsModal onClose={() => setLogsOpen(false)} />}
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

  creditsText: { color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.6 },
  creditsLinks: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  linkChip: {
    display: 'inline-block',
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 20,
    padding: '9px 16px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
  },

  versionTag: {
    display: 'inline-block', background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 8, padding: '8px 14px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
  },
};
