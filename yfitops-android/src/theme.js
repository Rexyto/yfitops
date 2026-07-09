import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'yfitops_theme';

// ── Paletas ──────────────────────────────────────────────────
// Mismos colores exactos que la app de PC (index.html), para que
// el tema se vea y se llame igual en los dos sitios.
const PALETTES = {
  dark: {
    bg0: '#0a0a0a', bg1: '#0f0f0f', bg2: '#111111', bg3: '#1a1a1a', bg4: '#1e1e1e',
    border: '#222222', borderStrong: '#2a2a2a',
    text: '#ffffff', textSecondary: '#cccccc', textMuted: '#888888', textDim: '#666666', textFaint: '#444444',
    overlay: 'rgba(0,0,0,0.75)', statusBar: 'light',
  },
  light: {
    bg0: '#f4f4f6', bg1: '#ffffff', bg2: '#ffffff', bg3: '#ececec', bg4: '#e6e6e6',
    border: '#e0e0e0', borderStrong: '#d2d2d2',
    text: '#111111', textSecondary: '#333333', textMuted: '#6e6e6e', textDim: '#8a8a8a', textFaint: '#aaaaaa',
    overlay: 'rgba(20,20,20,0.5)', statusBar: 'dark',
  },
  red: {
    bg0: '#f2f2f7', bg1: '#ffffff', bg2: '#ffffff', bg3: '#fdeeed', bg4: '#fbdedb',
    border: '#ffd9d6', borderStrong: '#ffb3ac',
    text: '#1c1c1e', textSecondary: '#3a3a3c', textMuted: '#6e6e73', textDim: '#8e8e93', textFaint: '#c7c7cc',
    overlay: 'rgba(28,28,30,0.4)', statusBar: 'dark',
  },
  sky: {
    bg0: '#f2f6fa', bg1: '#ffffff', bg2: '#ffffff', bg3: '#eaf5fc', bg4: '#dcecf7',
    border: '#cfe8f7', borderStrong: '#a8d8f0',
    text: '#1c1c1e', textSecondary: '#3a3a3c', textMuted: '#6e6e73', textDim: '#8e8e93', textFaint: '#c7c7cc',
    overlay: 'rgba(20,40,55,0.4)', statusBar: 'dark',
  },
  purple: {
    bg0: '#1e1a24', bg1: '#241f2b', bg2: '#2b2433', bg3: '#332b3d', bg4: '#3a3145',
    border: '#3a3145', borderStrong: '#493c56',
    text: '#ece6f5', textSecondary: '#c9bdd9', textMuted: '#9c8bb0', textDim: '#7a6a8c', textFaint: '#574a66',
    overlay: 'rgba(10,6,16,0.75)', statusBar: 'light',
  },
  green: {
    bg0: '#f1f8f3', bg1: '#ffffff', bg2: '#ffffff', bg3: '#e8f7ec', bg4: '#dbf0e1',
    border: '#cdeed7', borderStrong: '#a3ddb4',
    text: '#1c1c1e', textSecondary: '#3a3a3c', textMuted: '#6e6e73', textDim: '#8e8e93', textFaint: '#c7c7cc',
    overlay: 'rgba(20,40,28,0.4)', statusBar: 'dark',
  },
  orange: {
    bg0: '#fdf6f0', bg1: '#ffffff', bg2: '#ffffff', bg3: '#fdecdc', bg4: '#fbe0c6',
    border: '#fddfb8', borderStrong: '#ffc98a',
    text: '#1c1c1e', textSecondary: '#3a3a3c', textMuted: '#6e6e73', textDim: '#8e8e93', textFaint: '#c7c7cc',
    overlay: 'rgba(40,26,10,0.4)', statusBar: 'dark',
  },
  amber: {
    bg0: '#fdfbf0', bg1: '#ffffff', bg2: '#ffffff', bg3: '#fdf6d9', bg4: '#fbefbc',
    border: '#fbeba3', borderStrong: '#f5db61',
    text: '#1c1c1e', textSecondary: '#3a3a3c', textMuted: '#6e6e73', textDim: '#8e8e93', textFaint: '#c7c7cc',
    overlay: 'rgba(40,34,6,0.4)', statusBar: 'dark',
  },
  pink: {
    bg0: '#241118', bg1: '#2b141d', bg2: '#331824', bg3: '#3d1c2b', bg4: '#472133',
    border: '#472133', borderStrong: '#5c2941',
    text: '#fbe6ee', textSecondary: '#e3bccd', textMuted: '#ab7f92', textDim: '#8c6474', textFaint: '#614450',
    overlay: 'rgba(15,4,9,0.8)', statusBar: 'light',
  },
  teal: {
    bg0: '#0f1f21', bg1: '#132529', bg2: '#172c31', bg3: '#1b333a', bg4: '#203b43',
    border: '#203b43', borderStrong: '#2a4b54',
    text: '#e3f6f9', textSecondary: '#bfe3e9', textMuted: '#7fa8ae', textDim: '#63868c', textFaint: '#445d61',
    overlay: 'rgba(4,12,13,0.8)', statusBar: 'light',
  },
  indigo: {
    bg0: '#171a24', bg1: '#1c1f2b', bg2: '#212431', bg3: '#272b3c', bg4: '#2e3247',
    border: '#2e3247', borderStrong: '#3a3f59',
    text: '#e8eaf9', textSecondary: '#c3c8ec', textMuted: '#8b90bd', textDim: '#6c7099', textFaint: '#4b4e6d',
    overlay: 'rgba(6,7,14,0.8)', statusBar: 'light',
  },
};

// swatch = [color principal, color secundario] para pintar la bolita
// del selector partida en diagonal (igual que en PC).
export const THEMES = [
  { id: 'dark',   swatch: ['#1a1a1a', '#0a0a0a'] },
  { id: 'light',  swatch: ['#ffffff', '#e2e2e2'] },
  { id: 'red',    swatch: ['#FF3B30', '#ffffff'] },
  { id: 'sky',    swatch: ['#2AABEE', '#ffffff'] },
  { id: 'purple', swatch: ['#BF5AF2', '#1e1a24'] },
  { id: 'green',  swatch: ['#25D366', '#ffffff'] },
  { id: 'orange', swatch: ['#FF5500', '#ffffff'] },
  { id: 'amber',  swatch: ['#FFCC00', '#ffffff'] },
  { id: 'pink',   swatch: ['#FF375F', '#241118'] },
  { id: 'teal',   swatch: ['#30B0C7', '#0f1f21'] },
  { id: 'indigo', swatch: ['#5865F2', '#171a24'] },
];
const THEME_IDS = THEMES.map(t => t.id);

const ThemeContext = createContext({ theme: 'dark', colors: PALETTES.dark, setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved && THEME_IDS.includes(saved)) setThemeState(saved);
    }).catch(() => {});
  }, []);

  const setTheme = (t) => {
    if (!THEME_IDS.includes(t)) return;
    setThemeState(t);
    AsyncStorage.setItem(THEME_KEY, t).catch(() => {});
  };

  const colors = useMemo(() => PALETTES[theme] || PALETTES.dark, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
