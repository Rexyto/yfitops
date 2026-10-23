import React, { useContext, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { MusicContext } from '../context/MusicContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { resolveMediaUrl } from '../utils/mediaUrl';

const fmt = (s) => {
  if (!s || s < 1) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function QueueView({ visible, onClose }) {
  const {
    queue, removeFromQueue, moveQueueItem, clearQueue, playFromQueue,
    currentSong, SERVER_URL,
  } = useContext(MusicContext);
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const upcomingItems = useMemo(() => [
    ...(queue.length ? [{ type: 'section', key: 'queue-section', title: t('queue.upNext') }] : []),
    ...queue.map((song, index) => ({ type: 'queued', key: `queued-${song._queueEntryId || song.id}-${index}`, song, index })),
  ], [queue, t]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('queue.title')}</Text>
            <Text style={styles.sub}>{t('queue.waiting', queue.length)}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('queue.close')}>
            <Icon name="close-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {currentSong && (
          <View style={styles.nowPlaying}>
            <Text style={styles.nowPlayingLabel}>{t('queue.nowPlayingLabel')}</Text>
            <View style={styles.currentTrack}>
              {currentSong.coverUrl
                ? <Image source={{ uri: resolveMediaUrl(SERVER_URL, currentSong.coverUrl) }} style={styles.cover} />
                : <View style={[styles.cover, styles.coverEmpty]}><Text style={{ color: colors.textFaint }}>♪</Text></View>
              }
              <View style={styles.meta}>
                <Text style={styles.nowPlayingTitle} numberOfLines={1}>{currentSong.title}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
              </View>
              <Icon name="volume-high" size={18} color="#1ed760" />
            </View>
          </View>
        )}

        {queue.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearQueue}>
            <Text style={styles.clearBtnText}>{t('queue.clear')}</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={upcomingItems}
          keyExtractor={item => item.key}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return <Text style={styles.sectionTitle}>{item.title}</Text>;
            }
            const { song, index } = item;
            const cover = resolveMediaUrl(SERVER_URL, song.coverUrl);
            return (
              <View style={styles.row}>
                <Text style={styles.idx}>{index + 1}</Text>
                {cover
                  ? <Image source={{ uri: cover }} style={styles.cover} />
                  : <View style={[styles.cover, styles.coverEmpty]}><Text style={{ color: colors.textFaint }}>♪</Text></View>
                }
                <TouchableOpacity
                  style={styles.meta}
                  onPress={() => playFromQueue(index)}
                >
                  <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                  <Text style={styles.songArtist} numberOfLines={1}>{song.artist} · {fmt(song.duration)}</Text>
                </TouchableOpacity>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, index === 0 && styles.actionBtnDisabled]}
                    disabled={index === 0}
                    onPress={() => moveQueueItem(index, index - 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('queue.moveUp')}
                  >
                    <Text style={styles.actionBtnText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, index === queue.length - 1 && styles.actionBtnDisabled]}
                    disabled={index === queue.length - 1}
                    onPress={() => moveQueueItem(index, index + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('queue.moveDown')}
                  >
                    <Text style={styles.actionBtnText}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => removeFromQueue(index)}
                    accessibilityRole="button"
                    accessibilityLabel={t('queue.remove')}
                  >
                    <Text style={[styles.actionBtnText, { color: '#ff5555' }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🗒️</Text>
              <Text style={styles.emptyTitle}>{t('queue.empty')}</Text>
              <Text style={styles.emptySub}>{t('queue.emptyHint')}</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const makeStyles = (c) => StyleSheet.create({
  panel: {
    flex: 1, width: '100%', backgroundColor: c.bg1, paddingHorizontal: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18 },
  title: { color: c.text, fontSize: 24, fontWeight: '800' },
  sub: { color: c.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  nowPlaying: { marginBottom: 12, padding: 14, backgroundColor: c.bg3, borderRadius: 12 },
  nowPlayingLabel: { color: c.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  currentTrack: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowPlayingTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  clearBtn: { marginBottom: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: c.borderStrong, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  clearBtnText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '800', paddingTop: 18, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  idx: { width: 20, color: c.textDim, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cover: { width: 48, height: 48, borderRadius: 6 },
  coverEmpty: { backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  meta: { flex: 1, minWidth: 0 },
  songTitle: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  songArtist: { color: c.textDim, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: 15 },
  actionBtnDisabled: { opacity: 0.3 },
  actionBtnText: { color: c.textDim, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 4, paddingHorizontal: 24 },
  emptyTitle: { color: c.text, fontWeight: '700', fontSize: 15, marginTop: 10 },
  emptySub: { color: c.textDim, fontSize: 13, textAlign: 'center' },
});
