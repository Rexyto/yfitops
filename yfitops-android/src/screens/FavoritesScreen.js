import React, { useContext } from 'react';
import Icon from '../components/Icon';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MusicContext } from '../context/MusicContext';
import SongItem from '../components/SongItem';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function FavoritesScreen() {
  const { songs, favorites, playSong, toggleFavorite, currentSong, SERVER_URL, getAllSongs, addManyToQueue } = useContext(MusicContext);
  const allSongs = (getAllSongs ? getAllSongs() : songs) || [];
  const favSongs = allSongs.filter(s => favorites.includes(s.id));
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('favorites.title')}</Text>
          <Text style={styles.headerSub}>{t('favorites.count', favSongs.length)}</Text>
        </View>
        {favSongs.length > 0 && (
          <TouchableOpacity style={styles.queueAllBtn} onPress={() => addManyToQueue(favSongs)}>
            <Text style={styles.queueAllBtnText}>+ {t('player.queue')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={favSongs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SongItem
            song={item}
            isFavorite={true}
            onPress={() => playSong(item, favSongs)}
            onFavoritePress={() => toggleFavorite(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤍</Text>
            <Text style={styles.emptyTitle}>{t('favorites.empty')}</Text>
            <Text style={styles.emptySubtitle}>{t('favorites.emptyHint')}</Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 10 },
  queueAllBtn: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  queueAllBtnText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: c.textDim, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  list: { paddingBottom: 160 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: c.textDim, textAlign: 'center', lineHeight: 22 },
});
