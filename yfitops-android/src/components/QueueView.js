import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, FlatList } from 'react-native';
import Icon from './Icon';
import { MusicContext } from '../context/MusicContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';

const fmt = (s) => {
  if (!s || s < 1) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function QueueView({ visible, onClose }) {
  const { queue, removeFromQueue, moveQueueItem, clearQueue, playFromQueue, currentSong, SERVER_URL } = useContext(MusicContext);
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('queue.title')}</Text>
              <Text style={styles.sub}>{t('queue.waiting', queue.length)}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Icon name="close-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {currentSong && (
            <View style={styles.nowPlaying}>
              <Text style={styles.nowPlayingLabel}>{t('queue.nowPlayingLabel')}</Text>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>{currentSong.title}</Text>
            </View>
          )}

          {queue.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearQueue}>
              <Text style={styles.clearBtnText}>{t('queue.clear')}</Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={queue}
            keyExtractor={(song, index) => `${song.id}-${index}`}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item: song, index }) => {
              const cover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;
              return (
                <View style={styles.row}>
                  <Text style={styles.idx}>{index + 1}</Text>
                  {cover
                    ? <Image source={{ uri: cover }} style={styles.cover} />
                    : <View style={[styles.cover, styles.coverEmpty]}><Text style={{ color: colors.textFaint }}>♪</Text></View>
                  }
                  <TouchableOpacity style={styles.meta} onPress={() => playFromQueue(index)}>
                    <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.songArtist} numberOfLines={1}>{song.artist} · {fmt(song.duration)}</Text>
                  </TouchableOpacity>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, index === 0 && styles.actionBtnDisabled]}
                      disabled={index === 0}
                      onPress={() => moveQueueItem(index, index - 1)}
                    >
                      <Text style={styles.actionBtnText}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, index === queue.length - 1 && styles.actionBtnDisabled]}
                      disabled={index === queue.length - 1}
                      onPress={() => moveQueueItem(index, index + 1)}
                    >
                      <Text style={styles.actionBtnText}>↓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => removeFromQueue(index)}>
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
      </View>
    </Modal>
  );
}

const makeStyles = (c) => StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: {
    width: '82%', maxWidth: 380, height: '100%',
    backgroundColor: c.bg2, borderLeftWidth: 1, borderLeftColor: c.border,
    paddingTop: 52, paddingBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  title: { color: c.text, fontSize: 18, fontWeight: '800' },
  sub: { color: c.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  nowPlaying: { marginHorizontal: 20, marginBottom: 14, padding: 12, backgroundColor: '#1ed76015', borderWidth: 1, borderColor: '#1ed76030', borderRadius: 10 },
  nowPlayingLabel: { color: '#1ed760', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  nowPlayingTitle: { color: c.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
  clearBtn: { marginHorizontal: 20, marginBottom: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: c.borderStrong, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  clearBtnText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  idx: { width: 20, color: c.textDim, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cover: { width: 40, height: 40, borderRadius: 6 },
  coverEmpty: { backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  meta: { flex: 1, minWidth: 0 },
  songTitle: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  songArtist: { color: c.textDim, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 2 },
  actionBtn: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  actionBtnDisabled: { opacity: 0.3 },
  actionBtnText: { color: c.textDim, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 4, paddingHorizontal: 24 },
  emptyTitle: { color: c.text, fontWeight: '700', fontSize: 15, marginTop: 10 },
  emptySub: { color: c.textDim, fontSize: 13, textAlign: 'center' },
});
