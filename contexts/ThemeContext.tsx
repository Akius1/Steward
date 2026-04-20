import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DARK_COLORS, LIGHT_COLORS, FONTS, type ColorPalette } from '@/constants/theme';

const STORAGE_KEY = 'steward_color_mode';

export type ColorMode = 'dark' | 'light' | 'system';

interface ThemeCtxValue {
  isDark: boolean;
  colors: ColorPalette;
  fonts: typeof FONTS;
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  toggleColorMode: () => void;
}

const ThemeCtx = createContext<ThemeCtxValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [colorMode, setColorModeState] = useState<ColorMode>('system');

  // Restore persisted mode on first mount
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setColorModeState(stored);
      }
    }).catch(() => {/* ignore — defaults to system */});
  }, []);

  const setColorMode = useCallback((m: ColorMode) => {
    setColorModeState(m);
    SecureStore.setItemAsync(STORAGE_KEY, m).catch(() => {});
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev: ColorMode) => (prev === 'dark' ? 'light' : 'dark'));
  }, [setColorMode]);

  const isDark =
    colorMode === 'system' ? systemScheme === 'dark' : colorMode === 'dark';

  return (
    <ThemeCtx.Provider
      value={{
        isDark,
        colors: isDark ? DARK_COLORS : LIGHT_COLORS,
        fonts: FONTS,
        colorMode,
        setColorMode,
        toggleColorMode,
      }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme(): ThemeCtxValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
