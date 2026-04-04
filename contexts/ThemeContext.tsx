import React, { createContext, useContext, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { DARK_COLORS, LIGHT_COLORS, FONTS, type ColorPalette } from '@/constants/theme';

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
  const [colorMode, setColorMode] = useState<ColorMode>('system');

  const isDark =
    colorMode === 'system' ? systemScheme === 'dark' : colorMode === 'dark';

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

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
