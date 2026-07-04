"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useUX } from './UXContext';

export type ThemeOption = 'default' | 'v4' | 'v5' | 'neon';
export type ModeOption = 'light' | 'dark';

interface ThemeContextProps {
  theme: ThemeOption;
  mode: ModeOption;
  setTheme: (theme: ThemeOption) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { themeFamily, themeMode, setThemeFamily, toggleThemeMode } = useUX();

  const themeMap: ThemeOption = themeFamily === 'classic' ? 'default' : themeFamily;

  const handleSetTheme = (t: ThemeOption) => {
    setThemeFamily(t === 'default' ? 'classic' : t);
  };

  return (
    <ThemeContext.Provider value={{ theme: themeMap, mode: themeMode, setTheme: handleSetTheme, toggleMode: toggleThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
