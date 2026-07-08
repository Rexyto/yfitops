import useSettingsStore from '../store/SettingsStore';
import { translate } from './translations';

// useT() -> t('some.key', ...args)
// Se re-renderiza automáticamente cuando cambia el idioma, porque
// suscribe el componente al campo `language` del store de ajustes.
export function useT() {
  const language = useSettingsStore(s => s.language);
  return (key, ...args) => translate(language, key, ...args);
}

export default useT;
