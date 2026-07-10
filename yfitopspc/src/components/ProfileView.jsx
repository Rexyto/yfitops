import React, { useRef, useState } from 'react';
import useMusicStore from '../store/MusicStore';
import useSettingsStore from '../store/SettingsStore';
import { useT } from '../i18n';

// ── Utilidad de formato de tiempo (para estadísticas mock) ─────
function fmtHours(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

// ── Tarjeta de estadística ───────────────────────────────────
function StatCard({ icon, label, value, hint }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statIcon}>{icon}</span>
      <div style={styles.statBody}>
        <span style={styles.statValue}>{value}</span>
        <span style={styles.statLabel}>{label}</span>
        {hint && <span style={styles.statHint}>{hint}</span>}
      </div>
    </div>
  );
}

// ── Tarjeta de logro ──────────────────────────────────────────
function AchievementCard({ icon, title, desc, unlocked, progress }) {
  return (
    <div style={{ ...styles.achCard, ...(unlocked ? styles.achCardUnlocked : {}) }}>
      <div style={{ ...styles.achIconWrap, ...(unlocked ? styles.achIconWrapUnlocked : {}) }}>
        <span style={{ ...styles.achIcon, ...(unlocked ? {} : styles.achIconLocked) }}>
          {unlocked ? icon : '🔒'}
        </span>
      </div>
      <div style={styles.achBody}>
        <span style={{ ...styles.achTitle, ...(unlocked ? {} : styles.achTitleLocked) }}>{title}</span>
        <span style={styles.achDesc}>{desc}</span>
        {progress && !unlocked && (
          <div style={styles.achProgressWrap}>
            <div style={styles.achProgressTrack}>
              <div style={{ ...styles.achProgressFill, width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }} />
            </div>
            <span style={styles.achProgressText}>{progress.done}/{progress.total}</span>
          </div>
        )}
      </div>
      {unlocked && <span style={styles.achCheck}>✓</span>}
    </div>
  );
}

