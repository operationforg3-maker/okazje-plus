"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UXSettings {
  viewMode: 'grid' | 'list' | 'masonry';
  themeFamily: 'classic' | 'v4' | 'v5' | 'neon';
  themeMode: 'light' | 'dark';
  selectedCategories: string[];
}

interface UXContextProps {
  viewMode: UXSettings['viewMode'];
  themeFamily: UXSettings['themeFamily'];
  themeMode: UXSettings['themeMode'];
  selectedCategories: string[];
  setViewMode: (mode: UXSettings['viewMode']) => void;
  setThemeFamily: (family: UXSettings['themeFamily']) => void;
  setThemeMode: (mode: UXSettings['themeMode']) => void;
  toggleThemeMode: () => void;
  setSelectedCategories: (categories: string[]) => void;
}

const UXContext = createContext<UXContextProps | undefined>(undefined);

export const UXProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<UXSettings['viewMode']>('grid');
  const [themeFamily, setThemeFamily] = useState<UXSettings['themeFamily']>('classic');
  const [themeMode, setThemeMode] = useState<UXSettings['themeMode']>('dark'); // Default to dark as per App guidelines
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Load initial settings from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('uxSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
        if (parsed.themeFamily) setThemeFamily(parsed.themeFamily);
        if (parsed.themeMode) setThemeMode(parsed.themeMode);
      } else {
        // Fallbacks for individual storage keys
        const legacyVariant = localStorage.getItem('okp_theme_variant') as any;
        if (legacyVariant) setThemeFamily(legacyVariant);
        const legacyTheme = localStorage.getItem('okp_theme') as any;
        if (legacyTheme) setThemeMode(legacyTheme);
      }
    } catch {}
  }, []);

  // Load from Firestore if user is authenticated
  useEffect(() => {
    if (!user) return;
    const fetchDbSettings = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.uxSettings) {
            const { viewMode: dbViewMode, themeFamily: dbThemeFamily, themeMode: dbThemeMode } = data.uxSettings;
            if (dbViewMode) setViewMode(dbViewMode);
            if (dbThemeFamily) setThemeFamily(dbThemeFamily);
            if (dbThemeMode) setThemeMode(dbThemeMode);
          }
        }
      } catch (err) {
        console.warn('Failed to load user uxSettings from Firestore:', err);
      }
    };
    fetchDbSettings();
  }, [user]);

  // Apply attributes and classes to HTML document root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeFamily === 'classic' ? 'default' : themeFamily);
    root.setAttribute('data-mode', themeMode);
    root.classList.toggle('dark', themeMode === 'dark');
    root.style.colorScheme = themeMode;

    // Apply class names for CSS overrides if needed
    root.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) root.classList.remove(cls);
    });
    if (themeFamily !== 'classic') {
      root.classList.add(`theme-${themeFamily}`);
    }
  }, [themeFamily, themeMode]);

  const persistSettings = async (
    vMode: UXSettings['viewMode'],
    tFamily: UXSettings['themeFamily'],
    tMode: UXSettings['themeMode']
  ) => {
    try {
      localStorage.setItem('uxSettings', JSON.stringify({ viewMode: vMode, themeFamily: tFamily, themeMode: tMode }));
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uxSettings: { viewMode: vMode, themeFamily: tFamily, themeMode: tMode }
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Failed to save user uxSettings:', err);
    }
  };

  const changeViewMode = (mode: UXSettings['viewMode']) => {
    setViewMode(mode);
    persistSettings(mode, themeFamily, themeMode);
  };

  const changeThemeFamily = (family: UXSettings['themeFamily']) => {
    setThemeFamily(family);
    persistSettings(viewMode, family, themeMode);
  };

  const changeThemeMode = (mode: UXSettings['themeMode']) => {
    setThemeMode(mode);
    persistSettings(viewMode, themeFamily, mode);
  };

  const toggleThemeMode = () => {
    const nextMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
    persistSettings(viewMode, themeFamily, nextMode);
  };

  return (
    <UXContext.Provider
      value={{
        viewMode,
        themeFamily,
        themeMode,
        selectedCategories,
        setViewMode: changeViewMode,
        setThemeFamily: changeThemeFamily,
        setThemeMode: changeThemeMode,
        toggleThemeMode,
        setSelectedCategories,
      }}
    >
      {children}
    </UXContext.Provider>
  );
};

export const useUX = () => {
  const context = useContext(UXContext);
  if (!context) {
    throw new Error('useUX must be used within a UXProvider');
  }
  return context;
};
