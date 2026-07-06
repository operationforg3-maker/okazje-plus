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
  cardDensity: 'comfortable' | 'compact';
}

interface UXContextProps {
  viewMode: UXSettings['viewMode'];
  themeFamily: UXSettings['themeFamily'];
  themeMode: UXSettings['themeMode'];
  selectedCategories: string[];
  cardDensity: UXSettings['cardDensity'];
  setViewMode: (mode: UXSettings['viewMode']) => void;
  setThemeFamily: (family: UXSettings['themeFamily']) => void;
  setThemeMode: (mode: UXSettings['themeMode']) => void;
  toggleThemeMode: () => void;
  setSelectedCategories: (categories: string[]) => void;
  setCardDensity: (density: UXSettings['cardDensity']) => void;
}

const UXContext = createContext<UXContextProps | undefined>(undefined);

export const UXProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<UXSettings['viewMode']>('grid');
  const [themeFamily, setThemeFamily] = useState<UXSettings['themeFamily']>('classic');
  const [themeMode, setThemeMode] = useState<UXSettings['themeMode']>('dark'); // Default to dark as per App guidelines
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [cardDensity, setCardDensity] = useState<UXSettings['cardDensity']>('comfortable');

  // Load initial settings from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('uxSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
        if (parsed.themeFamily) setThemeFamily(parsed.themeFamily);
        if (parsed.themeMode) setThemeMode(parsed.themeMode);
        if (parsed.cardDensity) setCardDensity(parsed.cardDensity);
      } else {
        // Fallbacks for individual storage keys
        const legacyVariant = localStorage.getItem('okp_theme_variant') as any;
        if (legacyVariant) setThemeFamily(legacyVariant);
        const legacyTheme = localStorage.getItem('okp_theme') as any;
        if (legacyTheme) setThemeMode(legacyTheme);
        const legacyDensity = localStorage.getItem('deals_density') as any;
        if (legacyDensity) setCardDensity(legacyDensity);
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
            const { viewMode: dbViewMode, themeFamily: dbThemeFamily, themeMode: dbThemeMode, cardDensity: dbCardDensity } = data.uxSettings;
            if (dbViewMode) setViewMode(dbViewMode);
            if (dbThemeFamily) setThemeFamily(dbThemeFamily);
            if (dbThemeMode) setThemeMode(dbThemeMode);
            if (dbCardDensity) setCardDensity(dbCardDensity);
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
    tMode: UXSettings['themeMode'],
    cDensity: UXSettings['cardDensity']
  ) => {
    try {
      localStorage.setItem('uxSettings', JSON.stringify({ viewMode: vMode, themeFamily: tFamily, themeMode: tMode, cardDensity: cDensity }));
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uxSettings: { viewMode: vMode, themeFamily: tFamily, themeMode: tMode, cardDensity: cDensity }
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Failed to save user uxSettings:', err);
    }
  };

  const changeViewMode = (mode: UXSettings['viewMode']) => {
    setViewMode(mode);
    persistSettings(mode, themeFamily, themeMode, cardDensity);
  };

  const changeThemeFamily = (family: UXSettings['themeFamily']) => {
    setThemeFamily(family);
    persistSettings(viewMode, family, themeMode, cardDensity);
  };

  const changeThemeMode = (mode: UXSettings['themeMode']) => {
    setThemeMode(mode);
    persistSettings(viewMode, themeFamily, mode, cardDensity);
  };

  const toggleThemeMode = () => {
    const nextMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
    persistSettings(viewMode, themeFamily, nextMode, cardDensity);
  };

  const changeCardDensity = (density: UXSettings['cardDensity']) => {
    setCardDensity(density);
    persistSettings(viewMode, themeFamily, themeMode, density);
  };

  return (
    <UXContext.Provider
      value={{
        viewMode,
        themeFamily,
        themeMode,
        selectedCategories,
        cardDensity,
        setViewMode: changeViewMode,
        setThemeFamily: changeThemeFamily,
        setThemeMode: changeThemeMode,
        toggleThemeMode,
        setSelectedCategories,
        setCardDensity: changeCardDensity,
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
