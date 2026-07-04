import React from 'react';
import { useTheme } from '@/context/ThemeContext';

/**
 * ThemeSwitcher – placed in the UX menu (next to language & currency selectors).
 * Allows the user to select a visual theme (default, v4, v5, neon) and toggle
 * light/dark mode. The component uses the ThemeContext to persist choices to
 * Firestore/localStorage (handled by ThemeContext).
 */
export const ThemeSwitcher = () => {
  const { theme, mode, setTheme, toggleMode } = useTheme();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as any; // ThemeOption
    setTheme(selected);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Theme selection dropdown */}
      <select
        value={theme}
        onChange={handleThemeChange}
        className="rounded border p-1 bg-white dark:bg-gray-800 text-sm"
        aria-label="Select visual theme"
      >
        <option value="default">Default</option>
        <option value="v4">V4</option>
        <option value="v5">V5</option>
        <option value="neon">Neon</option>
      </select>

      {/* Light/Dark toggle button */}
      <button
        onClick={toggleMode}
        className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-sm"
        aria-label="Toggle light/dark mode"
      >
        {mode === 'light' ? '🌞' : '🌙'}
      </button>
    </div>
  );
};
