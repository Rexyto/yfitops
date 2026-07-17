import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Linking, TextInput,
} from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { MusicContext } from '../context/MusicContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme, THEMES } from '../theme';
import { useT } from '../i18n';

function resolveSongsForPlaylist(playlist, type, allSongs) {
  if (type === 'folder') return playlist.songs || [];
  return allSongs.filter(s => playlist.songs?.includes(s.id));
}

function Section({ title, subtitle, children, onLayout, c, styles }) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DownloadableRow({ playlist, type, allSongs, isOnline, SERVER_URL, styles, colors }) {
  const t = useT();
  const {
    isPlaylistDownloaded, downloadPlaylist, removeOfflinePlaylist,
    downloadingIds, downloadProgress,
  } = useSettings();
  const { claimAchievement } = useContext(MusicContext);

  const downloaded = isPlaylistDownloaded(playlist.id);
  const downloading = downloadingIds.includes(playlist.id);
  const progress = downloadProgress[playlist.id];
  const count = playlist.songs?.length ?? 0;

  const handleDownload = async () => {
    const resolved = resolveSongsForPlaylist(playlist, type, allSongs)
      .map(s => ({ ...s, _fullUrl: `${SERVER_URL}${s.url}` }));
    if (resolved.length === 0) return;
    await downloadPlaylist(
      { id: playlist.id, name: playlist.name, type, coverColor: playlist.coverColor, coverUrl: playlist.coverUrl, totalDuration: playlist.totalDuration },
      resolved,
    );
    // Logro "Modo Avión": se reclama en el servidor. Es idempotente (si ya
    // estaba desbloqueado, el servidor simplemente no hace nada), así que
    // no hace falta comprobar aquí si es la primera descarga o no.
    claimAchievement('offline_first');
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <Text style={styles.rowName} numberOfLines={1}>{playlist.name}</Text>
        <Text style={styles.rowSub}>{t('settings.downloads.songCount', count)}</Text>
      </View>

      {downloading ? (
        <Text style={styles.progressTag}>
          {progress ? t('settings.downloads.downloading', progress.done, progress.total) : '…'}
        </Text>
      ) : downloaded ? (
        <View style={styles.rowActions}>
          <Text style={styles.downloadedTag}>{t('settings.downloads.downloaded')}</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => removeOfflinePlaylist(playlist.id)}>
            <Text style={styles.dangerBtnText}>{t('settings.downloads.remove')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.downloadBtn, !isOnline && styles.downloadBtnDisabled]}
          onPress={handleDownload}
          disabled={!isOnline || count === 0}
        >
          <Text style={styles.downloadBtnText}>{t('settings.downloads.download')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function SettingsScreen({ onLogout }) {
  const { playlists, folderPlaylists, songs, SERVER_URL } = useContext(MusicContext);
  const {
    profilePicture, uploadProfilePicture, removeProfilePicture,
    language, setLanguage, isOnline, offlinePlaylists,
    cacheBytes, cacheSizeLabel, clearCache,
  } = useSettings();
  const {
    achievements, achievementsLoading, stats, statsLoading, fetchAchievements, fetchStats,
  } = useContext(MusicContext);
  const { theme, setTheme, colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [achSearch, setAchSearch] = useState('');
  const [achStatusFilter, setAchStatusFilter] = useState('all'); // all | unlocked | locked
  const [achCategoryFilter, setAchCategoryFilter] = useState('all');

  // Refresca logros/estadísticas cada vez que se entra en Ajustes (esta
  // pantalla se desmonta al cambiar de pestaña, así que esto equivale a
  // "refrescar al abrir", igual que en la app de PC).
  React.useEffect(() => {
    fetchAchievements();
    fetchStats();
  }, []);

  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const scrollTo = (id) => {
    const y = sectionY.current[id];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };
  const captureY = (id) => (e) => { sectionY.current[id] = e.nativeEvent.layout.y; };

  const handleUploadPic = async () => {
    setError('');
    setUploading(true);
    try {
      await uploadProfilePicture();
    } catch (e) {
      setError(e.message === 'no-permission' ? t('settings.profile.noPermission') : t('song.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setClearing(true);
    try { await clearCache(); } finally { setClearing(false); setConfirmClear(false); }
  };

  const totalOfflineCount = offlinePlaylists.length;
  const appVersion = Constants.expoConfig?.version || '—';

  // ── Estadísticas: reales, calculadas por el servidor a partir del
  // historial de escucha (nada de valores de relleno). ─────────────
  const fmtSeconds = (totalSeconds) => {
    if (!totalSeconds) return '0 min';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return h > 0 ? t('settings.stats.hoursMinutes', h, m) : t('settings.stats.minutesOnly', m);
  };
  const statCards = [
    { icon: '🎧', label: t('settings.stats.songsPlayed'), value: stats ? stats.totalSongsPlayed : '—' },
    { icon: '⏱️', label: t('settings.stats.totalTime'), value: stats ? fmtSeconds(stats.totalListeningSeconds) : '—' },
    { icon: '🔥', label: t('settings.stats.streak'), value: stats ? t('settings.stats.streakDays', stats.currentStreak) : '—' },
  ];

  // ── Catálogo de logros: 100% dinámico, viene del servidor tal cual
  // (icono, título, descripción, umbral, progreso actual). Si se crea un
  // logro nuevo desde el panel web, aparece aquí solo con recargar. ────
  const achCategories = [...new Set(achievements.map(a => a.category).filter(Boolean))];
  const filteredAchievements = achievements.filter(a => {
    if (achStatusFilter === 'unlocked' && !a.unlocked) return false;
    if (achStatusFilter === 'locked' && a.unlocked) return false;
    if (achCategoryFilter !== 'all' && a.category !== achCategoryFilter) return false;
    if (achSearch && !`${a.title} ${a.description}`.toLowerCase().includes(achSearch.toLowerCase())) return false;
    return true;
  });
  const achUnlockedCount = achievements.filter(a => a.unlocked).length;

  const INDEX = [
    { id: 'profile', icon: '👤', label: t('settings.index.profile') },
    { id: 'stats', icon: '🏆', label: t('settings.index.stats') },
    { id: 'appearance', icon: '🎨', label: t('settings.index.appearance') },
    { id: 'downloads', icon: '⬇️', label: t('settings.index.downloads') },
    { id: 'storage', icon: '💾', label: t('settings.index.storage') },
    { id: 'credits', icon: '✨', label: t('settings.index.credits') },
    { id: 'version', icon: 'ℹ️', label: t('settings.index.version') },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <Text style={styles.headerSub}>{t('settings.subtitle')}</Text>
      </View>

      {!isOnline && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeText}>{t('offline.banner')}</Text>
        </View>
      )}

      {/* Índice horizontal */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indexRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {INDEX.map(item => (
          <TouchableOpacity key={item.id} style={styles.indexChip} onPress={() => scrollTo(item.id)}>
            <Text style={styles.indexChipText}>{item.icon} {item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Perfil */}
        <Section c={colors} styles={styles} onLayout={captureY('profile')} title={t('settings.profile.title')} subtitle={t('settings.profile.subtitle')}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {profilePicture
                ? <Image source={{ uri: profilePicture }} style={styles.avatarImg} />
                : <View style={styles.avatarEmpty}><Text style={{ fontSize: 28 }}>👤</Text></View>
              }
            </View>
            <View style={styles.profileActions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleUploadPic} disabled={uploading}>
                <Text style={styles.primaryBtnText}>{profilePicture ? t('settings.profile.change') : t('settings.profile.upload')}</Text>
              </TouchableOpacity>
              {profilePicture && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={removeProfilePicture}>
                  <Text style={styles.secondaryBtnText}>{t('settings.profile.remove')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </Section>

        {/* Logros y estadísticas */}
        <Section c={colors} styles={styles} onLayout={captureY('stats')} title={t('settings.stats.title')} subtitle={t('settings.stats.subtitle')}>
          <View style={styles.statsGrid}>
            {statCards.map((s, i) => (
              <View key={i} style={styles.statCard}>
                <Text style={styles.statIcon}>{s.icon}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.highlightGrid}>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>🎵 {t('settings.stats.mostPlayedSong')}</Text>
              {stats?.mostPlayedSong ? (
                <>
                  <Text style={styles.highlightTitle} numberOfLines={1}>{stats.mostPlayedSong.title}</Text>
                  <Text style={styles.highlightSubtitle} numberOfLines={1}>{stats.mostPlayedSong.artist}</Text>
                  <Text style={styles.highlightPlays}>{stats.mostPlayedSong.playCount}</Text>
                </>
              ) : (
                <Text style={styles.highlightEmpty}>{statsLoading ? t('settings.stats.loading') : t('settings.stats.noDataYet')}</Text>
              )}
            </View>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>📻 {t('settings.stats.mostPlayedPlaylist')}</Text>
              {stats?.mostPlayedPlaylist ? (
                <>
                  <Text style={styles.highlightTitle} numberOfLines={1}>{stats.mostPlayedPlaylist.name}</Text>
                  <Text style={styles.highlightSubtitle} numberOfLines={1}>
                    {stats.mostPlayedPlaylist.type === 'folder' ? t('settings.stats.collectionTypeFolder') : t('settings.stats.collectionTypeManual')}
                  </Text>
                  <Text style={styles.highlightPlays}>{stats.mostPlayedPlaylist.playCount}</Text>
                </>
              ) : (
                <Text style={styles.highlightEmpty}>{statsLoading ? t('settings.stats.loading') : t('settings.stats.noDataYet')}</Text>
              )}
            </View>
          </View>

          <View style={styles.achDivider} />

          <View style={styles.achHeadRow}>
            <Text style={styles.achTitle}>{t('settings.achievements.title')}</Text>
            <View style={styles.achBadgeCount}>
              <Text style={styles.achBadgeCountText}>{t('settings.achievements.unlocked', achUnlockedCount, achievements.length)}</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>{t('settings.achievements.subtitle')}</Text>

          <TextInput
            style={styles.achSearch}
            placeholder={t('settings.achievements.searchPlaceholder')}
            placeholderTextColor={colors.textDim}
            value={achSearch}
            onChangeText={setAchSearch}
          />

          <View style={styles.achChips}>
            {['all', 'unlocked', 'locked'].map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.achChip, achStatusFilter === f && styles.achChipActive]}
                onPress={() => setAchStatusFilter(f)}
              >
                <Text style={[styles.achChipText, achStatusFilter === f && styles.achChipTextActive]}>{t(`settings.achievements.filter.${f}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {achCategories.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={styles.achChips}>
                <TouchableOpacity style={[styles.achChip, achCategoryFilter === 'all' && styles.achChipActive]} onPress={() => setAchCategoryFilter('all')}>
                  <Text style={[styles.achChipText, achCategoryFilter === 'all' && styles.achChipTextActive]}>{t('settings.achievements.category.all')}</Text>
                </TouchableOpacity>
                {achCategories.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.achChip, achCategoryFilter === cat && styles.achChipActive]} onPress={() => setAchCategoryFilter(cat)}>
                    <Text style={[styles.achChipText, achCategoryFilter === cat && styles.achChipTextActive]}>{t(`settings.achievements.category.${cat}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {achievementsLoading && achievements.length === 0 ? (
            <Text style={styles.achEmptyText}>{t('settings.achievements.loading')}</Text>
          ) : filteredAchievements.length === 0 ? (
            <Text style={styles.achEmptyText}>{t('settings.achievements.noResults')}</Text>
          ) : (
            filteredAchievements.map(a => {
              const pct = a.threshold > 0 ? Math.min(100, (a.progress / a.threshold) * 100) : 0;
              return (
                <View key={a.id} style={[styles.achRow, a.unlocked && styles.achRowUnlocked]}>
                  <View style={[styles.achIconWrap, a.unlocked && styles.achIconWrapUnlocked]}>
                    <Text style={styles.achIcon}>{a.unlocked ? a.icon : '🔒'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.achRowTitle, !a.unlocked && styles.achRowTitleLocked]}>{a.title}</Text>
                    <Text style={styles.achRowDesc}>{a.description}</Text>
                    {!a.unlocked && a.threshold > 1 && (
                      <View style={styles.achProgressWrap}>
                        <View style={styles.achProgressTrack}>
                          <View style={[styles.achProgressFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.achProgressText}>{Math.floor(a.progress)}/{a.threshold}</Text>
                      </View>
                    )}
                  </View>
                  {a.unlocked && <Text style={styles.achCheck}>✓</Text>}
                </View>
              );
            })
          )}
        </Section>

        {/* Apariencia */}
        <Section c={colors} styles={styles} onLayout={captureY('appearance')} title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')}>
          <View style={styles.themeBlock}>
            <Text style={styles.toggleLabel}>{t('settings.appearance.themeLabel', t(`theme.${theme}`))}</Text>
            <Text style={styles.toggleHint}>{t('settings.appearance.themeHint')}</Text>
            <View style={styles.themePicker}>
              {THEMES.map(themeDef => {
                const isActive = theme === themeDef.id;
                return (
                  <TouchableOpacity
                    key={themeDef.id}
                    style={styles.themeSwatchBtn}
                    onPress={() => setTheme(themeDef.id)}
                    accessibilityLabel={t(`theme.${themeDef.id}`)}
                  >
                    <View style={[styles.themeSwatchWrap, isActive && styles.themeSwatchActive]}>
                      <LinearGradient
                        colors={[themeDef.swatch[0], themeDef.swatch[0], themeDef.swatch[1], themeDef.swatch[1]]}
                        locations={[0, 0.5, 0.5, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.themeSwatch}
                      >
                        {isActive && <Text style={styles.themeSwatchCheck}>✓</Text>}
                      </LinearGradient>
                    </View>
                    <Text style={styles.themeSwatchLabel} numberOfLines={1}>{t(`theme.${themeDef.id}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{t('settings.appearance.languageLabel')}</Text>
              <Text style={styles.toggleHint}>{t('settings.appearance.languageHint')}</Text>
            </View>
            <View style={styles.langRow}>
              <TouchableOpacity style={[styles.langChip, language === 'es' && styles.langChipActive]} onPress={() => setLanguage('es')}>
                <Text style={[styles.langChipText, language === 'es' && styles.langChipTextActive]}>ES</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.langChip, language === 'en' && styles.langChipActive]} onPress={() => setLanguage('en')}>
                <Text style={[styles.langChipText, language === 'en' && styles.langChipTextActive]}>EN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* Descargas offline */}
        <Section c={colors} styles={styles} onLayout={captureY('downloads')} title={t('settings.downloads.title')} subtitle={t('settings.downloads.subtitle')}>
          {folderPlaylists.length === 0 && playlists.length === 0 && (
            <Text style={styles.emptyHint}>{t('settings.downloads.none')}</Text>
          )}
          {folderPlaylists.map(pl => (
            <DownloadableRow key={`f-${pl.id}`} playlist={pl} type="folder" allSongs={songs} isOnline={isOnline} SERVER_URL={SERVER_URL} styles={styles} colors={colors} />
          ))}
          {playlists.map(pl => (
            <DownloadableRow key={`m-${pl.id}`} playlist={pl} type="manual" allSongs={songs} isOnline={isOnline} SERVER_URL={SERVER_URL} styles={styles} colors={colors} />
          ))}
        </Section>

        {/* Almacenamiento */}
        <Section c={colors} styles={styles} onLayout={captureY('storage')} title={t('settings.storage.title')} subtitle={t('settings.storage.subtitle')}>
          <View style={styles.storageRow}>
            <View>
              <Text style={styles.storageSize}>{cacheSizeLabel()}</Text>
              <Text style={styles.toggleHint}>
                {totalOfflineCount > 0 ? t('settings.storage.collectionsCount', totalOfflineCount) : t('settings.storage.none')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.dangerBtnLg, cacheBytes === 0 && styles.disabledBtn]}
            onPress={handleClearCache}
            disabled={cacheBytes === 0 || clearing}
          >
            <Text style={styles.dangerBtnLgText}>
              {clearing ? t('settings.storage.clearing') : confirmClear ? t('settings.storage.confirm') : t('settings.storage.clear')}
            </Text>
          </TouchableOpacity>
          {confirmClear && (
            <TouchableOpacity onPress={() => setConfirmClear(false)}>
              <Text style={styles.linkText}>{t('settings.storage.cancel')}</Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* Créditos */}
        <Section c={colors} styles={styles} onLayout={captureY('credits')} title={t('settings.credits.title')}>
          <Text style={styles.creditsText}>
            {t('settings.credits.text')} <Text style={{ color: colors.text, fontWeight: '700' }}>Rexy</Text>.
          </Text>
          <View style={styles.creditsLinks}>
            <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL('https://github.com/Rexyto/yfitops')}>
              <Text style={styles.linkChipText}>{t('settings.credits.source')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL('https://github.com/Rexyto')}>
              <Text style={styles.linkChipText}>{t('settings.credits.author')}</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* Versión */}
        <Section c={colors} styles={styles} onLayout={captureY('version')} title={t('settings.version.title')}>
          <Text style={styles.versionTag}>YFitops v{appVersion}</Text>
        </Section>

        <TouchableOpacity style={styles.logoutRow} onPress={onLogout}>
          <Icon name="log-out-outline" size={18} color="#ff4444" />
          <Text style={styles.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: c.textDim, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },

  offlineNotice: { marginHorizontal: 20, marginTop: 8, padding: 12, backgroundColor: '#ff555518', borderWidth: 1, borderColor: '#ff555540', borderRadius: 10 },
  offlineNoticeText: { color: '#ff8080', fontSize: 12.5, fontWeight: '600' },

  indexRow: { marginTop: 14, marginBottom: 6, flexGrow: 0 },
  indexChip: { backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  indexChipText: { color: c.textSecondary, fontSize: 12.5, fontWeight: '600' },

  section: { margin: 16, marginBottom: 0, marginTop: 14, backgroundColor: c.bg2, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 18 },
  sectionTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  sectionSubtitle: { color: c.textDim, fontSize: 12, marginTop: 4 },
  sectionBody: { marginTop: 14, gap: 12 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: '#1ed76055' },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmpty: { width: '100%', height: '100%', backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  profileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  errorText: { color: '#ff5555', fontSize: 13, marginTop: 8 },

  primaryBtn: { backgroundColor: '#1ed760', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  secondaryBtn: { backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryBtnText: { color: c.text, fontWeight: '700', fontSize: 13 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
  toggleHint: { color: c.textDim, fontSize: 12, marginTop: 2 },

  themeBlock: { gap: 10 },
  themePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 6 },
  themeSwatchBtn: { alignItems: 'center', gap: 6, width: 56 },
  themeSwatchWrap: { padding: 2, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: '#1ed760' },
  themeSwatch: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.borderStrong },
  themeSwatchCheck: { color: '#1ed760', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  themeSwatchLabel: { color: c.textDim, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  langRow: { flexDirection: 'row', gap: 6 },
  langChip: { backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  langChipActive: { backgroundColor: '#1ed76025', borderColor: '#1ed76060' },
  langChipText: { color: c.textMuted, fontWeight: '700', fontSize: 12 },
  langChipTextActive: { color: '#1ed760' },

  emptyHint: { color: c.textDim, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, gap: 10 },
  rowMeta: { flex: 1, minWidth: 0 },
  rowName: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },
  rowSub: { color: c.textDim, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  downloadedTag: { color: '#1ed760', fontSize: 12, fontWeight: '700' },
  progressTag: { color: c.textDim, fontSize: 12, fontWeight: '700' },

  downloadBtn: { borderWidth: 1, borderColor: '#1ed76055', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  downloadBtnDisabled: { opacity: 0.4 },
  downloadBtnText: { color: '#1ed760', fontSize: 12, fontWeight: '700' },
  dangerBtn: { borderWidth: 1, borderColor: '#ff555540', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  dangerBtnText: { color: '#ff5555', fontSize: 12, fontWeight: '700' },

  storageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storageSize: { color: c.text, fontSize: 22, fontWeight: '800' },
  dangerBtnLg: { backgroundColor: '#ff555515', borderWidth: 1, borderColor: '#ff555550', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dangerBtnLgText: { color: '#ff5555', fontSize: 13, fontWeight: '700' },
  disabledBtn: { opacity: 0.4 },
  linkText: { color: c.textDim, fontSize: 12, textDecorationLine: 'underline', textAlign: 'center' },

  creditsText: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  creditsLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkChip: { backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  linkChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },

  versionTag: { color: c.textMuted, fontSize: 13, fontWeight: '600', backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },

  logoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 20 },
  logoutText: { color: '#ff4444', fontWeight: '700', fontSize: 14 },

  // Estadísticas
  sectionSubtitle: { color: c.textDim, fontSize: 12, marginTop: -8, marginBottom: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: '30%',
    backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 12, padding: 12,
  },
  statIcon: { fontSize: 20 },
  statValue: { color: c.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: c.textDim, fontSize: 10.5, fontWeight: '600', marginTop: 1 },

  highlightGrid: { gap: 10, marginBottom: 4 },
  highlightCard: { backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 12, padding: 14, position: 'relative' },
  highlightLabel: { color: c.textDim, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  highlightTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  highlightSubtitle: { color: c.textDim, fontSize: 12.5, marginTop: 1 },
  highlightPlays: { position: 'absolute', top: 12, right: 14, color: '#1ed760', fontSize: 11, fontWeight: '800' },
  highlightEmpty: { color: c.textFaint, fontSize: 13 },

  achDivider: { height: 1, backgroundColor: c.border, marginVertical: 16 },
  achHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  achTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  achBadgeCount: { backgroundColor: '#1ed76015', borderWidth: 1, borderColor: '#1ed76030', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  achBadgeCountText: { color: '#1ed760', fontSize: 11, fontWeight: '700' },
  achSearch: { backgroundColor: c.bg4, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 13.5, marginBottom: 10 },
  achChips: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  achChip: { backgroundColor: c.bg4, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6 },
  achChipActive: { backgroundColor: '#1ed76020', borderColor: '#1ed76060' },
  achChipText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  achChipTextActive: { color: '#1ed760' },
  achEmptyText: { color: c.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  achRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 12,
    padding: 12, marginBottom: 8, opacity: 0.75, position: 'relative',
  },
  achRowUnlocked: { opacity: 1, borderColor: '#1ed76040' },
  achIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.bg4, justifyContent: 'center', alignItems: 'center' },
  achIconWrapUnlocked: { backgroundColor: '#1ed76020' },
  achIcon: { fontSize: 17 },
  achRowTitle: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  achRowTitleLocked: { color: c.textMuted },
  achRowDesc: { color: c.textDim, fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  achProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  achProgressTrack: { flex: 1, height: 4, backgroundColor: c.bg4, borderRadius: 2, overflow: 'hidden' },
  achProgressFill: { height: '100%', backgroundColor: '#1ed760', borderRadius: 2 },
  achProgressText: { color: c.textFaint, fontSize: 10, fontWeight: '700' },
  achCheck: { position: 'absolute', top: 10, right: 10, color: '#1ed760', fontSize: 13, fontWeight: '900' },
});