import React, { useContext, useState } from 'react';
import Icon from '../components/Icon';
import {
  View, FlatList, StyleSheet, Alert, Text, TouchableOpacity,
  Image, Modal, TextInput, ScrollView,
} from 'react-native';
import { MusicContext } from '../context/MusicContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';

const COLORS = ['#1DB954','#E91E63','#9C27B0','#2196F3','#FF5722','#FF9800','#009688','#607D8B'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fmtDur = (s) => {
  if (!s || s < 1) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const fmtTotal = (secs) => {
  if (!secs) return '0 min';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

// ── Fila de canción en playlist ───────────────────────────────
function PlaylistSongRow({ item, index, isActive, onPress, onFavoritePress, isFavorite, SERVER_URL, color = '#1ed760', onQueuePress }) {
  const { colors } = useTheme();
  const { downloadedSongIds } = useSettings();
  const t = useT();
  const styles = makeStyles(colors);
  const cover = item.coverUrl ? `${SERVER_URL}${item.coverUrl}` : null;
  const isDownloaded = downloadedSongIds.includes(String(item.id));
  const [justQueued, setJustQueued] = useState(false);

  const handleQueuePress = () => {
    onQueuePress?.();
    setJustQueued(true);
    setTimeout(() => setJustQueued(false), 900);
  };

  return (
    <TouchableOpacity
      style={[styles.songRow, isActive && { backgroundColor: color + '18' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isActive && <View style={[styles.activeBar, { backgroundColor: color }]} />}

      {/* Número — siempre visible, en color acento si está activa */}
      <View style={styles.songIdxWrap}>
        <Text style={[styles.songIdx, isActive && { color, fontWeight: '700' }]}>
          {index + 1}
        </Text>
      </View>

      {/* Portada */}
      {cover
        ? <Image source={{ uri: cover }} style={[styles.songThumb, isActive && { borderColor: color, borderWidth: 2 }]} />
        : <View style={[styles.songThumb, styles.songThumbEmpty, isActive && { borderColor: color, borderWidth: 2 }]}>
            <Icon name="musical-note" size={16} color={isActive ? color : colors.textFaint} />
          </View>
      }

      {/* Título — texto normal truncado, sin scroll */}
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.songTitle, isActive && { color, fontWeight: '700' }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {isDownloaded && <Icon name="download-outline" size={12} color="#1ed760" />}
        </View>
        <Text style={styles.songArtist} numberOfLines={1}>
          {item.artist} · {fmtDur(item.duration)}
        </Text>
      </View>

      {/* Cola */}
      {onQueuePress && (
        <TouchableOpacity onPress={handleQueuePress} style={{ padding: 8 }}>
          <Text style={{ color: justQueued ? '#1ed760' : colors.textFaint, fontSize: 17, fontWeight: '700' }}>
            {justQueued ? '✓' : '+'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Favorito */}
      <TouchableOpacity onPress={onFavoritePress} style={{ padding: 8 }}>
        <Icon name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? '#1ed760' : colors.textDim} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Barra de búsqueda ─────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }) {
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  return (
    <View style={styles.searchBox}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder || t('playlists.searchPlaceholder')}
        placeholderTextColor={colors.textDim}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: colors.textDim, fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Cabecera de playlist ──────────────────────────────────────
function PlaylistDetailHeader({ playlist, songCount, color, onBack, onPlayAll, onShuffle, searchVisible, onToggleSearch, searchQuery, onSearchChange, isDownloaded }) {
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  return (
    <>
      <View style={[styles.playlistHeader, { borderBottomColor: color + '44' }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{t('playlists.back')}</Text>
        </TouchableOpacity>
        <View style={styles.playlistHeaderInfo}>
          <Text style={[styles.playlistDot, { color }]}>●</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{playlist.name}</Text>
          {isDownloaded && <Icon name="download-outline" size={14} color="#1ed760" />}
        </View>
        <TouchableOpacity onPress={onToggleSearch} style={[styles.iconBtn, searchVisible && { backgroundColor: color + '33' }]}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
        </TouchableOpacity>
      </View>

      {searchVisible && <SearchBar value={searchQuery} onChange={onSearchChange} placeholder={t('playlists.searchInList')} />}

      <View style={styles.subHeader}>
        <Text style={styles.headerSub}>{t('playlists.songCount', songCount)}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onShuffle} style={[styles.actionBtn, { borderColor: color + '66' }]}>
            <Text style={[styles.actionBtnText, { color }]}>{t('playlists.shuffle')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPlayAll} style={[styles.actionBtn, { backgroundColor: color, borderColor: color }]}>
            <Text style={[styles.actionBtnText, { color: '#000' }]}>{t('playlists.play')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

// ── Tarjeta carpeta ───────────────────────────────────────────
function FolderPlaylistCard({ playlist, onPress, SERVER_URL, isDownloaded }) {
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const cover = playlist.coverUrl ? `${SERVER_URL}${playlist.coverUrl}` : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cardCoverImg} />
          : <View style={[styles.cardCover, { backgroundColor: '#1ed76022', borderColor: '#1ed76044' }]}>
              <Icon name="musical-notes" size={36} color="#1ed760" />
            </View>
        }
        {isDownloaded && (
          <View style={styles.cardDownloadBadge}>
            <Icon name="download-outline" size={12} color="#1ed760" />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>{playlist.name}</Text>
        <Text style={styles.cardMeta}>{t('playlists.songCount', playlist.songs.length)} · {fmtTotal(playlist.totalDuration)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Tarjeta colección manual ──────────────────────────────────
function CollectionCard({ playlist, songs, onPress, onLongPress, isDownloaded }) {
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const coverSongs = songs.filter(s => playlist.songs?.includes(s.id)).slice(0, 4);
  const color = playlist.coverColor || '#1DB954';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <View style={[styles.cardCover, { backgroundColor: color + '22', borderColor: color + '44' }]}>
          {coverSongs.length > 0 ? (
            <View style={styles.cardGrid}>
              {coverSongs.map((s, i) =>
                s.coverUrl
                  ? <Image key={`img-${i}`} source={{ uri: s.coverUrl }} style={styles.gridCell} />
                  : <View key={i} style={[styles.gridCell, { backgroundColor: color + '33' }]}>
                      <Text style={styles.gridEmoji}>🎵</Text>
                    </View>
              )}
            </View>
          ) : (
            <Text style={[styles.cardEmoji, { color }]}>🎶</Text>
          )}
        </View>
        {isDownloaded && (
          <View style={styles.cardDownloadBadge}>
            <Icon name="download-outline" size={12} color="#1ed760" />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{playlist.name}</Text>
        <Text style={styles.cardCount}>{t('playlists.songCount', (playlist.songs || []).length)}</Text>
      </View>
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
    </TouchableOpacity>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function PlaylistsScreen() {
  const {
    playlists, songs, createPlaylist, deletePlaylist, updatePlaylist,
    playSong, favorites, toggleFavorite, SERVER_URL, folderPlaylists,
    currentSong, isPlaying, addToQueue,
  } = useContext(MusicContext);
  const { isPlaylistDownloaded } = useSettings();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  const [view, setView]                         = useState('list');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [selectedFolder, setSelectedFolder]     = useState(null);
  const [createVisible, setCreateVisible]       = useState(false);
  const [newName, setNewName]                   = useState('');
  const [selectedColor, setSelectedColor]       = useState(COLORS[0]);
  const [editSongs, setEditSongs]               = useState([]);
  const [searchVisible, setSearchVisible]       = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');

  const getPlaylistSongs = (pl) => songs.filter(s => pl.songs?.includes(s.id));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPlaylist(newName.trim(), [], selectedColor);
    setNewName(''); setCreateVisible(false);
  };

  const handleLongPress = (pl) => {
    Alert.alert(pl.name, '', [
      { text: t('song.edit'), onPress: () => { setSelectedPlaylist(pl); setEditSongs(pl.songs || []); setView('edit'); } },
      { text: t('settings.downloads.remove'), style: 'destructive', onPress: () => deletePlaylist(pl.id) },
      { text: t('playlists.cancel'), style: 'cancel' },
    ]);
  };

  const saveEdit = async () => {
    await updatePlaylist(selectedPlaylist.id, { songs: editSongs });
    setView('songs');
  };

  const openPlaylist = (pl) => { setSelectedPlaylist(pl); setSearchVisible(false); setSearchQuery(''); setView('songs'); };
  const openFolder   = (pl) => { setSelectedFolder(pl);   setSearchVisible(false); setSearchQuery(''); setView('folderDetail'); };

  // ── Vista: editar canciones ───────────────────────────────────
  if (view === 'edit') {
    return (
      <View style={styles.container}>
        <View style={styles.editHeader}>
          <TouchableOpacity onPress={() => setView('songs')} style={styles.backBtn}>
            <Text style={styles.backText}>{t('playlists.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('playlists.newCollection')}</Text>
          <TouchableOpacity onPress={saveEdit} style={styles.saveBtn}>
            <Text style={styles.saveText}>{t('song.save')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.editHint}>{t('playlists.songCount', editSongs.length)}</Text>
        <FlatList
          data={songs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const sel = editSongs.includes(item.id);
            return (
              <TouchableOpacity
                style={[styles.editRow, sel && styles.editRowSelected]}
                onPress={() => setEditSongs(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, sel && styles.checkboxSelected]}>
                  {sel && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.editInfo}>
                  <Text style={[styles.editTitle, sel && styles.editTitleSelected]} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.editArtist} numberOfLines={1}>{item.artist}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    );
  }

  // ── Vista: colección manual ───────────────────────────────────
  if (view === 'songs' && selectedPlaylist) {
    const color = selectedPlaylist.coverColor || '#1DB954';
    const allPlSongs = getPlaylistSongs(selectedPlaylist);
    const filteredSongs = searchQuery.trim()
      ? allPlSongs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.artist.toLowerCase().includes(searchQuery.toLowerCase()))
      : allPlSongs;

    // Se manda al servidor en cada heartbeat mientras suena una canción de
    // esta colección, para la estadística de "colección más escuchada".
    const playlistContext = { id: selectedPlaylist.id, type: 'manual', name: selectedPlaylist.name };

    return (
      <View style={styles.container}>
        <PlaylistDetailHeader
          playlist={selectedPlaylist} songCount={filteredSongs.length} color={color}
          onBack={() => setView('list')}
          onPlayAll={() => allPlSongs.length > 0 && playSong(allPlSongs[0], allPlSongs, playlistContext)}
          onShuffle={() => { if (allPlSongs.length === 0) return; const s = shuffle(allPlSongs); playSong(s[0], s, playlistContext); }}
          searchVisible={searchVisible}
          onToggleSearch={() => { setSearchVisible(v => !v); setSearchQuery(''); }}
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          isDownloaded={isPlaylistDownloaded(selectedPlaylist.id)}
        />
        <FlatList
          data={filteredSongs}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => {
            const isActive = currentSong?.id === item.id;
            return (
              <PlaylistSongRow
                item={item} index={index}
                isActive={isActive} isPlaying={isPlaying && isActive}
                onPress={() => playSong(item, filteredSongs.length > 0 ? filteredSongs : allPlSongs, playlistContext)}
                onFavoritePress={() => toggleFavorite(item.id)}
                onQueuePress={() => addToQueue(item)}
                isFavorite={favorites.includes(item.id)}
                SERVER_URL={SERVER_URL} color={color}
              />
            );
          }}
          contentContainerStyle={styles.songList}
          showsVerticalScrollIndicator={true}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '📭'}</Text>
              <Text style={styles.emptyTitle}>{searchQuery ? t('playlists.noResults') : t('playlists.emptyList')}</Text>
              <Text style={styles.emptySubtitle}>{searchQuery ? t('playlists.noResultsHint', searchQuery) : t('playlists.emptyListHint')}</Text>
            </View>
          }
        />
      </View>
    );
  }

  // ── Vista: carpeta ────────────────────────────────────────────
  if (view === 'folderDetail' && selectedFolder) {
    const plSongs = selectedFolder.songs || [];
    const cover = selectedFolder.coverUrl ? `${SERVER_URL}${selectedFolder.coverUrl}` : null;
    const filteredFolderSongs = searchQuery.trim()
      ? plSongs.filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase()) || s.artist?.toLowerCase().includes(searchQuery.toLowerCase()))
      : plSongs;

    // Se manda al servidor en cada heartbeat mientras suena una canción de
    // esta colección, para la estadística de "colección más escuchada".
    const playlistContext = { id: selectedFolder.id, type: 'folder', name: selectedFolder.name };

    return (
      <View style={styles.container}>
        {/* Hero */}
        <View style={{ height: 200, position: 'relative' }}>
          {cover
            ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} />
            : <View style={{ width: '100%', height: '100%', backgroundColor: colors.bg3, justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="musical-notes" size={80} color="#1ed760" />
              </View>
          }
          <TouchableOpacity style={styles.heroBack} onPress={() => { setSelectedFolder(null); setView('list'); setSearchQuery(''); setSearchVisible(false); }}>
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.heroSearch, searchVisible && { backgroundColor: '#1ed76055' }]} onPress={() => { setSearchVisible(v => !v); setSearchQuery(''); }}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Info + botones */}
        <View style={styles.folderMeta}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.folderName}>{selectedFolder.name}</Text>
              {isPlaylistDownloaded(selectedFolder.id) && <Icon name="download-outline" size={14} color="#1ed760" />}
            </View>
            <Text style={styles.folderStats}>{t('playlists.songCount', filteredFolderSongs.length)} · {fmtTotal(selectedFolder.totalDuration)}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => { if (!plSongs.length) return; const s = shuffle(plSongs); playSong(s[0], s, playlistContext); }} style={[styles.actionBtn, { borderColor: '#1ed76066' }]}>
              <Text style={[styles.actionBtnText, { color: '#1ed760' }]}>{t('playlists.shuffle')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => plSongs.length > 0 && playSong(plSongs[0], plSongs, playlistContext)} style={[styles.actionBtn, { backgroundColor: '#1ed760', borderColor: '#1ed760' }]}>
              <Text style={[styles.actionBtnText, { color: '#000' }]}>{t('playlists.play')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {searchVisible && <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={t('playlists.searchInList')} />}

        <FlatList
          data={filteredFolderSongs}
          keyExtractor={item => item.id || String(item.title)}
          showsVerticalScrollIndicator={true}
          renderItem={({ item, index }) => {
            const isActive = currentSong?.id === item.id;
            return (
              <PlaylistSongRow
                item={item} index={index}
                isActive={isActive} isPlaying={isPlaying && isActive}
                onPress={() => playSong(item, filteredFolderSongs.length > 0 ? filteredFolderSongs : plSongs, playlistContext)}
                onFavoritePress={() => toggleFavorite(item.id)}
                onQueuePress={() => addToQueue(item)}
                isFavorite={favorites.includes(item.id)}
                SERVER_URL={SERVER_URL} color="#1ed760"
              />
            );
          }}
          contentContainerStyle={styles.songList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>{t('playlists.noResults')}</Text>
              <Text style={styles.emptySubtitle}>{t('playlists.noResultsHint', searchQuery)}</Text>
            </View>
          }
        />
      </View>
    );
  }

  // ── Vista: lista principal ────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mainScrollContent} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('playlists.title')}</Text>
          <Text style={styles.headerSub}>{t('playlists.count', playlists.length)}</Text>
        </View>

        {folderPlaylists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('playlists.fromFolders')}</Text>
            <View style={styles.cardGrid2}>
              {folderPlaylists.map(item => (
                <FolderPlaylistCard key={item.id} playlist={item} SERVER_URL={SERVER_URL} onPress={() => openFolder(item)} isDownloaded={isPlaylistDownloaded(item.id)} />
              ))}
            </View>
          </View>
        )}

        {playlists.length > 0 && <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginBottom: 8 }]}>{t('playlists.mine')}</Text>}

        {playlists.length > 0 ? (
          <View style={[styles.cardGrid2, { paddingHorizontal: 12 }]}>
            {playlists.map(item => (
              <CollectionCard key={item.id} playlist={item} songs={songs} onPress={() => openPlaylist(item)} onLongPress={() => handleLongPress(item)} isDownloaded={isPlaylistDownloaded(item.id)} />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎶</Text>
            <Text style={styles.emptyTitle}>{t('playlists.empty')}</Text>
            <Text style={styles.emptySubtitle}>{t('playlists.emptyHint')}</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setCreateVisible(true)}>
        <Icon name="add" size={28} color="#000" />
      </TouchableOpacity>

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCreateVisible(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('playlists.newCollection')}</Text>
            <TextInput style={styles.input} placeholder={t('playlists.name')} placeholderTextColor={colors.textDim} value={newName} onChangeText={setNewName} autoFocus />
            <Text style={styles.colorLabel}>{t('playlists.color')}</Text>
            <View style={styles.colorRow}>
              {COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setSelectedColor(c)} style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotSelected]} />
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateVisible(false)}>
                <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('playlists.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={{ color: '#000', fontWeight: '700' }}>{t('playlists.create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  mainScrollContent: { paddingBottom: 160 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  cardGrid2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 12, rowGap: 12 },
  cardCoverImg: { width: '100%', aspectRatio: 1, borderRadius: 10 },
  card: { width: '48%', backgroundColor: c.bg3, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.borderStrong },
  cardCover: { height: 120, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1 },
  cardDownloadBadge: {
    position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
  },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' },
  gridCell: { width: '50%', height: '50%', justifyContent: 'center', alignItems: 'center' },
  gridEmoji: { fontSize: 20 },
  cardEmoji: { fontSize: 40 },
  cardInfo: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
  cardCount: { fontSize: 12, color: c.textMuted },
  cardMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  cardAccent: { height: 3, width: '100%' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5, flex: 1 },
  headerSub: { fontSize: 12, color: c.textDim, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  playlistHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 52, paddingBottom: 10, borderBottomWidth: 1 },
  playlistHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playlistDot: { fontSize: 10 },
  backBtn: { padding: 8 },
  backText: { color: '#1DB954', fontSize: 16, fontWeight: '600' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: c.borderStrong },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg3, marginHorizontal: 16, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  searchIcon: { fontSize: 14, marginRight: 8, color: c.textDim },
  searchInput: { flex: 1, color: c.text, fontSize: 15 },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginVertical: 1, borderRadius: 8, position: 'relative' },
  activeBar: { position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2 },
  songIdxWrap: { width: 32, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  songIdx: { width: 28, color: c.textDim, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  songThumb: { width: 44, height: 44, borderRadius: 6, marginRight: 12 },
  songThumbEmpty: { backgroundColor: c.bg3, justifyContent: 'center', alignItems: 'center' },
  songTitle: { color: c.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  songArtist: { color: c.textDim, fontSize: 12 },
  songList: { paddingBottom: 160 },
  heroBack: { position: 'absolute', top: 48, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  heroSearch: { position: 'absolute', top: 48, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  folderMeta: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  folderName: { fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 2 },
  folderStats: { color: c.textMuted, fontSize: 13 },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8 },
  editHint: { color: c.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 20, paddingVertical: 10 },
  editRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, marginVertical: 1, borderRadius: 10 },
  editRowSelected: { backgroundColor: '#1DB95415' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.borderStrong, marginRight: 14, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  checkmark: { color: '#000', fontWeight: '800', fontSize: 14 },
  editInfo: { flex: 1 },
  editTitle: { fontSize: 15, fontWeight: '600', color: c.textMuted },
  editTitleSelected: { color: c.text },
  editArtist: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  saveBtn: { backgroundColor: '#1DB954', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  saveText: { color: '#000', fontWeight: '700', fontSize: 13 },
  fab: { position: 'absolute', right: 20, bottom: 90, width: 52, height: 52, borderRadius: 26, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: c.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: c.text, fontSize: 20, fontWeight: '800', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: c.bg4, padding: 14, borderRadius: 10, alignItems: 'center' },
  createBtn: { flex: 1, backgroundColor: '#1ed760', padding: 14, borderRadius: 10, alignItems: 'center' },
  input: { marginBottom: 16, backgroundColor: c.bg4, color: c.text, borderRadius: 10, padding: 14, fontSize: 15 },
  colorLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: c.text, transform: [{ scale: 1.15 }] },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: c.textDim, textAlign: 'center', lineHeight: 22 },
});