// src/components/Icon.js
// Reemplaza Ionicons completamente con texto/emoji
// Misma API: <Icon name="play" size={24} color="#fff" style={...} />
import React from 'react';
import { Text, View } from 'react-native';

const MAP = {
  // Playback
  'play':                       '▶',
  'pause':                      'Ⅱ',
  'play-skip-forward':          '|▶',
  'play-skip-back':             '◀|',
  'repeat':                     '↻',
  // Favorites
  'heart':                      '♥',
  'heart-outline':              '♡',
  // Music
  'musical-note':               '♪',
  'musical-notes':              '♫',
  // Navigation
  'grid':                       '⊞',
  'list':                       '☰',
  'list-outline':               '☰',
  'search-outline':             '🔍',
  'chevron-down':               '⌄',
  'chevron-back':               '‹',
  'chevron-forward':            '›',
  // Actions
  'add':                        '+',
  'close-outline':              '✕',
  'close-circle':               '✕',
  'trash-outline':              '🗑',
  'refresh-outline':            '↻',
  'reload':                     '↻',
  'sync':                       '↻',
  'camera':                     '📷',
  'cloud-upload-outline':       '↑',
  'checkmark-circle':           '✓',
  'time-outline':               '○',
  'person-outline':             '👤',
  'lock-closed-outline':        '🔒',
  'eye-outline':                '👁',
  'eye-off-outline':            '🙈',
  'arrow-up-circle':            '⬆',
  'download-outline':           '⬇',
  'settings-outline':           '⚙',
  'information-circle-outline': 'ℹ',
};

export default function Icon({ name, size = 24, color = '#fff', style }) {
  if (name === 'log-out-outline') {
    return (
      <View style={[{ width: size, height: size, justifyContent: 'center' }, style]} accessible={false}>
        <View style={{
          position: 'absolute', left: size * 0.08, top: size * 0.15,
          width: size * 0.43, height: size * 0.7,
          borderLeftWidth: 2, borderTopWidth: 2, borderBottomWidth: 2,
          borderColor: color, borderTopLeftRadius: 2, borderBottomLeftRadius: 2,
        }} />
        <View style={{
          position: 'absolute', left: size * 0.3, top: size * 0.48,
          width: size * 0.48, height: 2, backgroundColor: color,
        }} />
        <View style={{
          position: 'absolute', right: size * 0.04, top: size * 0.31,
          width: 0, height: 0, borderTopWidth: size * 0.19,
          borderBottomWidth: size * 0.19, borderLeftWidth: size * 0.28,
          borderTopColor: 'transparent', borderBottomColor: 'transparent',
          borderLeftColor: color,
        }} />
      </View>
    );
  }

  if (name === 'repeat') {
    return (
      <View style={[{ width: size, height: size }, style]} accessible={false}>
        <View style={{ position: 'absolute', top: size * 0.27, left: size * 0.14, width: size * 0.66, height: size * 0.2, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, borderTopRightRadius: size * 0.1 }} />
        <View style={{ position: 'absolute', top: size * 0.17, right: size * 0.05, width: 0, height: 0, borderTopWidth: size * 0.13, borderBottomWidth: size * 0.13, borderLeftWidth: size * 0.2, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color }} />
        <View style={{ position: 'absolute', bottom: size * 0.27, right: size * 0.14, width: size * 0.66, height: size * 0.2, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: color, borderBottomLeftRadius: size * 0.1 }} />
        <View style={{ position: 'absolute', bottom: size * 0.17, left: size * 0.05, width: 0, height: 0, borderTopWidth: size * 0.13, borderBottomWidth: size * 0.13, borderRightWidth: size * 0.2, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color }} />
      </View>
    );
  }

  if (name === 'play' || name === 'pause' || name === 'play-skip-forward' || name === 'play-skip-back') {
    const triangle = {
      width: 0,
      height: 0,
      borderTopWidth: size * 0.28,
      borderBottomWidth: size * 0.28,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    };
    const isBack = name === 'play-skip-back';
    const isSkip = isBack || name === 'play-skip-forward';
    const pointsLeft = name === 'play' ? false : isBack;
    const triangleStyle = {
      ...triangle,
      ...(pointsLeft
        ? { borderRightWidth: size * (isSkip ? 0.34 : 0.48), borderRightColor: color }
        : { borderLeftWidth: size * (isSkip ? 0.34 : 0.48), borderLeftColor: color }),
    };

    return (
      <View style={[{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, style]} accessible={false}>
        {isBack && <View style={triangleStyle} />}
        {isSkip && <View style={{ width: 2, height: size * 0.54, backgroundColor: color, borderRadius: 1, marginHorizontal: 1 }} />}
        {name === 'pause' ? (
          <>
            <View style={{ width: size * 0.16, height: size * 0.62, borderRadius: 1, backgroundColor: color, marginHorizontal: size * 0.06 }} />
            <View style={{ width: size * 0.16, height: size * 0.62, borderRadius: 1, backgroundColor: color, marginHorizontal: size * 0.06 }} />
          </>
        ) : name === 'play' || !isBack ? <View style={triangleStyle} /> : null}
      </View>
    );
  }

  const symbol = MAP[name] || '•';
  return (
    <Text
      style={[
        {
          fontSize: size * 0.85,
          color,
          textAlign: 'center',
          // Forzar rendering de emoji en color
          fontFamily: undefined,
        },
        style,
      ]}
      allowFontScaling={false}
    >
      {symbol}
    </Text>
  );
}