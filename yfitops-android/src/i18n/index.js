import { useSettings } from '../context/SettingsContext';
import { translate } from './translations';

export function useT() {
  const { language } = useSettings();
  return (key, ...args) => translate(language, key, ...args);
}

export default useT;