export default function ProfileView() {
  const { username, favorites, playlists, folderPlaylists, songs } = useMusicStore();
  const { profilePicture, uploadProfilePicture, removeProfilePicture, offlinePlaylists } = useSettingsStore();
  const t = useT();

  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handlePicChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError(t('profile.picture.errorType'));
      return;
    }
    setError('');
    setUploading(true);
    try {
      await uploadProfilePicture(file);
    } catch (err) {
      setError(err.message || t('profile.picture.errorGeneric'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const totalCollections = playlists.length + folderPlaylists.length;

  // ── Estadísticas: mezcla de datos reales disponibles y valores
  // ilustrativos (marcados como "Próximamente") hasta que el backend
  // trackee reproducciones/tiempo real de escucha. ──────────────
  const stats = [
    { icon: '❤️', label: t('profile.stats.favorites'), value: favorites.length },
    { icon: '📁', label: t('profile.stats.collections'), value: totalCollections },
    { icon: '🎧', label: t('profile.stats.songsPlayed'), value: '—', hint: t('profile.stats.comingSoon') },
    { icon: '⏱️', label: t('profile.stats.totalTime'), value: '—', hint: t('profile.stats.comingSoon') },
    { icon: '🔥', label: t('profile.stats.streak'), value: '—', hint: t('profile.stats.comingSoon') },
    { icon: '🎤', label: t('profile.stats.topArtist'), value: '—', hint: t('profile.stats.comingSoon') },
  ];

  // ── Logros: algunos calculados con datos reales del usuario,
  // otros aspiracionales pendientes de trackeo futuro. ──────────
  const achievements = [
    { icon: '🎵', key: 'first', unlocked: true },
    { icon: '💚', key: 'favTen', unlocked: favorites.length >= 10, progress: { done: Math.min(favorites.length, 10), total: 10 } },
    { icon: '📚', key: 'collector', unlocked: playlists.length >= 5, progress: { done: Math.min(playlists.length, 5), total: 5 } },
    { icon: '⬇️', key: 'offline', unlocked: offlinePlaylists.length > 0 },
    { icon: '🧭', key: 'library', unlocked: songs.length >= 50, progress: { done: Math.min(songs.length, 50), total: 50 } },
    { icon: '🌙', key: 'nightowl', unlocked: false },
    { icon: '🏃', key: 'marathon', unlocked: false },
    { icon: '📅', key: 'weekstreak', unlocked: false },
  ];
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('profile.title')}</h1>
        <span style={styles.sub}>{t('profile.subtitle')}</span>
      </div>

      {/* ── Cabecera de perfil ── */}
      <section style={styles.section}>
        <div style={styles.profileRow}>
          <div style={styles.avatarWrap}>
            {profilePicture
              ? <img src={profilePicture} style={styles.avatarImg} alt="" />
              : <div style={styles.avatarEmpty}>👤</div>
            }
          </div>
          <div style={styles.profileInfo}>
            <span style={styles.profileName}>{username || 'Usuario'}</span>
            <span style={styles.profileHint}>{t('profile.picture.subtitle')}</span>
            <div style={styles.profileActions}>
              <button style={styles.primaryBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? t('profile.picture.uploading') : (profilePicture ? t('profile.picture.change') : t('profile.picture.upload'))}
              </button>
              {profilePicture && (
                <button style={styles.secondaryBtn} onClick={removeProfilePicture}>
                  {t('profile.picture.remove')}
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
            {error && <p style={styles.errorText}>{error}</p>}
          </div>
        </div>
      </section>

      {/* ── Estadísticas ── */}
      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h3 style={styles.sectionTitle}>{t('profile.stats.title')}</h3>
          <span style={styles.sectionSubtitle}>{t('profile.stats.subtitle')}</span>
        </div>
        <div style={styles.statsGrid}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
        <p style={styles.footnote}>{t('profile.stats.footnote')}</p>
      </section>

      {/* ── Logros ── */}
      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <div style={styles.achHeadRow}>
            <div>
              <h3 style={styles.sectionTitle}>{t('profile.achievements.title')}</h3>
              <span style={styles.sectionSubtitle}>{t('profile.achievements.subtitle')}</span>
            </div>
            <span style={styles.achBadgeCount}>{t('profile.achievements.unlocked', unlockedCount, achievements.length)}</span>
          </div>
        </div>
        <div style={styles.achGrid}>
          {achievements.map(a => (
            <AchievementCard
              key={a.key}
              icon={a.icon}
              unlocked={a.unlocked}
              progress={a.progress}
              title={t(`profile.ach.${a.key}.title`)}
              desc={t(`profile.ach.${a.key}.desc`)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

const styles = {
  container: { padding: '0 0 40px 0' },
  header: { padding: '28px 28px 8px' },
  title: { fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, margin: '0 0 4px' },
  sub: { fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },

  section: { margin: '16px 24px 0', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 },
  sectionHead: { marginBottom: 14 },
  sectionTitle: { color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: 0 },
  sectionSubtitle: { color: 'var(--text-dim)', fontSize: 12, display: 'block', marginTop: 4 },

  // Perfil
  profileRow: { display: 'flex', alignItems: 'center', gap: 20 },
  avatarWrap: { width: 84, height: 84, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #1ed76055' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarEmpty: { width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--text-faint)' },
  profileInfo: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  profileName: { color: 'var(--text)', fontSize: 20, fontWeight: 800 },
  profileHint: { color: 'var(--text-dim)', fontSize: 12, marginBottom: 4 },
  profileActions: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  errorText: { color: '#ff5555', fontSize: 13, margin: '6px 0 0' },
  primaryBtn: {
    background: '#1ed760', border: 'none', borderRadius: 10,
    padding: '10px 16px', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border-strong)', borderRadius: 10,
    padding: '10px 16px', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },

  // Estadísticas
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  statCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 12, padding: '14px 16px',
  },
  statIcon: { fontSize: 22, flexShrink: 0 },
  statBody: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  statValue: { color: 'var(--text)', fontSize: 20, fontWeight: 800, lineHeight: 1.1 },
  statLabel: { color: 'var(--text-dim)', fontSize: 11.5, fontWeight: 600, marginTop: 2 },
  statHint: { color: 'var(--text-faint)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  footnote: { color: 'var(--text-faint)', fontSize: 11.5, margin: '14px 0 0', lineHeight: 1.5 },

  // Logros
  achHeadRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  achBadgeCount: {
    background: '#1ed76015', border: '1px solid #1ed76030', borderRadius: 20,
    padding: '6px 12px', color: '#1ed760', fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  achGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 },
  achCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 12, padding: 14, position: 'relative', opacity: 0.75,
  },
  achCardUnlocked: { opacity: 1, borderColor: '#1ed76040', background: 'linear-gradient(135deg, #1ed76012, var(--bg3) 60%)' },
  achIconWrap: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  achIconWrapUnlocked: { background: '#1ed76020' },
  achIcon: { fontSize: 19 },
  achIconLocked: { fontSize: 15, opacity: 0.6 },
  achBody: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  achTitle: { color: 'var(--text)', fontSize: 13.5, fontWeight: 700 },
  achTitleLocked: { color: 'var(--text-muted)' },
  achDesc: { color: 'var(--text-dim)', fontSize: 11.5, lineHeight: 1.4 },
  achCheck: {
    position: 'absolute', top: 10, right: 10,
    color: '#1ed760', fontSize: 13, fontWeight: 900,
  },
  achProgressWrap: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
  achProgressTrack: { flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' },
  achProgressFill: { height: '100%', background: '#1ed760', borderRadius: 2 },
  achProgressText: { color: 'var(--text-faint)', fontSize: 10, fontWeight: 700, flexShrink: 0 },
};