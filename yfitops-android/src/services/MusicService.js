import TrackPlayer, { Event } from 'react-native-track-player';

export default async function MusicService() {
  let previousPressedAt = 0;

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    previousPressedAt = 0;
    TrackPlayer.play().catch(error => console.error('Could not resume from media controls:', error));
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    previousPressedAt = 0;
    TrackPlayer.pause().catch(error => console.error('Could not pause from media controls:', error));
  });
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    previousPressedAt = 0;
    try {
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
    } catch (error) {
      console.error('Could not skip from media controls:', error);
    }
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const now = Date.now();
    const isDoublePress = now - previousPressedAt <= 700;
    previousPressedAt = isDoublePress ? 0 : now;
    try {
      if (isDoublePress) {
        const [tracks, activeIndex] = await Promise.all([
          TrackPlayer.getQueue(),
          TrackPlayer.getActiveTrackIndex(),
        ]);
        if (tracks.length > 1 && activeIndex !== undefined) {
          await TrackPlayer.skip(activeIndex > 0 ? activeIndex - 1 : tracks.length - 1);
          await TrackPlayer.play();
        } else {
          await TrackPlayer.seekTo(0);
        }
      } else {
        await TrackPlayer.seekTo(0);
      }
    } catch (error) {
      console.error('Could not seek backward from media controls:', error);
    }
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.reset().catch(error => console.error('Could not stop playback:', error));
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    previousPressedAt = 0;
    TrackPlayer.seekTo(position).catch(error => console.error('Could not seek from media controls:', error));
  });

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async ({ index }) => {
    if (index === undefined || index === 0) return;

    try {
      const tracks = await TrackPlayer.getQueue();
      const consumedQueueTracks = tracks
        .slice(0, index)
        .reduce((indexes, track, trackIndex) => {
          if (track.queueEntryId) indexes.push(trackIndex);
          return indexes;
        }, []);

      if (consumedQueueTracks.length) {
        await TrackPlayer.remove(consumedQueueTracks);
      }
    } catch (error) {
      console.error('Could not clean up consumed queue tracks:', error);
    }
  });
}