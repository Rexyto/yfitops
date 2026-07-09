import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, Linking, BackHandler, ScrollView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import MainScreen from './src/screens/MainScreen';
import LoginScreen from './src/screens/LoginScreen';
import { MusicProvider } from './src/context/MusicContext';
import { ThemeProvider, useTheme } from './src/theme';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { useT } from './src/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://yfitops.duckdns.org';
const APP_VERSION = '1.2.0';

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AppInner />
      </SettingsProvider>
    </ThemeProvider>
  );
}

function OfflineBanner() {
  const t = useT();
  const styles = makeStyles(useTheme().colors);
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerText}>{t('offline.banner')}</Text>
    </View>
  );
}

function AppInner() {
  const [token, setToken]       = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [modal, setModal]       = useState(null);
  const { colors } = useTheme();
  const { isOnline } = useSettings();
  const styles = makeStyles(colors);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('auth_token');
        if (saved) {
          try {
            const res = await fetch(`${SERVER_URL}/api/verify`, {
              headers: { 'Authorization': `Bearer ${saved}` },
            });
            if (res.ok) {
              setToken(saved);
              checkVersions(saved);
            } else {
              // El servidor respondió explícitamente que el token no vale
              await AsyncStorage.removeItem('auth_token');
            }
          } catch {
            // No hay red para comprobar el token (sin wifi/datos): lo aceptamos
            // igualmente para poder seguir escuchando lo descargado sin conexión.
            // Si el token fuera inválido de verdad, las llamadas normales de la
            // app irán fallando igual, pero al menos no te deja fuera del todo.
            setToken(saved);
          }
        }
      } catch {}
      setAppReady(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  const checkVersions = async (t) => {
    try {
      const vRes = await fetch(`${SERVER_URL}/api/version`, {
        headers: { 'Authorization': `Bearer ${t}` },
      });
      if (!vRes.ok) return;
      const { version: serverVersion } = await vRes.json();

      let changelog = null;
      try {
        const cRes = await fetch(`${SERVER_URL}/api/changelog`, {
          headers: { 'Authorization': `Bearer ${t}` },
        });
        if (cRes.ok) changelog = await cRes.json();
      } catch {}

      const seenNotesKey = `seen_notes_${APP_VERSION}`;
      const alreadySeen = await AsyncStorage.getItem(seenNotesKey);

      if (!alreadySeen && changelog?.version === APP_VERSION && changelog?.notes) {
        setModal({ type: 'whats_new', version: APP_VERSION, notes: changelog.notes });
      } else if (serverVersion && serverVersion !== APP_VERSION) {
        const seenUpdate = await AsyncStorage.getItem(`seen_update_${serverVersion}`);
        if (!seenUpdate) setModal({ type: 'update', version: serverVersion });
      }
    } catch {}
  };

  const handleAccept = async () => {
    if (!modal) return;
    if (modal.type === 'whats_new') {
      await AsyncStorage.setItem(`seen_notes_${APP_VERSION}`, '1');
      setModal(null);
    } else {
      await AsyncStorage.setItem(`seen_update_${modal.version}`, '1');
      setModal(null);
      Linking.openURL(SERVER_URL).catch(() => {});
      BackHandler.exitApp();
    }
  };

  const handleClose = async () => {
    if (!modal) return;
    if (modal.type === 'whats_new') {
      await AsyncStorage.setItem(`seen_notes_${APP_VERSION}`, '1');
      setModal(null);
    } else {
      setModal(null);
      BackHandler.exitApp();
    }
  };

  const statusBarStyle = colors.statusBar;

  if (!appReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#1ed760" size="large" />
      </View>
    );
  }

  const handleLogin = async (newToken) => {
    await AsyncStorage.setItem('auth_token', newToken);
    setToken(newToken);
    checkVersions(newToken);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setToken(null);
  };

  return (
    <SafeAreaProvider>
      {!isOnline && <OfflineBanner />}
      {token ? (
        <MusicProvider token={token} onLogout={handleLogout}>
          <MainScreen onLogout={handleLogout} />
          <StatusBar style={statusBarStyle} backgroundColor={colors.bg0} />
        </MusicProvider>
      ) : (
        <>
          <LoginScreen onLogin={handleLogin} serverUrl={SERVER_URL} />
          <StatusBar style={statusBarStyle} backgroundColor={colors.bg0} />
        </>
      )}
      {modal && <AppModal modal={modal} onAccept={handleAccept} onClose={handleClose} />}
    </SafeAreaProvider>
  );
}

function AppModal({ modal, onAccept, onClose }) {
  const isWhatsNew = modal.type === 'whats_new';
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.emojiWrap}>
            <Text style={styles.emoji}>{isWhatsNew ? '🎉' : '🚀'}</Text>
          </View>
          <Text style={styles.title}>
            {isWhatsNew ? t('app.whatsNew', modal.version) : t('app.updateAvailable')}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>v{modal.version}</Text>
          </View>
          {isWhatsNew && modal.notes ? (
            <View style={styles.notesBox}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
                {modal.notes.split('\n').map((line, i) => (
                  <View key={i} style={styles.noteLine}>
                    <Text style={styles.noteText}>{line}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : !isWhatsNew ? (
            <Text style={styles.desc}>
              {t('app.updateDesc')}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.btnPrimary} onPress={onAccept} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>{isWhatsNew ? t('app.great') : t('app.updateNow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.btnSecondaryText}>{isWhatsNew ? t('app.close') : t('app.closeApp')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c) => StyleSheet.create({
  splash: { flex: 1, backgroundColor: c.bg0, justifyContent: 'center', alignItems: 'center' },
  offlineBanner: { paddingTop: 48, paddingBottom: 10, paddingHorizontal: 20, backgroundColor: '#ff555518', borderBottomWidth: 1, borderBottomColor: '#ff555540' },
  offlineBannerText: { color: '#ff8080', fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: c.bg2, borderRadius: 28, padding: 28, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: '#1ed76030' },
  emojiWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#1ed76015', borderWidth: 1, borderColor: '#1ed76035', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  emoji: { fontSize: 36 },
  title: { fontSize: 21, fontWeight: '800', color: c.text, textAlign: 'center', letterSpacing: -0.3, marginBottom: 10 },
  badge: { backgroundColor: '#1ed76020', borderWidth: 1, borderColor: '#1ed76050', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 18 },
  badgeText: { color: '#1ed760', fontWeight: '700', fontSize: 13 },
  desc: { color: c.textDim, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  notesBox: { width: '100%', backgroundColor: c.bg1, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 24 },
  noteLine: { paddingVertical: 3 },
  noteText: { color: c.textMuted, fontSize: 14, lineHeight: 22 },
  btnPrimary: { backgroundColor: '#1ed760', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 8 },
  btnPrimaryText: { color: '#000', fontWeight: '800', fontSize: 16 },
  btnSecondary: { paddingVertical: 11, width: '100%', alignItems: 'center' },
  btnSecondaryText: { color: c.textFaint, fontWeight: '600', fontSize: 14 },
});
