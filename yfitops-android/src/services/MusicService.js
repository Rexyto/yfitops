// src/services/MusicService.js
// Servicio de background para react-native-track-player
// Corre en un hilo nativo separado → funciona con pantalla apagada

module.exports = async function () {
  const TrackPlayer = require('react-native-track-player');

  TrackPlayer.addEventListener('remote-play',     () => TrackPlayer.play());
  TrackPlayer.addEventListener('remote-pause',    () => TrackPlayer.pause());
  TrackPlayer.addEventListener('remote-next',     () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener('remote-previous', () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener('remote-stop',     () => TrackPlayer.reset());
  TrackPlayer.addEventListener('remote-seek',     ({ position }) => TrackPlayer.seekTo(position));
  TrackPlayer.addEventListener('remote-duck',     async ({ permanent, paused }) => {
    if (permanent) await TrackPlayer.reset();
    else if (paused) await TrackPlayer.pause();
    else await TrackPlayer.play();
  });
};