import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface UXSettings {
  viewMode: 'grid' | 'list' | 'masonry';
  theme: 'light' | 'dark';
  selectedCategories: string[];
}

interface UXContextProps extends UXSettings {
  setViewMode: (mode: UXSettings['viewMode']) => void;
  toggleTheme: () => void;
  setSelectedCategories: (categories: string[]) => void;
}

const UXContext = createContext<UXContextProps | undefined>(undefined);

export const UXProvider = ({ children }: { children: ReactNode }) => {
  const [viewMode, setViewMode] = useState<UXSettings['viewMode']>('grid');
  const [theme, setTheme] = useState<UXSettings['theme']>('light');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Persist theme in localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as UXSettings['theme'] | null;
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  return (
    <UXContext.Provider
      value={{
        viewMode,
        theme,
        selectedCategories,
        setViewMode,
        toggleTheme,
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
