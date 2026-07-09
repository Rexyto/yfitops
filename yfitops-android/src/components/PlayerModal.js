import React, { useContext } from 'react';
import { View, Text, StyleSheet, Image, Alert, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import Icon from './Icon';
import { MusicContext } from '../context/MusicContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function PlayerModal({ onClose }) {
  const { currentSong, isPlaying, position, duration, isLooping, pauseSong, resumeSong, playNext, playPrevious, seekTo, toggleLoop, toggleFavorite, favorites, uploadCover, SERVER_URL, setPosition } = useContext(MusicContext);
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  if (!currentSong) return null;

  const fmt = (ms) => {
    if (!ms || ms <= 0) return '0:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const isFav = favorites.includes(currentSong.id);
  const cover = currentSong.coverUrl ? `${SERVER_URL}${currentSong.coverUrl}` : null;

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar === 'light' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
          <Icon name="chevron-down" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>{t('player.nowPlaying')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.coverWrap}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cover} />
          : <View style={[styles.cover, styles.coverEmpty]}>
              <Icon name="musical-notes" size={80} color={colors.borderStrong} />
            </View>
        }
        <TouchableOpacity style={styles.editCover} onPress={handleChangeCover}>
          <Icon name="camera" size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.songArtist}>{currentSong.artist}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleFavorite(currentSong.id)} style={styles.favBtn}>
          <Icon name={isFav ? 'heart' : 'heart-outline'} size={26} color={isFav ? '#1ed760' : colors.textFaint} />
        </TouchableOpacity>
      </View>

      <View style={styles.sliderWrap}>
        <Slider
          value={position}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          onSlidingComplete={seekTo}
          onValueChange={(val) => setPosition(val)}
          minimumTrackTintColor="#1ed760"
          maximumTrackTintColor={colors.borderStrong}
          thumbTintColor={colors.text}
          style={{ height: 44, marginHorizontal: -4 }}
          tapToSeek={true}
        />
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(position)}</Text>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={toggleLoop}
          style={[styles.sideBtn, isLooping && styles.sideBtnActive]}
        >
          <Text style={{ fontSize: 18, color: isLooping ? '#000' : colors.textDim }}>🔁</Text>
          {isLooping && (
            <View style={styles.loopDot} />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={playPrevious} style={styles.skipBtn}>
          <Icon name="play-skip-back" size={32} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={isPlaying ? pauseSong : resumeSong} style={styles.playBtn}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={34} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={playNext} style={styles.skipBtn}>
          <Icon name="play-skip-forward" size={32} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg3, borderRadius: 20 },
  headerLabel: { color: c.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  coverWrap: { marginHorizontal: 28, borderRadius: 16, overflow: 'hidden', aspectRatio: 1, backgroundColor: c.bg2, elevation: 12, shadowColor: '#1ed760', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverEmpty: { justifyContent: 'center', alignItems: 'center' },
  editCover: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.7)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, marginTop: 24, marginBottom: 4 },
  songTitle: { fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 4 },
  songArtist: { fontSize: 15, color: c.textDim },
  favBtn: { padding: 8 },
  sliderWrap: { paddingHorizontal: 20, marginTop: 8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  time: { fontSize: 12, color: c.textFaint, fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 },
  sideBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, position: 'relative' },
  sideBtnActive: { backgroundColor: '#1ed760' },
  loopDot: { position: 'absolute', bottom: 6, left: '50%', width: 4, height: 4, borderRadius: 2, backgroundColor: '#000', marginLeft: -2 },
  skipBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 72, height: 72, backgroundColor: '#1ed760', borderRadius: 36, justifyContent: 'center', alignItems: 'center', elevation: 8 },
});
