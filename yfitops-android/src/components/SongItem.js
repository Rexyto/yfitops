import React, { useContext, useState } from 'react';
import Icon from './Icon';
import { View, StyleSheet, Image, Alert, TouchableOpacity, Text, Modal, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MusicContext } from '../context/MusicContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function SongItem({ song, isFavorite, onPress, onLongPress, onFavoritePress }) {
  const { updateSong, uploadCover, SERVER_URL } = useContext(MusicContext);
  const { downloadedSongIds } = useSettings();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState(song.title);
  const [editArtist, setEditArtist] = useState(song.artist);
  const [editAlbum, setEditAlbum] = useState(song.album);
  const [saving, setSaving] = useState(false);

  const isDownloaded = downloadedSongIds.includes(String(song.id));

  const fmt = (s) => {
    if (!s || s < 1) return '--:--';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    setSaving(true);
    await updateSong(song.id, { title: editTitle, artist: editArtist, album: editAlbum });
    setSaving(false);
    setEditVisible(false);
  };

  const handleChangeCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t('song.noPermission')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      try { await uploadCover(song.id, result.assets[0].uri); Alert.alert('✓', t('song.updated')); }
      catch { Alert.alert(t('login.errorTitle'), t('song.uploadError')); }
    }
  };

  const cover = song.coverUrl ? `${SERVER_URL}${song.coverUrl}` : null;

  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={() => setEditVisible(true)} activeOpacity={0.7}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cover} />
          : <View style={[styles.cover, styles.coverEmpty]}><Text style={{ fontSize: 16 }}>♪</Text></View>
        }
        <View style={styles.meta}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
            {isDownloaded && <Icon name="download-outline" size={12} color="#1ed760" />}
          </View>
          <Text style={styles.sub}>{song.artist} · {fmt(song.duration)}</Text>
        </View>
        <TouchableOpacity onPress={() => setEditVisible(true)} style={styles.editBtn}>
          <Text style={{ color: colors.textFaint, fontSize: 14 }}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onFavoritePress} style={styles.favBtn}>
          <Text style={{ fontSize: 18, color: isFavorite ? '#1ed760' : colors.textFaint }}>{isFavorite ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('song.edit')}</Text>
            <TouchableOpacity style={styles.coverEditBtn} onPress={handleChangeCover}>
              {cover
                ? <Image source={{ uri: cover }} style={styles.coverPreview} />
                : <View style={[styles.coverPreview, styles.coverEmpty]}><Text style={{ fontSize: 32 }}>♪</Text></View>
              }
              <View style={styles.coverEditOverlay}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t('song.change')}</Text>
              </View>
            </TouchableOpacity>
            <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder={t('song.title')} placeholderTextColor={colors.textDim} />
            <TextInput style={styles.input} value={editArtist} onChangeText={setEditArtist} placeholder={t('song.artist')} placeholderTextColor={colors.textDim} />
            <TextInput style={styles.input} value={editAlbum} onChangeText={setEditAlbum} placeholder={t('song.album')} placeholderTextColor={colors.textDim} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('song.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={{ color: '#000', fontWeight: '700' }}>{saving ? t('song.saving') : t('song.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  cover: { width: 44, height: 44, borderRadius: 6, marginRight: 12 },
  coverEmpty: { backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  meta: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: c.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sub: { color: c.textDim, fontSize: 12 },
  editBtn: { padding: 8 },
  favBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: c.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: c.text, fontSize: 20, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  coverEditBtn: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  coverPreview: { width: 100, height: 100, borderRadius: 12 },
  coverEditOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 6, alignItems: 'center' },
  input: { backgroundColor: c.bg4, color: c.text, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: { flex: 1, backgroundColor: c.bg4, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtn: { flex: 1, backgroundColor: '#1ed760', padding: 14, borderRadius: 10, alignItems: 'center' },
});
