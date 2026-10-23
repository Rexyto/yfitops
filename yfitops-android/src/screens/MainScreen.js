import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import Icon from '../components/Icon';
import { View, StyleSheet, TouchableOpacity, Text, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SongsScreen from './SongsScreen';
import FavoritesScreen from './FavoritesScreen';
import PlaylistsScreen from './PlaylistsScreen';
import SettingsScreen from './SettingsScreen';
import PlayerBar from '../components/PlayerBar';
import { MusicContext } from '../context/MusicContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function MainScreen({ onLogout }) {
  const [tab, setTab] = useState('songs');
  const tabRef = useRef(tab);
  const { currentSong, onLogout: ctxLogout } = useContext(MusicContext);
  const doLogout = onLogout || ctxLogout;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  const backToLibrary = useCallback(() => setTab('songs'), []);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tabRef.current === 'songs') return false;
      backToLibrary();
      return true;
    });
    return () => subscription.remove();
  }, [backToLibrary]);

  const TABS = [
    { key: 'songs', labelKey: 'nav.songs', icon: 'grid', iconActive: 'grid' },
    { key: 'favorites', labelKey: 'nav.favorites', icon: 'heart-outline', iconActive: 'heart' },
    { key: 'playlists', labelKey: 'nav.playlists', icon: 'list-outline', iconActive: 'list' },
    { key: 'settings', labelKey: 'nav.settings', icon: 'settings-outline', iconActive: 'settings-outline' },
  ];

  const renderScreen = () => {
    if (tab === 'songs') return <SongsScreen />;
    if (tab === 'favorites') return <FavoritesScreen />;
    if (tab === 'playlists') return <PlaylistsScreen onBackToLibrary={backToLibrary} />;
    return <SettingsScreen onLogout={doLogout} />;
  };

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>

      {currentSong && <PlayerBar />}

      <View style={[styles.nav, { paddingBottom: insets.bottom }]}>
        <View style={styles.navInner}>
          {TABS.map(tabDef => {
            const active = tab === tabDef.key;
            return (
              <TouchableOpacity
                key={tabDef.key}
                style={styles.navItem}
                onPress={() => setTab(tabDef.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(tabDef.labelKey)}
              >
                <View style={styles.navIconWrap}>
                  <Icon name={active ? tabDef.iconActive : tabDef.icon} size={22} color={active ? '#1ed760' : colors.textMuted} />
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{t(tabDef.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  nav: {
    backgroundColor: c.bg1,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  navInner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 4,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50, gap: 1 },
  navIconWrap: { width: 54, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, color: c.textMuted, fontWeight: '500' },
  navLabelActive: { color: c.text, fontWeight: '700' },
});
