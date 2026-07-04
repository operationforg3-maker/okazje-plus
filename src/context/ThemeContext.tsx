import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase'; // assume firebase init exports db

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
  const [theme, setThemeState] = useState<ThemeOption>('default');
  const [mode, setMode] = useState<ModeOption>('light');

  // Load from Firestore (if logged in) or from localStorage fallback
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First try localStorage for quick load
        const stored = localStorage.getItem('userThemeSettings');
        if (stored) {
          const { theme: t, mode: m } = JSON.parse(stored);
          setThemeState(t);
          setMode(m);
          return;
        }
        // If not in localStorage, attempt to fetch from Firestore for authenticated users
        const user = auth.currentUser;
        if (user) {
          const settingsRef = doc(db, 'users', user.uid, 'settings', 'theme');
          const snap = await getDoc(settingsRef);
          if (snap.exists()) {
            const data = snap.data();
            const { theme: t, mode: m } = data as { theme: ThemeOption; mode: ModeOption };
            setThemeState(t);
            setMode(m);
          }
        }
      } catch (e) {
        console.error('Failed to load theme settings', e);
      }
    };
    loadSettings();
  }, []);

  const persist = async (newTheme: ThemeOption, newMode: ModeOption) => {
    try {
      localStorage.setItem('userThemeSettings', JSON.stringify({ theme: newTheme, mode: newMode }));
      // If authenticated, also write to Firestore
      const user = auth.currentUser;
      if (user) {
        const settingsRef = doc(db, 'users', user.uid, 'settings', 'theme');
        await setDoc(settingsRef, { theme: newTheme, mode: newMode }, { merge: true });
      }
    } catch (e) {
      console.error('Persist theme failed', e);
    }
  };

  const setTheme = (newTheme: ThemeOption) => {
    setThemeState(newTheme);
    persist(newTheme, mode);
  };

  const toggleMode = () => {
    const newMode: ModeOption = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    persist(theme, newMode);
  };

  // Apply CSS variables on root element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-mode', mode);
  }, [theme, mode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
