import React, { useEffect, useMemo, useRef, useState } from 'react';
import useMusicStore from '../store/MusicStore';
import useSettingsStore from '../store/SettingsStore';
import { useT } from '../i18n';

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

// ── Tarjeta de "más escuchado" (canción / colección) ─────────
function HighlightCard({ icon, label, title, subtitle, plays, emptyText }) {
  return (
    <div style={styles.highlightCard}>
      <span style={styles.highlightLabel}>{icon} {label}</span>
      {title ? (
        <>
          <span style={styles.highlightTitle}>{title}</span>
          {subtitle && <span style={styles.highlightSubtitle}>{subtitle}</span>}
          {typeof plays === 'number' && <span style={styles.highlightPlays}>{plays}</span>}
        </>
      ) : (
        <span style={styles.highlightEmpty}>{emptyText}</span>
      )}
    </div>
  );
}

// ── Tarjeta de logro (contenido siempre viene del servidor) ──
function AchievementCard({ icon, title, description, unlocked, progress, threshold, progressLabel }) {
  const pct = threshold > 0 ? Math.min(100, (progress / threshold) * 100) : 0;
  return (
    <div style={{ ...styles.achCard, ...(unlocked ? styles.achCardUnlocked : {}) }}>
      <div style={{ ...styles.achIconWrap, ...(unlocked ? styles.achIconWrapUnlocked : {}) }}>
        <span style={{ ...styles.achIcon, ...(unlocked ? {} : styles.achIconLocked) }}>
          {unlocked ? icon : '🔒'}
        </span>
      </div>
      <div style={styles.achBody}>
        <span style={{ ...styles.achTitle, ...(unlocked ? {} : styles.achTitleLocked) }}>{title}</span>
        <span style={styles.achDesc}>{description}</span>
        {!unlocked && threshold > 1 && (
          <div style={styles.achProgressWrap}>
            <div style={styles.achProgressTrack}>
              <div style={{ ...styles.achProgressFill, width: `${pct}%` }} />
            </div>
            <span style={styles.achProgressText}>{progressLabel}</span>
          </div>
        )}
      </div>
      {unlocked && <span style={styles.achCheck}>✓</span>}
    </div>
  );
}

function fmtSeconds(totalSeconds, t) {
  if (!totalSeconds) return '0 min';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? t('profile.stats.hoursMinutes', h, m) : t('profile.stats.minutesOnly', m);
}

