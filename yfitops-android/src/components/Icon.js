// src/components/Icon.js
// Reemplaza Ionicons completamente con texto/emoji
// Misma API: <Icon name="play" size={24} color="#fff" style={...} />
import React from 'react';
import { Text } from 'react-native';

const MAP = {
  // Playback
  'play':                       '▶',
  'pause':                      '⏸',
  'play-skip-forward':          '⏭',
  'play-skip-back':             '⏮',
  'repeat':                     '🔁',
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
  // Actions
  'add':                        '+',
  'close-outline':              '✕',
  'close-circle':               '✕',
  'trash-outline':              '🗑',
  'log-out-outline':            '⏏',
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