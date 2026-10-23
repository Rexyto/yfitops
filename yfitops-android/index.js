import { registerRootComponent } from 'expo';
import { AppRegistry, Platform } from 'react-native';
import App from './App';

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('TrackPlayer', () => require('./src/services/MusicService').default);
}
registerRootComponent(App);