export default function ProfileView() {
  const {
    username,
    achievements, achievementsLoading, stats, statsLoading,
    fetchAchievements, fetchStats, claimAchievement,
  } = useMusicStore();
  const { profilePicture, uploadProfilePicture, removeProfilePicture, offlinePlaylists } = useSettingsStore();
  const t = useT();

  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | unlocked | locked
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Refresca logros/estadísticas cada vez que se entra en la pestaña de
  // perfil (además de la carga inicial que ya hace el login).
  useEffect(() => {
    fetchAchievements();
    fetchStats();
  }, []);

  // Reintento silencioso del logro "Modo Avión": si el usuario ya tiene
  // alguna colección descargada para offline pero el logro no aparece
  // como desbloqueado (por ejemplo, porque el primer intento de
  // reclamarlo falló por falta de red o por el rate limit), se vuelve a
  // reclamar solo. claimAchievement es idempotente en el servidor, así
  // que no pasa nada si ya estaba desbloqueado.
  useEffect(() => {
    if (achievementsLoading || achievements.length === 0) return;
    if (offlinePlaylists.length === 0) return;
    const offlineAch = achievements.find(a => a.id === 'offline_first');
    if (offlineAch && !offlineAch.unlocked) {
      claimAchievement('offline_first');
    }
  }, [achievementsLoading, achievements, offlinePlaylists]);

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

  // ── Estadísticas: todas reales, calculadas en el servidor a partir del
  // historial de escucha (nada de valores "Próximamente"). ─────────────
  const statCards = [
    { icon: '🎧', label: t('profile.stats.songsPlayed'), value: stats ? stats.totalSongsPlayed : '—' },
    { icon: '⏱️', label: t('profile.stats.totalTime'), value: stats ? fmtSeconds(stats.totalListeningSeconds, t) : '—' },
    { icon: '🔥', label: t('profile.stats.streak'), value: stats ? t('profile.stats.streakDays', stats.currentStreak) : '—' },
  ];

  // ── Catálogo de logros: 100% dinámico, viene del servidor tal cual
  // (icono, título, descripción, umbral, progreso actual). Si se crea un
  // logro nuevo desde el panel web, aparece aquí solo con recargar. ────
  const categories = useMemo(() => {
    const set = new Set(achievements.map(a => a.category).filter(Boolean));
    return Array.from(set);
  }, [achievements]);

  const filteredAchievements = useMemo(() => {
    return achievements.filter(a => {
      if (statusFilter === 'unlocked' && !a.unlocked) return false;
      if (statusFilter === 'locked' && a.unlocked) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (search && !`${a.title} ${a.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [achievements, search, statusFilter, categoryFilter]);

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
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        <div style={styles.highlightGrid}>
          <HighlightCard
            icon="🎵"
            label={t('profile.stats.mostPlayedSong')}
            title={stats?.mostPlayedSong?.title}
            subtitle={stats?.mostPlayedSong?.artist}
            plays={stats?.mostPlayedSong ? stats.mostPlayedSong.playCount : null}
            emptyText={statsLoading ? t('profile.stats.loading') : t('profile.stats.noDataYet')}
          />
          <HighlightCard
            icon="📻"
            label={t('profile.stats.mostPlayedPlaylist')}
            title={stats?.mostPlayedPlaylist?.name}
            subtitle={stats?.mostPlayedPlaylist ? (stats.mostPlayedPlaylist.type === 'folder' ? t('profile.stats.collectionTypeFolder') : t('profile.stats.collectionTypeManual')) : null}
            plays={stats?.mostPlayedPlaylist ? stats.mostPlayedPlaylist.playCount : null}
            emptyText={statsLoading ? t('profile.stats.loading') : t('profile.stats.noDataYet')}
          />
        </div>
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

        <div style={styles.achFilters}>
          <input
            style={styles.achSearch}
            placeholder={t('profile.achievements.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={styles.achChips}>
            {['all', 'unlocked', 'locked'].map(f => (
              <button
                key={f}
                style={{ ...styles.achChip, ...(statusFilter === f ? styles.achChipActive : {}) }}
                onClick={() => setStatusFilter(f)}
              >
                {t(`profile.achievements.filter.${f}`)}
              </button>
            ))}
          </div>
          {categories.length > 1 && (
            <div style={styles.achChips}>
              <button
                style={{ ...styles.achChip, ...(categoryFilter === 'all' ? styles.achChipActive : {}) }}
                onClick={() => setCategoryFilter('all')}
              >
                {t('profile.achievements.category.all')}
              </button>
              {categories.map(c => (
                <button
                  key={c}
                  style={{ ...styles.achChip, ...(categoryFilter === c ? styles.achChipActive : {}) }}
                  onClick={() => setCategoryFilter(c)}
                >
                  {t(`profile.achievements.category.${c}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        {achievementsLoading && achievements.length === 0 ? (
          <p style={styles.achLoading}>{t('profile.achievements.loading')}</p>
        ) : filteredAchievements.length === 0 ? (
          <p style={styles.achLoading}>{t('profile.achievements.noResults')}</p>
        ) : (
          <div style={styles.achGrid}>
            {filteredAchievements.map(a => (
              <AchievementCard
                key={a.id}
                icon={a.icon}
                unlocked={a.unlocked}
                progress={a.progress}
                threshold={a.threshold}
                progressLabel={t('profile.achievements.progress', Math.floor(a.progress), a.threshold)}
                title={a.title}
                description={a.description}
              />
            ))}
          </div>
        )}
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

  // Más escuchado
  highlightGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 },
  highlightCard: {
    display: 'flex', flexDirection: 'column', gap: 3,
    background: 'var(--bg3)', border: '1px solid var(--border-strong)',
    borderRadius: 12, padding: '14px 16px', position: 'relative',
  },
  highlightLabel: { color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  highlightTitle: { color: 'var(--text)', fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  highlightSubtitle: { color: 'var(--text-dim)', fontSize: 12.5 },
  highlightPlays: { position: 'absolute', top: 12, right: 14, color: '#1ed760', fontSize: 11, fontWeight: 800 },
  highlightEmpty: { color: 'var(--text-faint)', fontSize: 13 },

  // Logros
  achHeadRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  achBadgeCount: {
    background: '#1ed76015', border: '1px solid #1ed76030', borderRadius: 20,
    padding: '6px 12px', color: '#1ed760', fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  achFilters: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  achSearch: {
    background: 'var(--bg4)', border: '1px solid var(--border-strong)', borderRadius: 10,
    padding: '10px 14px', color: 'var(--text)', fontSize: 13.5, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  achChips: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  achChip: {
    background: 'var(--bg4)', border: '1px solid var(--border-strong)', borderRadius: 20,
    padding: '6px 13px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  achChipActive: { background: '#1ed76020', borderColor: '#1ed76060', color: '#1ed760' },
  achLoading: { color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '30px 0' },
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
  achProgressText: { color: 'var(--text-faint)', fontSize: 10, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' },
};