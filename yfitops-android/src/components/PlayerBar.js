import React, { useContext, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Image, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { MusicContext, usePlaybackProgress } from '../context/MusicContext';
import PlayerModal from './PlayerModal';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { resolveMediaUrl } from '../utils/mediaUrl';

export default function PlayerBar() {
  const { currentSong, isPlaying, pauseSong, resumeSong, playNext, playPrevious, SERVER_URL } = useContext(MusicContext);
  const { position, duration } = usePlaybackProgress();
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  if (!currentSong) return null;

  const progress = duration > 0 ? position / duration : 0;
  const cover = resolveMediaUrl(SERVER_URL, currentSong.coverUrl);

  // NAV_HEIGHT = altura del tab bar (60 aprox) + inset inferior del sistema
  const NAV_HEIGHT = 59 + insets.bottom;

  return (
    <>
      <View style={[styles.container, { bottom: NAV_HEIGHT + 8 }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('player.open', currentSong.title)}
          >
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
          </TouchableOpacity>
          <TouchableOpacity
            onPress={playPrevious}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel={t('player.previous')}
            hitSlop={6}
          >
            <Icon name="play-skip-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={isPlaying ? pauseSong : resumeSong}
            style={styles.playBtn}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t('player.pause') : t('player.play')}
            hitSlop={8}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={23} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={playNext}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel={t('player.next')}
            hitSlop={6}
          >
            <Icon name="play-skip-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)} statusBarTranslucent>
        <PlayerModal onClose={() => setModalVisible(false)} />
      </Modal>
    </>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: c.bg3,
    borderRadius: 12,
    elevation: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  progressTrack: { height: 2, backgroundColor: c.bg4 },
  progressFill: { height: 2, backgroundColor: '#1ed760' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: 8, paddingRight: 6 },
  trackButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  cover: { width: 48, height: 48, borderRadius: 6, marginRight: 10 },
  coverEmpty: { backgroundColor: c.bg4, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, minWidth: 0, marginRight: 8 },
  title: { color: c.text, fontSize: 13, fontWeight: '700' },
  artist: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  skipBtn: { width: 34, height: 48, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 40, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 24 },
});
