import React, { useRef, useState } from 'react';
import useSettingsStore, { THEMES } from '../store/SettingsStore';
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
    theme, setTheme, language, setLanguage,
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
            <span style={styles.versionTag}>YFitops TV v{appVersion || '1.2.0'}</span>
          </Section>
        </div>
      </div>

      {logsOpen && <LogsModal onClose={() => setLogsOpen(false)} />}
    </div>
  );
}

const styles = {
  container: { padding: '0 0 48px 0' },
  header: { padding: '36px 36px 10px' },
  title: { fontSize: 38, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, margin: '0 0 6px' },
  sub: { fontSize: 15, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },

  offlineNotice: {
    margin: '6px 32px 10px', padding: '16px 20px',
    background: '#ff555515', border: '1px solid #ff555540', borderRadius: 12,
    color: '#ff8080', fontSize: 16, fontWeight: 600, lineHeight: 1.5,
  },

  layout: { display: 'flex', alignItems: 'flex-start', gap: 16, padding: '0 32px' },
  indexNav: {
    width: 260, flexShrink: 0, position: 'sticky', top: 0,
    display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4,
  },
  indexItem: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'none', border: 'none', borderRadius: 12,
    padding: '16px 16px', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 17, fontWeight: 600, textAlign: 'left',
  },
  indexIcon: { fontSize: 19, width: 24, textAlign: 'center', flexShrink: 0 },

  sectionsCol: { flex: 1, minWidth: 0 },
  section: { margin: '0 0 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, scrollMarginTop: 16 },
  sectionHead: { marginBottom: 20 },
  sectionTitle: { color: 'var(--text)', fontSize: 20, fontWeight: 800, margin: 0 },
  sectionSubtitle: { color: 'var(--text-dim)', fontSize: 15, display: 'block', marginTop: 6 },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 18 },

  profileRow: { display: 'flex', alignItems: 'center', gap: 26 },
  avatarWrap: { width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '3px solid #1ed76055' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarEmpty: { width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, color: 'var(--text-faint)' },
  profileActions: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  errorText: { color: '#ff5555', fontSize: 16, margin: 0 },

  primaryBtn: {
    background: '#1ed760', border: 'none', borderRadius: 12,
    padding: '15px 22px', color: '#000', fontWeight: 800, fontSize: 16, cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 12,
    padding: '15px 22px', color: 'var(--text)', fontWeight: 700, fontSize: 16, cursor: 'pointer',
  },

  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  toggleLabel: { color: 'var(--text)', fontSize: 18, fontWeight: 700 },
  toggleHint: { color: 'var(--text-dim)', fontSize: 14, margin: '4px 0 0' },
  select: {
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 10,
    padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer',
  },

  themeBlock: { display: 'flex', flexDirection: 'column', gap: 16 },
  themePicker: { display: 'flex', flexWrap: 'wrap', gap: 22, paddingTop: 4 },
  themeSwatchBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    background: 'none', border: 'none', cursor: 'pointer', padding: 4, width: 84,
  },
  themeSwatch: {
    width: 58, height: 58, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    border: '3px solid var(--border-strong)', boxSizing: 'border-box',
    transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s',
  },
  themeSwatchActive: {
    border: '3px solid #1ed760',
    boxShadow: '0 0 0 4px #1ed76030',
    transform: 'scale(1.06)',
  },
  themeSwatchCheck: {
    color: '#1ed760', fontSize: 22, fontWeight: 900,
    textShadow: '0 1px 3px rgba(0,0,0,0.6), 0 0 4px rgba(255,255,255,0.5)',
  },
  themeSwatchLabel: {
    color: 'var(--text-dim)', fontSize: 13.5, fontWeight: 700,
    textAlign: 'center', lineHeight: 1.25,
  },

  creditsText: { color: 'var(--text-secondary)', fontSize: 17, margin: 0, lineHeight: 1.6 },
  creditsLinks: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  linkChip: {
    display: 'inline-block',
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 24,
    padding: '13px 20px', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600,
  },

  versionTag: {
    display: 'inline-block', background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 10, padding: '13px 20px', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600,
  },
};
