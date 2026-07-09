// plugins/withMusicForegroundService.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withMusicForegroundService(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    if (!mainApplication.service) mainApplication.service = [];
    if (!mainApplication.receiver) mainApplication.receiver = [];

    // ── Foreground Service (expo-av 16.x / SDK 52+) ──────────────
    // Nombre correcto para expo-av moderno (bare/managed workflow)
    const FG_SERVICE = 'expo.modules.av.AVForegroundService';
    if (!mainApplication.service.some(s => s.$['android:name'] === FG_SERVICE)) {
      mainApplication.service.push({
        $: {
          'android:name': FG_SERVICE,
          'android:foregroundServiceType': 'mediaPlayback',
          'android:exported': 'false',
          'android:stopWithTask': 'false',
        },
      });
    }

    // ── Media Button Receiver ─────────────────────────────────────
    const MB_RECEIVER = 'androidx.media.session.MediaButtonReceiver';
    if (!mainApplication.receiver.some(r => r.$['android:name'] === MB_RECEIVER)) {
      mainApplication.receiver.push({
        $: {
          'android:name': MB_RECEIVER,
          'android:exported': 'true',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.intent.action.MEDIA_BUTTON' } }],
        }],
      });
    }

    return config;
  });
};