import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MusicContext } from '../context/MusicContext';
import { useTheme } from '../theme';

const AUTO_DISMISS_MS = 7000;

// Aviso amistoso (estilo "vas muy rápido") que manda el servidor cuando un
// usuario se está acercando al límite de peticiones, ANTES de llegar a
// bloquearlo de verdad (ver servidor/lib/rateLimit.js -> warnAt). No corta
// nada, es solo un toast informativo para que la persona baje el ritmo.
export default function RateLimitWarningToast() {
  const { rateLimitWarning, dismissRateLimitWarning } = useContext(MusicContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!rateLimitWarning) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const timer = setTimeout(dismissRateLimitWarning, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [rateLimitWarning?._toastId]);

  if (!rateLimitWarning) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 80 }]} pointerEvents="box-none">
      <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <TouchableOpacity style={styles.toast} onPress={dismissRateLimitWarning} activeOpacity={0.85}>
          <View style={styles.badge}><Text style={styles.badgeText}>!</Text></View>
          <Text style={styles.message}>{rateLimitWarning.message}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 2000 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.bg2, borderRadius: 14, borderWidth: 1, borderColor: '#ff9f4355',
    paddingVertical: 12, paddingHorizontal: 16, maxWidth: '100%',
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
  },
  badge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#ff9f4322',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  badgeText: { color: '#ff9f43', fontWeight: '900', fontSize: 13 },
  message: { flex: 1, color: c.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
});