import React, { useContext, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Linking, TextInput, BackHandler,
} from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { MusicContext } from '../context/MusicContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme, THEMES } from '../theme';
import { useT } from '../i18n';
import { resolveMediaUrl } from '../utils/mediaUrl';

function resolveSongsForPlaylist(playlist, type, allSongs) {
  if (type === 'folder') return playlist.songs || [];
  return allSongs.filter(s => playlist.songs?.includes(s.id));
}

function Section({ title, subtitle, children, onLayout, c, styles }) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={[styles.sectionBody, !title && !subtitle && styles.sectionBodyFirst]}>{children}</View>
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
    <View style={styles.downloadCard}>
      <View style={styles.downloadCardHeader}>
        <View style={[styles.downloadArtwork, { backgroundColor: playlist.coverColor || colors.bg4 }]}>
          {playlist.coverUrl
            ? <Image source={{ uri: resolveMediaUrl(SERVER_URL, playlist.coverUrl) }} style={styles.downloadArtworkImage} />
            : <Icon name="musical-notes" size={21} color={colors.text} />
          }
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.rowName} numberOfLines={2}>{playlist.name}</Text>
          <Text style={styles.rowSub}>{t('settings.downloads.songCount', count)}</Text>
        </View>
      </View>
      {downloading ? (
        <View style={styles.downloadStatus}>
          <View style={styles.downloadStatusIcon}><Icon name="download-outline" size={17} color="#1ed760" /></View>
          <Text style={styles.progressTag}>
          {progress ? t('settings.downloads.downloading', progress.done, progress.total) : '…'}
          </Text>
        </View>
      ) : downloaded ? (
        <View style={styles.downloadActions}>
          <View style={styles.downloadedStatus}>
            <Icon name="checkmark-circle" size={17} color="#1ed760" />
            <Text style={styles.downloadedTag}>{t('settings.downloads.downloaded')}</Text>
          </View>
          <TouchableOpacity style={styles.downloadRemoveBtn} onPress={() => removeOfflinePlaylist(playlist.id)}>
            <Text style={styles.dangerBtnText}>{t('settings.downloads.remove')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.downloadCardButton, !isOnline && styles.downloadBtnDisabled]}
          onPress={handleDownload}
          disabled={!isOnline || count === 0}
        >
          <Icon name="download-outline" size={17} color={isOnline && count > 0 ? '#000' : colors.textDim} />
          <Text style={[styles.downloadCardButtonText, (!isOnline || count === 0) && styles.downloadCardButtonTextDisabled]}>{t('settings.downloads.download')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DownloadedPlaylistRow({ playlist, onRemove, SERVER_URL, styles, colors, t }) {
  return (
    <View style={styles.downloadedCard}>
      <View style={[styles.downloadArtwork, { backgroundColor: playlist.coverColor || colors.bg4 }]}>
        {playlist.coverUrl
          ? <Image source={{ uri: resolveMediaUrl(SERVER_URL, playlist.coverUrl) }} style={styles.downloadArtworkImage} />
          : <Icon name="musical-notes" size={21} color={colors.text} />
        }
      </View>
      <View style={styles.downloadedCardMeta}>
        <Text style={styles.rowName} numberOfLines={2}>{playlist.name}</Text>
        <View style={styles.downloadedCardSub}>
          <Icon name="checkmark-circle" size={15} color="#1ed760" />
          <Text style={styles.downloadedTag}>{t('settings.downloads.songCount', playlist.songs?.length || 0)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.downloadedRemoveButton}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`${t('settings.downloads.remove')} ${playlist.name}`}
      >
        <Icon name="trash-outline" size={18} color="#ff6666" />
      </TouchableOpacity>
    </View>
  );
}

function StorageGlyph({ styles }) {
  return (
    <View style={styles.downloadStorageIcon} accessible={false}>
      <View style={styles.storageDrive}>
        <View style={styles.storageDriveSlot} />
        <View style={styles.storageDriveIndicator} />
      </View>
    </View>
  );
}

export default function SettingsScreen({ onLogout }) {
  const { playlists, folderPlaylists, songs, SERVER_URL } = useContext(MusicContext);
  const {
    profilePicture, uploadProfilePicture, removeProfilePicture,
    language, setLanguage, isOnline, offlinePlaylists, downloadedSongIds,
    cacheBytes, cacheSizeLabel, clearCache, removeOfflinePlaylist,
  } = useSettings();
  const {
    achievements, achievementsLoading, stats, statsLoading, fetchAchievements, fetchStats,
  } = useContext(MusicContext);
  const { theme, setTheme, colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [achSearch, setAchSearch] = useState('');
  const [achStatusFilter, setAchStatusFilter] = useState('all'); // all | unlocked | locked
  const [achCategoryFilter, setAchCategoryFilter] = useState('all');
  const [activeSection, setActiveSection] = useState(null);

  // Refresca logros/estadísticas cada vez que se entra en Ajustes (esta
  // pantalla se desmonta al cambiar de pestaña, así que esto equivale a
  // "refrescar al abrir", igual que en la app de PC).
  React.useEffect(() => {
    fetchAchievements();
    fetchStats();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!activeSection) return false;
      setActiveSection(null);
      return true;
    });
    return () => subscription.remove();
  }, [activeSection]);

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

  const SETTINGS_GROUPS = [
    {
      id: 'account',
      title: t('settings.group.account'),
      items: [
        { id: 'profile', icon: '👤', label: t('settings.index.profile'), hint: t('settings.index.profileHint') },
        { id: 'achievements', icon: '🏆', label: t('settings.index.achievements'), hint: t('settings.index.achievementsHint') },
      ],
    },
    {
      id: 'preferences',
      title: t('settings.group.preferences'),
      items: [
        { id: 'appearance', icon: '🎨', label: t('settings.index.appearance'), hint: t('settings.index.appearanceHint') },
        { id: 'downloads', icon: '⬇️', label: t('settings.index.downloads'), hint: t('settings.index.downloadsHint') },
      ],
    },
    {
      id: 'about',
      title: t('settings.group.about'),
      items: [
        { id: 'credits', icon: '✨', label: t('settings.index.credits'), hint: t('settings.index.creditsHint') },
      ],
    },
  ];
  const INDEX = SETTINGS_GROUPS.flatMap(group => group.items);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {activeSection ? (
          <TouchableOpacity style={styles.backHeader} onPress={() => setActiveSection(null)} accessibilityRole="button" accessibilityLabel={t('playlists.back')}>
            <Icon name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{activeSection ? INDEX.find(item => item.id === activeSection)?.label : t('settings.title')}</Text>
          {!activeSection && <Text style={styles.headerSub}>{t('settings.mobileHint')}</Text>}
        </View>
      </View>

      {!isOnline && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeText}>{t('offline.banner')}</Text>
        </View>
      )}

      {!activeSection ? (
        <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          {SETTINGS_GROUPS.map(group => (
            <View key={group.id} style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>{group.title}</Text>
              <View style={styles.menuGroup}>
                {group.items.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, index === group.items.length - 1 && styles.menuItemLast]}
                    onPress={() => setActiveSection(item.id)}
                    activeOpacity={0.65}
                    accessibilityRole="button"
                  >
                    <View style={styles.menuIcon}><Text style={styles.menuEmoji}>{item.icon}</Text></View>
                    <View style={styles.menuCopy}>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      <Text style={styles.menuHint} numberOfLines={1}>{item.hint}</Text>
                    </View>
                    <Icon name="chevron-forward" size={20} color={colors.textDim} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.logoutRow}
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel={t('settings.logout')}
          >
            <Icon name="log-out-outline" size={18} color="#ff5555" />
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </TouchableOpacity>
          <View style={styles.appInfo}>
            <Image source={require('../../assets/icon.png')} style={styles.appLogo} resizeMode="cover" />
            <View>
              <Text style={styles.appInfoName}>YFitops</Text>
              <Text style={styles.appInfoVersion}>v{appVersion}</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
      <ScrollView key={activeSection} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Perfil y resumen de escucha */}
        {activeSection === 'profile' && <>
          <Section c={colors} styles={styles}>
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
            <Text style={styles.profilePrivacy}>{t('settings.profile.subtitle')}</Text>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </Section>

          <Section c={colors} styles={styles} title={t('settings.stats.title')} subtitle={t('settings.stats.subtitle')}>
            <View style={styles.statsGrid}>
              {statCards.map((s, i) => (
                <View key={i} style={styles.statCard}>
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{s.value}</Text>
                  <Text style={styles.statLabel} numberOfLines={2}>{s.label}</Text>
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
          </Section>
        </>}

        {/* Logros */}
        {activeSection === 'achievements' && <Section c={colors} styles={styles} subtitle={t('settings.achievements.subtitle')}>
          <View style={styles.achHeadRow}>
            <Text style={styles.achTitle}>{t('settings.achievements.progressTitle')}</Text>
            <View style={styles.achBadgeCount}>
              <Text style={styles.achBadgeCountText}>{t('settings.achievements.unlocked', achUnlockedCount, achievements.length)}</Text>
            </View>
          </View>
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
        </Section>}

        {/* Apariencia */}
        {activeSection === 'appearance' && <Section c={colors} styles={styles} title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')}>
          <View style={styles.themeBlock}>
            <Text style={styles.toggleLabel}>{t('settings.appearance.themeLabel', t(`theme.${theme}`))}</Text>
            <Text style={styles.toggleHint}>{t('settings.appearance.themeHint')}</Text>
            <View style={styles.themePicker}>
              {THEMES.map((themeDef, index) => {
                const isActive = theme === themeDef.id;
                return (
                  <TouchableOpacity
                    key={themeDef.id}
                    style={[
                      styles.themeSwatchBtn,
                      THEMES.length % 3 === 2 && index === THEMES.length - 2 && styles.themeSwatchBtnLastRowStart,
                      isActive && styles.themeSwatchBtnActive,
                    ]}
                    onPress={() => setTheme(themeDef.id)}
                    accessibilityLabel={t(`theme.${themeDef.id}`)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
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
                    <Text style={[styles.themeSwatchLabel, isActive && styles.themeSwatchLabelActive]} numberOfLines={1}>{t(`theme.${themeDef.id}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.languageBlock}>
            <View>
              <Text style={styles.toggleLabel}>{t('settings.appearance.languageLabel')}</Text>
              <Text style={styles.toggleHint}>{t('settings.appearance.languageHint')}</Text>
            </View>
            <View style={styles.languageSelector}>
              {['es', 'en'].map(lang => {
                const isActive = language === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.languageOption, isActive && styles.languageOptionActive]}
                    onPress={() => setLanguage(lang)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.languageCode, isActive && styles.langChipTextActive]}>{lang.toUpperCase()}</Text>
                    <Text style={[styles.languageName, isActive && styles.langChipTextActive]}>{t(`settings.language.${lang}`)}</Text>
                    {isActive && <Icon name="checkmark-circle" size={17} color="#1ed760" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>}

        {/* Descargas offline */}
        {activeSection === 'downloads' && <Section c={colors} styles={styles} title={t('settings.downloads.title')} subtitle={t('settings.downloads.subtitle')}>
          <View style={styles.downloadStorageCard}>
            <View style={styles.downloadStorageHeader}>
              <StorageGlyph styles={styles} />
              <View style={styles.downloadStorageMeta}>
                <Text style={styles.downloadStorageLabel}>{t('settings.downloads.storageUsed')}</Text>
                <Text style={styles.downloadStorageSize}>{cacheSizeLabel()}</Text>
              </View>
            </View>
            <View style={styles.downloadStorageStats}>
              <View style={styles.downloadStorageStat}>
                <Text style={styles.downloadStorageStatValue}>{totalOfflineCount}</Text>
                <Text style={styles.downloadStorageStatLabel}>{t('settings.downloads.savedCollections')}</Text>
              </View>
              <View style={styles.downloadStorageDivider} />
              <View style={styles.downloadStorageStat}>
                <Text style={styles.downloadStorageStatValue}>{downloadedSongIds.length}</Text>
                <Text style={styles.downloadStorageStatLabel}>{t('settings.downloads.savedSongs')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.clearDownloadsButton, (cacheBytes === 0 || clearing) && styles.disabledBtn]}
              onPress={handleClearCache}
              disabled={cacheBytes === 0 || clearing}
              accessibilityRole="button"
            >
              <Icon name="trash-outline" size={17} color={cacheBytes === 0 ? colors.textDim : '#ff6666'} />
              <Text style={[styles.clearDownloadsText, cacheBytes === 0 && styles.clearDownloadsTextDisabled]}>
                {clearing ? t('settings.downloads.clearing') : confirmClear ? t('settings.downloads.confirmClear') : t('settings.downloads.clearAll')}
              </Text>
            </TouchableOpacity>
            {confirmClear && (
              <TouchableOpacity style={styles.cancelClearButton} onPress={() => setConfirmClear(false)}>
                <Text style={styles.linkText}>{t('settings.downloads.cancelClear')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {offlinePlaylists.length > 0 && (
            <>
              <Text style={styles.downloadGroupTitle}>{t('settings.downloads.savedTitle')}</Text>
              {offlinePlaylists.map(pl => (
                <DownloadedPlaylistRow
                  key={`offline-${pl.id}`}
                  playlist={pl}
                  onRemove={() => removeOfflinePlaylist(pl.id)}
                  SERVER_URL={SERVER_URL}
                  styles={styles}
                  colors={colors}
                  t={t}
                />
              ))}
            </>
          )}

          {(folderPlaylists.some(pl => !offlinePlaylists.some(saved => saved.id === pl.id))
            || playlists.some(pl => !offlinePlaylists.some(saved => saved.id === pl.id))) && (
            <Text style={styles.downloadGroupTitle}>{t('settings.downloads.availableTitle')}</Text>
          )}
          {folderPlaylists.length === 0 && playlists.length === 0 && (
            <View style={styles.downloadEmpty}>
              <Icon name="download-outline" size={28} color={colors.textDim} />
              <Text style={styles.emptyHint}>{t('settings.downloads.none')}</Text>
            </View>
          )}
          {folderPlaylists.some(pl => !offlinePlaylists.some(saved => saved.id === pl.id)) && <Text style={styles.downloadGroupTitle}>{t('settings.downloads.folders')}</Text>}
          {folderPlaylists.filter(pl => !offlinePlaylists.some(saved => saved.id === pl.id)).map(pl => (
            <DownloadableRow key={`f-${pl.id}`} playlist={pl} type="folder" allSongs={songs} isOnline={isOnline} SERVER_URL={SERVER_URL} styles={styles} colors={colors} />
          ))}
          {playlists.some(pl => !offlinePlaylists.some(saved => saved.id === pl.id)) && <Text style={styles.downloadGroupTitle}>{t('settings.downloads.playlists')}</Text>}
          {playlists.filter(pl => !offlinePlaylists.some(saved => saved.id === pl.id)).map(pl => (
            <DownloadableRow key={`m-${pl.id}`} playlist={pl} type="manual" allSongs={songs} isOnline={isOnline} SERVER_URL={SERVER_URL} styles={styles} colors={colors} />
          ))}
        </Section>}

        {/* Créditos */}
        {activeSection === 'credits' && <View style={styles.creditsPage}>
          <View style={styles.creditsHero}>
            <Image source={require('../../assets/icon.png')} style={styles.creditsLogo} resizeMode="cover" />
            <Text style={styles.creditsHeadline}>{t('settings.credits.headline')}</Text>
            <Text style={styles.creditsText}>{t('settings.credits.text')}</Text>
          </View>
          <View style={styles.creditsByline}>
            <Text style={styles.creditsEyebrow}>{t('settings.credits.madeBy')}</Text>
            <Text style={styles.creditsAuthor}>Rexy</Text>
            <Text style={styles.creditsText}>{t('settings.credits.authorText')}</Text>
          </View>
          <View style={styles.creditsByline}>
            <Text style={styles.creditsEyebrow}>{t('settings.credits.project')}</Text>
            <Text style={styles.creditsText}>{t('settings.credits.projectText')}</Text>
          </View>
          <View style={styles.creditsLinks}>
            <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL('https://github.com/Rexyto/yfitops')}>
              <Text style={styles.linkChipText}>{t('settings.credits.source')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL('https://github.com/Rexyto')}>
              <Text style={styles.linkChipText}>{t('settings.credits.author')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.creditsVersion}>YFitops · v{appVersion}</Text>
        </View>}

      </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 18 },
  headerText: { flex: 1, minWidth: 0 },
  backHeader: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.bg3, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: c.text, letterSpacing: -0.6 },
  headerSub: { fontSize: 13, color: c.textDim, marginTop: 4, fontWeight: '500' },
  menuScroll: { flex: 1 },
  menuContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 },
  menuSection: { marginBottom: 22 },
  menuSectionTitle: { color: c.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 4, marginBottom: 4 },
  menuGroup: { paddingHorizontal: 4 },
  menuItem: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border, gap: 12 },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  menuEmoji: { fontSize: 19 },
  menuCopy: { flex: 1, minWidth: 0, paddingVertical: 10 },
  menuLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  menuHint: { color: c.textDim, fontSize: 11, marginTop: 3 },
  appInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, marginBottom: 8 },
  appLogo: { width: 64, height: 42, borderRadius: 8, backgroundColor: '#080b18' },
  appInfoName: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  appInfoVersion: { color: c.textDim, fontSize: 11, marginTop: 2 },

  offlineNotice: { marginHorizontal: 12, marginTop: 8, padding: 12, backgroundColor: '#ff555518', borderWidth: 1, borderColor: '#ff555540', borderRadius: 12 },
  offlineNoticeText: { color: '#ff8080', fontSize: 12.5, fontWeight: '600' },

  section: { marginHorizontal: 16, marginBottom: 0, marginTop: 4, backgroundColor: c.bg2, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 18 },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  sectionSubtitle: { color: c.textDim, fontSize: 12, lineHeight: 17, marginTop: 5 },
  sectionBody: { marginTop: 12, gap: 12 },
  sectionBodyFirst: { marginTop: 0 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  themePicker: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8, paddingTop: 4 },
  themeSwatchBtn: { width: '31%', minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 12, paddingVertical: 9 },
  themeSwatchBtnLastRowStart: { marginLeft: '17%' },
  themeSwatchBtnActive: { backgroundColor: '#1ed76012', borderColor: '#1ed76080' },
  themeSwatchWrap: { padding: 2, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: '#1ed760' },
  themeSwatch: { width: 34, height: 34, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.borderStrong },
  themeSwatchCheck: { color: '#1ed760', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  themeSwatchLabel: { color: c.textDim, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  themeSwatchLabelActive: { color: '#1ed760' },

  languageBlock: { gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14 },
  languageSelector: { gap: 8 },
  languageOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 10, paddingHorizontal: 12 },
  languageOptionActive: { backgroundColor: '#1ed76015', borderColor: '#1ed76060' },
  languageCode: { width: 30, color: c.textMuted, fontWeight: '800', fontSize: 12 },
  languageName: { flex: 1, color: c.textMuted, fontWeight: '600', fontSize: 13 },
  langChipTextActive: { color: '#1ed760' },

  emptyHint: { color: c.textDim, fontSize: 13 },
  downloadGroupTitle: { color: c.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  downloadEmpty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  downloadStorageCard: { backgroundColor: c.bg2, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 16, padding: 15, gap: 14 },
  downloadStorageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  downloadStorageIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1ed76012', borderWidth: 1, borderColor: '#1ed76030', alignItems: 'center', justifyContent: 'center' },
  storageDrive: { width: 25, height: 20, borderRadius: 6, borderWidth: 1.8, borderColor: '#1ed760', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  storageDriveSlot: { position: 'absolute', top: 5, width: 14, height: 1.5, borderRadius: 1, backgroundColor: '#1ed76090' },
  storageDriveIndicator: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#1ed760', alignSelf: 'flex-end', marginRight: 4 },
  downloadStorageMeta: { flex: 1 },
  downloadStorageLabel: { color: c.textDim, fontSize: 12, fontWeight: '600' },
  downloadStorageSize: { color: c.text, fontSize: 23, fontWeight: '800', marginTop: 2 },
  downloadStorageStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg3, borderRadius: 11, paddingVertical: 12 },
  downloadStorageStat: { flex: 1, alignItems: 'center', gap: 3 },
  downloadStorageStatValue: { color: c.text, fontSize: 16, fontWeight: '800' },
  downloadStorageStatLabel: { color: c.textDim, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  downloadStorageDivider: { width: 1, height: 29, backgroundColor: c.borderStrong },
  clearDownloadsButton: { minHeight: 42, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#ff555510', borderWidth: 1, borderColor: '#ff555540', borderRadius: 10 },
  clearDownloadsText: { color: '#ff6666', fontSize: 12, fontWeight: '700' },
  clearDownloadsTextDisabled: { color: c.textDim },
  cancelClearButton: { paddingVertical: 4 },
  downloadedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 14, padding: 11 },
  downloadedCardMeta: { flex: 1, minWidth: 0 },
  downloadedCardSub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  downloadedRemoveButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ff555510', alignItems: 'center', justifyContent: 'center' },
  downloadCard: { backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 14, padding: 12, gap: 12 },
  downloadCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  downloadArtwork: { width: 54, height: 54, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  downloadArtworkImage: { width: '100%', height: '100%' },
  rowMeta: { flex: 1, minWidth: 0 },
  rowName: { color: c.textSecondary, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  rowSub: { color: c.textDim, fontSize: 12, marginTop: 3 },
  downloadStatus: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.bg4, borderRadius: 9, paddingHorizontal: 12 },
  downloadStatusIcon: { alignItems: 'center', justifyContent: 'center' },
  progressTag: { color: c.textDim, fontSize: 12, fontWeight: '700' },
  downloadedStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  downloadedTag: { color: '#1ed760', fontSize: 12, fontWeight: '700' },
  downloadActions: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, backgroundColor: c.bg4, borderRadius: 9, paddingHorizontal: 12 },
  downloadCardButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1ed760', borderRadius: 9, paddingHorizontal: 14 },
  downloadCardButtonText: { color: '#000', fontSize: 13, fontWeight: '800' },
  downloadCardButtonTextDisabled: { color: c.textDim },
  downloadRemoveBtn: { borderWidth: 1, borderColor: '#ff555540', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  downloadBtnDisabled: { opacity: 0.4 },
  dangerBtnText: { color: '#ff5555', fontSize: 12, fontWeight: '700' },

  disabledBtn: { opacity: 0.4 },
  linkText: { color: c.textDim, fontSize: 12, textDecorationLine: 'underline', textAlign: 'center' },

  creditsPage: { marginHorizontal: 16, gap: 12, paddingBottom: 24 },
  creditsHero: { alignItems: 'center', backgroundColor: c.bg2, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 22 },
  creditsLogo: { width: '100%', height: 110, borderRadius: 14, backgroundColor: '#080b18', marginBottom: 18 },
  creditsHeadline: { color: c.text, fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  creditsByline: { backgroundColor: c.bg2, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 18, gap: 6 },
  creditsEyebrow: { color: '#1ed760', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  creditsAuthor: { color: c.text, fontSize: 19, fontWeight: '800' },
  creditsText: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  creditsLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkChip: { backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  linkChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  creditsVersion: { color: c.textDim, fontSize: 11, textAlign: 'center', marginTop: 8 },

  logoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 12, marginTop: 16, marginBottom: 24, minHeight: 48, backgroundColor: '#ff555510', borderWidth: 1, borderColor: '#ff555530', borderRadius: 12 },
  logoutText: { color: '#ff4444', fontWeight: '700', fontSize: 14 },

  // Estadísticas
  profilePrivacy: { color: c.textDim, fontSize: 11, lineHeight: 15, marginTop: 10 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: 94,
    backgroundColor: c.bg3, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 10,
  },
  statIcon: { fontSize: 17, marginBottom: 4 },
  statValue: { color: c.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  statLabel: { color: c.textDim, fontSize: 9.5, fontWeight: '600', marginTop: 3, textAlign: 'center' },

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