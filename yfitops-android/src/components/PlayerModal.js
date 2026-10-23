import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Alert, StatusBar, TouchableOpacity, ScrollView, useWindowDimensions, PanResponder } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Icon from './Icon';
import QueueView from './QueueView';
import { MusicContext, usePlaybackProgress } from '../context/MusicContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { resolveMediaUrl } from '../utils/mediaUrl';

function SeekBar({ position, duration, onSeek, onSeekingChange, onPreviewChange, styles }) {
  const trackWidth = useRef(1);
  const propsRef = useRef(null);
  propsRef.current = { duration, onSeek, onSeekingChange, onPreviewChange };
  const positionFromTouch = event => {
    const ratio = Math.max(0, Math.min(1, (event.nativeEvent.locationX - 8) / trackWidth.current));
    return ratio * propsRef.current.duration;
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => propsRef.current.duration > 0,
    onStartShouldSetPanResponderCapture: () => propsRef.current.duration > 0,
    onMoveShouldSetPanResponder: () => propsRef.current.duration > 0,
    onMoveShouldSetPanResponderCapture: () => propsRef.current.duration > 0,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      propsRef.current.onSeekingChange(true);
      propsRef.current.onPreviewChange(positionFromTouch(event));
    },
    onPanResponderMove: (event) => {
      propsRef.current.onPreviewChange(positionFromTouch(event));
    },
    onPanResponderRelease: async (event) => {
      const value = positionFromTouch(event);
      propsRef.current.onPreviewChange(value);
      try {
        await propsRef.current.onSeek(value);
      } finally {
        propsRef.current.onSeekingChange(false);
      }
    },
    onPanResponderTerminate: () => propsRef.current.onSeekingChange(false),
  }), []);

  const progress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;

  return (
    <View
      {...panResponder.panHandlers}
      style={styles.sliderTouch}
      onLayout={event => { trackWidth.current = Math.max(1, event.nativeEvent.layout.width - 16); }}
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityValue={{ min: 0, max: duration, now: position }}
    >
      <View pointerEvents="none" style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${progress * 100}%` }]} />
        <View style={[styles.sliderThumb, { left: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

export default function PlayerModal({ onClose }) {
  const { currentSong, isPlaying, isLooping, pauseSong, resumeSong, playNext, playPrevious, seekTo, toggleLoop, toggleFavorite, favorites, uploadCover, SERVER_URL, queue } = useContext(MusicContext);
  const { position, duration } = usePlaybackProgress();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [queueVisible, setQueueVisible] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(position);
  const isSeekingRef = useRef(false);

  useEffect(() => {
    if (!isSeekingRef.current) setPreviewPosition(position);
  }, [position]);

  if (!currentSong) return null;

  const fmt = (ms) => {
    if (!ms || ms <= 0) return '0:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const isFav = favorites.includes(currentSong.id);
  const cover = resolveMediaUrl(SERVER_URL, currentSong.coverUrl);
  const coverSize = Math.min(width - 48, Math.max(190, height * 0.4));
  const displayedPosition = isSeeking ? previewPosition : position;
  const queueCount = queue.length;

  const handleChangeCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t('song.noPermission')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      try { await uploadCover(currentSong.id, result.assets[0].uri); }
      catch { Alert.alert(t('login.errorTitle'), t('song.uploadError')); }
    }
  };

  return (
    <LinearGradient colors={[colors.bg3, colors.bg1, colors.bg0]} style={styles.container}>
      <StatusBar barStyle={colors.statusBar === 'light' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg3} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.content, { minHeight: height - insets.top - insets.bottom, paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isSeeking}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={t('player.minimize')}>
              <Icon name="chevron-down" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerLabel}>{t('player.nowPlaying')}</Text>
            <TouchableOpacity onPress={() => setQueueVisible(true)} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={t('player.queue')}>
              <Icon name="list-outline" size={22} color={colors.text} />
              {queueCount > 0 && (
                <View style={styles.queueBadge}>
                  <Text style={styles.queueBadgeText}>{queueCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.coverStage, { minHeight: coverSize + 22 }]}>
            <View style={[styles.coverWrap, { width: coverSize, height: coverSize }]}>
              {cover
                ? <Image source={{ uri: cover }} style={styles.cover} />
                : <View style={[styles.cover, styles.coverEmpty]}>
                    <Icon name="musical-notes" size={72} color={colors.borderStrong} />
                  </View>
              }
              <TouchableOpacity style={styles.editCover} onPress={handleChangeCover} accessibilityRole="button" accessibilityLabel={t('player.changeCover')}>
                <Icon name="camera" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.songInfo}>
              <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
              <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
            </View>
            <TouchableOpacity onPress={() => toggleFavorite(currentSong.id)} style={styles.favBtn} accessibilityRole="button" accessibilityLabel={isFav ? t('player.removeFavorite') : t('player.addFavorite')}>
              <Icon name={isFav ? 'heart' : 'heart-outline'} size={27} color={isFav ? '#1ed760' : colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.sliderWrap}>
            <SeekBar
              position={displayedPosition}
              duration={duration}
              onSeek={seekTo}
              onSeekingChange={seeking => {
                isSeekingRef.current = seeking;
                setIsSeeking(seeking);
              }}
              onPreviewChange={setPreviewPosition}
              styles={styles}
            />
            <View style={styles.timeRow}>
              <Text style={styles.time}>{fmt(displayedPosition)}</Text>
              <Text style={styles.time}>-{fmt(Math.max(0, duration - displayedPosition))}</Text>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleLoop} style={styles.sideBtn} accessibilityRole="button" accessibilityLabel={t('player.repeat')}>
              <Icon name="repeat" size={23} color={isLooping ? '#1ed760' : colors.textMuted} />
              {isLooping && <View style={styles.loopDot} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={playPrevious} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel={t('player.previous')}>
              <Icon name="play-skip-back" size={32} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={isPlaying ? pauseSong : resumeSong} style={styles.playBtn} accessibilityRole="button" accessibilityLabel={isPlaying ? t('player.pause') : t('player.play')}>
              <Icon name={isPlaying ? 'pause' : 'play'} size={32} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={playNext} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel={t('player.next')}>
              <Icon name="play-skip-forward" size={32} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.sideBtn} />
          </View>
        </ScrollView>
      </SafeAreaView>
      <QueueView visible={queueVisible} onClose={() => setQueueVisible(false)} />
    </LinearGradient>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg3, borderRadius: 22, position: 'relative' },
  queueBadge: {
    position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#1ed760', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  queueBadgeText: { color: '#000', fontSize: 10, fontWeight: '800' },
  headerLabel: { color: c.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  coverStage: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  coverWrap: { borderRadius: 10, overflow: 'hidden', backgroundColor: c.bg2, elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 18, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverEmpty: { justifyContent: 'center', alignItems: 'center' },
  editCover: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.65)', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 12 },
  songInfo: { flex: 1, minWidth: 0 },
  songTitle: { fontSize: 21, fontWeight: '800', color: c.text, marginBottom: 4 },
  songArtist: { fontSize: 14, color: c.textMuted },
  favBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  sliderWrap: { marginTop: 12, justifyContent: 'center' },
  sliderTouch: { height: 44, marginHorizontal: -8, justifyContent: 'center' },
  sliderTrack: { height: 4, backgroundColor: c.borderStrong, borderRadius: 2, marginHorizontal: 8 },
  sliderFill: { height: 4, backgroundColor: '#1ed760', borderRadius: 2 },
  sliderThumb: { position: 'absolute', top: -7, width: 18, height: 18, borderRadius: 9, marginLeft: -9, backgroundColor: '#fff', elevation: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 },
  time: { fontSize: 11, color: c.textDim, fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  sideBtn: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  loopDot: { position: 'absolute', bottom: 5, left: '50%', width: 4, height: 4, borderRadius: 2, backgroundColor: '#1ed760', marginLeft: -2 },
  skipBtn: { width: 48, height: 52, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 66, height: 66, backgroundColor: '#fff', borderRadius: 33, justifyContent: 'center', alignItems: 'center', elevation: 6 },
});
