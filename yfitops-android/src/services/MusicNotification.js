// src/services/MusicNotification.js
// Notificación persistente con controles en pantalla bloqueada
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';

const CHANNEL_ID = 'yfitops-music';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'YFitops - Música',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: null,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationCategoryAsync('music-controls', [
    {
      identifier: 'prev',
      buttonTitle: '⏮ Anterior',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'toggle',
      buttonTitle: '⏯ Play/Pausa',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'next',
      buttonTitle: '⏭ Siguiente',
      options: { opensAppToForeground: false },
    },
  ]);
}

export async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function showMusicNotification({ title, artist, isPlaying }) {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      identifier: 'yfitops-player',
      content: {
        title: title || 'YFitops',
        body: artist || 'Reproduciendo',
        data: { type: 'music' },
        categoryIdentifier: 'music-controls',
        color: '#1ed760',
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });
  } catch (e) {
    console.log('Notification error:', e.message);
  }
}

export async function dismissMusicNotification() {
  try { await Notifications.dismissAllNotificationsAsync(); } catch {}
}

export function addNotificationResponseListener(handlers) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const action = response.actionIdentifier;
    if (action === 'prev') handlers.onPrev?.();
    else if (action === 'next') handlers.onNext?.();
    else if (action === 'toggle') handlers.onToggle?.();
  });
}