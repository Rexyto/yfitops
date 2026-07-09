import React, { useContext, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Image, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { MusicContext } from '../context/MusicContext';
import PlayerModal from './PlayerModal';
import { useTheme } from '../theme';

export default function PlayerBar() {
  const { currentSong, isPlaying, position, duration, pauseSong, resumeSong, playNext, playPrevious, SERVER_URL } = useContext(MusicContext);
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (!currentSong) return null;

  const progress = duration > 0 ? position / duration : 0;
  const cover = currentSong.coverUrl ? `${SERVER_URL}${currentSong.coverUrl}` : null;

  // NAV_HEIGHT = altura del tab bar (60 aprox) + inset inferior del sistema
  const NAV_HEIGHT = 60 + insets.bottom;

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { bottom: NAV_HEIGHT + 8 }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.95}
      >
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.row}>
          {cover
            ? <Image source={{ uri: cover }} style={styles.cover} />
            : <View style={[styles.cover, styles.coverEmpty]}>
                <Icon name="musical-note" size={20} color={colors.textFaint} />
              </View>
          }
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity onPress={e => { e.stopPropagation?.(); playPrevious(); }} style={styles.btn}>
              <Icon name="play-skip-back" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={e => { e.stopPropagation?.(); isPlaying ? pauseSong() : resumeSong(); }} style={[styles.btn, styles.playBtn]}>
              <Icon name={isPlaying ? 'pause' : 'play'} size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={e => { e.stopPropagation?.(); playNext(); }} style={styles.btn}>
              <Icon name="play-skip-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)} statusBarTranslucent>
        <PlayerModal onClose={() => setModalVisible(false)} />
      </Modal>
    </>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    backgroundColor: c.bg3,
    borderRadius: 14,
    elevation: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  progressTrack: { height: 4, backgroundColor: c.bg4 },
  progressFill: { height: 4, backgroundColor: '#1ed760' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  cover: { width: 42, height: 42, borderRadius: 8, marginRight: 10 },
  coverEmpty: { backgroundColor: c.bg4, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginRight: 8 },
  title: { color: c.text, fontSize: 14, fontWeight: '700' },
  artist: { color: c.textDim, fontSize: 12, marginTop: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  playBtn: { backgroundColor: '#1ed760', width: 38, height: 38, borderRadius: 19 },
});
