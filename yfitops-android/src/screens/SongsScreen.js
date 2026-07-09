import React, { useContext, useState } from 'react';
import Icon from '../components/Icon';
import { View, FlatList, StyleSheet, Alert, TouchableOpacity, Text, Image, StatusBar, TextInput, Modal, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MusicContext } from '../context/MusicContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function SongsScreen() {
  const { songs, playSong, uploadSong, deleteSong, toggleFavorite, favorites, currentSong, SERVER_URL, onLogout, fetchSongs, activeListeners, fetchListeners } = useContext(MusicContext);
  const { downloadedSongIds } = useSettings();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const filtered = search.trim()
    ? songs.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()))
    : songs;

  const [uploadQueue, setUploadQueue] = useState([]); // { name, status: 'pending'|'uploading'|'done'|'error' }
  const [showQueue, setShowQueue] = useState(false);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const files = result.assets;
        const queue = files.map(f => ({ uri: f.uri, name: f.name, status: 'pending' }));
        setUploadQueue(queue);
        setShowQueue(true);
        setUploading(true);

        for (let i = 0; i < queue.length; i++) {
          setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item));
          try {
            await uploadSong(queue[i].uri, queue[i].name);
            setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item));
          } catch {
            setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item));
          }
        }
        setUploading(false);
      }
    } catch { Alert.alert(t('songs.uploadErrorTitle'), t('songs.uploadErrorPicker')); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetchSongs();
    } finally {
      setSyncing(false);
    }
  };

  const fmt = (s) => {
    if (!s || s < 1) return '--:--';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item, index }) => {
    const isActive = currentSong?.id === item.id;
    const isFav = favorites.includes(item.id);
    const isDownloaded = downloadedSongIds.includes(String(item.id));
    const cover = item.coverUrl ? `${SERVER_URL}${item.coverUrl}` : null;
    return (
      <TouchableOpacity
        style={[styles.songRow, isActive && styles.songRowActive]}
        onPress={() => playSong(item, filtered)}
        onLongPress={() => { setSelectedSong(item); setMenuVisible(true); }}
        activeOpacity={0.7}
      >
        <Text style={[styles.songIndex, isActive && { color: '#1ed760' }]}>{isActive ? '▶' : index + 1}</Text>
        {cover
          ? <Image source={{ uri: cover }} style={styles.songCover} />
          : <View style={[styles.songCover, styles.songCoverEmpty]}><Icon name="musical-note" size={18} color={colors.textFaint} /></View>
        }
        <View style={styles.songMeta}>
          <View style={styles.titleRow}>
            <Text style={[styles.songTitle, isActive && styles.songTitleActive]} numberOfLines={1}>{item.title}</Text>
            {isDownloaded && <Icon name="download-outline" size={12} color="#1ed760" />}
          </View>
          <Text style={styles.songArtist} numberOfLines={1}>{item.artist} · {fmt(item.duration)}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.favBtn}>
          <Icon name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? '#1ed760' : colors.textDim} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.statusBar === 'light' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('songs.title')}</Text>
        <View style={styles.headerRight}>
          {activeListeners > 0 && (
          <View style={styles.listenersTag}>
            <Text style={styles.listenersText}>🎧 {activeListeners}</Text>
          </View>
        )}
        <TouchableOpacity onPress={handleSync} style={styles.syncBtn} disabled={syncing}>
            <Icon name={syncing ? 'reload' : 'refresh-outline'} size={20} color={syncing ? '#1ed760' : colors.textMuted} />
            <Text style={[styles.syncBtnText, syncing && { color: '#1ed760' }]}>{t('songs.sync')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Icon name="log-out-outline" size={20} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Icon name="search-outline" size={16} color={colors.textDim} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('songs.searchPlaceholder')}
          placeholderTextColor={colors.textDim}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" size={16} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.countLabel}>{t('songs.count', filtered.length)}</Text>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleUpload} disabled={uploading}>
        {uploading
          ? <View style={styles.fabProgress}><Text style={styles.fabProgressText}>{uploadQueue.filter(x=>x.status==='done').length}/{uploadQueue.length}</Text></View>
          : <Icon name="add" size={28} color="#000" />
        }
      </TouchableOpacity>

      {/* Upload queue modal */}
      <Modal visible={showQueue && uploadQueue.length > 0} transparent animationType="slide" onRequestClose={() => !uploading && setShowQueue(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !uploading && setShowQueue(false)}>
          <View style={styles.menuBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.menuTitle}>{t('songs.uploading', uploadQueue.length)}</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {uploadQueue.map((item, i) => (
                <View key={i} style={styles.queueItem}>
                  <Text style={styles.queueName} numberOfLines={1}>{item.name}</Text>
                  {item.status === 'done' && <Icon name="checkmark-circle" size={18} color="#1ed760" />}
                  {item.status === 'error' && <Icon name="close-circle" size={18} color="#ff4444" />}
                  {item.status === 'uploading' && <Icon name="cloud-upload-outline" size={18} color={colors.textMuted} />}
                  {item.status === 'pending' && <Icon name="time-outline" size={18} color={colors.textFaint} />}
                </View>
              ))}
            </ScrollView>
            {!uploading && (
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowQueue(false)}>
                <Text style={{ color: '#000', fontWeight: '700' }}>{t('songs.close')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Options modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setMenuVisible(false)} activeOpacity={1}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitle} numberOfLines={1}>{selectedSong?.title}</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => { deleteSong(selectedSong?.id); setMenuVisible(false); }}>
              <Icon name="trash-outline" size={18} color="#ff4444" />
              <Text style={[styles.menuItemText, { color: '#ff4444' }]}>{t('songs.deleteSong')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
              <Icon name="close-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.menuItemText, { color: colors.textMuted }]}>{t('songs.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listenersTag: { backgroundColor: '#1ed76022', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#1ed76044' },
  listenersText: { color: '#1ed760', fontSize: 12, fontWeight: '700' },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.bg3, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: c.borderStrong },
  syncBtnText: { color: c.textMuted, fontWeight: '600', fontSize: 13 },
  logoutBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg3, marginHorizontal: 20, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  searchInput: { flex: 1, color: c.text, fontSize: 15 },
  countLabel: { color: c.textDim, fontSize: 11, paddingHorizontal: 20, marginBottom: 8, fontWeight: '700', letterSpacing: 0.8 },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginHorizontal: 8, marginVertical: 1 },
  songRowActive: { backgroundColor: c.bg3 },
  songIndex: { width: 28, color: c.textDim, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  songCover: { width: 44, height: 44, borderRadius: 6, marginRight: 12 },
  songCoverEmpty: { backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  songMeta: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  songTitle: { color: c.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  songTitleActive: { color: '#1ed760' },
  songArtist: { color: c.textDim, fontSize: 12 },
  favBtn: { padding: 8 },
  queueItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  queueName: { flex: 1, color: c.textMuted, fontSize: 13, marginRight: 10 },
  fabProgress: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1ed760', justifyContent: 'center', alignItems: 'center' },
  fabProgressText: { color: '#000', fontSize: 11, fontWeight: '800' },
  createBtn: { backgroundColor: '#1ed760', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: c.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  menuTitle: { color: c.textMuted, fontSize: 13, marginBottom: 16, fontWeight: '600' },
  fab: { position: 'absolute', right: 20, bottom: 100, width: 52, height: 52, borderRadius: 26, backgroundColor: '#1ed760', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border },
  menuItemText: { fontSize: 15, fontWeight: '600' },
});
