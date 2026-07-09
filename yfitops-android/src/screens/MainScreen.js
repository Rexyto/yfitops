import React, { useState, useContext } from 'react';
import Icon from '../components/Icon';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
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
  const { currentSong, onLogout: ctxLogout } = useContext(MusicContext);
  const doLogout = onLogout || ctxLogout;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  const TABS = [
    { key: 'songs', labelKey: 'nav.songs', icon: 'grid', iconActive: 'grid' },
    { key: 'favorites', labelKey: 'nav.favorites', icon: 'heart-outline', iconActive: 'heart' },
    { key: 'playlists', labelKey: 'nav.playlists', icon: 'list-outline', iconActive: 'list' },
    { key: 'settings', labelKey: 'nav.settings', icon: 'settings-outline', iconActive: 'settings-outline' },
  ];

  const renderScreen = () => {
    if (tab === 'songs') return <SongsScreen />;
    if (tab === 'favorites') return <FavoritesScreen />;
    if (tab === 'playlists') return <PlaylistsScreen />;
    return <SettingsScreen onLogout={doLogout} />;
  };

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>

      {currentSong && <PlayerBar />}

      <View style={[styles.nav, { paddingBottom: insets.bottom + 8 }]}>
        {TABS.map(tabDef => {
          const active = tab === tabDef.key;
          return (
            <TouchableOpacity key={tabDef.key} style={styles.navItem} onPress={() => setTab(tabDef.key)}>
              <Icon name={active ? tabDef.iconActive : tabDef.icon} size={24} color={active ? '#1ed760' : colors.textFaint} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{t(tabDef.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  nav: {
    flexDirection: 'row',
    backgroundColor: c.bg1,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 10, color: c.textFaint, fontWeight: '600', letterSpacing: 0.3 },
  navLabelActive: { color: '#1ed760' },
});
