import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MusicContext } from '../context/MusicContext';
import { useTheme } from '../theme';
import { useT } from '../i18n';

const AUTO_DISMISS_MS = 6000;

// Apila los logros recién desbloqueados (llegan por la cola
// `achievementToasts` de MusicContext) y los va quitando solos tras unos
// segundos.
export default function AchievementToast() {
  const { achievementToasts, dismissAchievementToast } = useContext(MusicContext);
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  if (achievementToasts.length === 0) return null;

  return (
    <View style={[styles.stack, { top: insets.top + 8 }]} pointerEvents="box-none">
      {achievementToasts.map(toast => (
        <ToastItem key={toast._toastId} toast={toast} onDismiss={() => dismissAchievementToast(toast._toastId)} label={t('achievements.toast.unlocked')} styles={styles} />
      ))}
    </View>
  );
}

function ToastItem({ toast, onDismiss, label, styles }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
        },
      ]}
    >
      <TouchableOpacity style={styles.toastInner} onPress={onDismiss} activeOpacity={0.85}>
        <Text style={styles.icon}>{toast.icon || '🏆'}</Text>
        <View style={styles.body}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          {!!toast.description && <Text style={styles.desc} numberOfLines={2}>{toast.description}</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  stack: { position: 'absolute', left: 12, right: 12, zIndex: 2000, gap: 8 },
  toast: { marginBottom: 8 },
  toastInner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: c.bg2, borderRadius: 14, borderWidth: 1, borderColor: '#1ed76050',
    padding: 14, elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
  },
  icon: { fontSize: 26, lineHeight: 30 },
  body: { flex: 1, minWidth: 0 },
  label: { color: '#1ed760', fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { color: c.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  desc: { color: c.textDim, fontSize: 12, marginTop: 2, lineHeight: 16 },
});