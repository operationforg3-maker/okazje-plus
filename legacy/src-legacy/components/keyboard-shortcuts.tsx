'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

const shortcuts: KeyboardShortcut[] = [
  {
    key: 'k',
    ctrlKey: true,
    action: () => {
      const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Szukaj"]');
      searchInput?.focus();
    },
    description: 'Otwórz wyszukiwarkę',
  },
  {
    key: 'n',
    ctrlKey: true,
    action: () => {
      window.location.href = '/add-deal';
    },
    description: 'Dodaj nową okazję',
  },
  {
    key: 'h',
    ctrlKey: true,
    action: () => {
      window.location.href = '/';
    },
    description: 'Strona główna',
  },
  {
    key: 'd',
    ctrlKey: true,
    action: () => {
      window.location.href = '/deals';
    },
    description: 'Wszystkie okazje',
  },
  {
    key: 'p',
    ctrlKey: true,
    action: () => {
      window.location.href = '/products';
    },
    description: 'Produkty',
  },
  {
    key: '/',
    ctrlKey: false,
    action: () => {
      toast.info('Skróty klawiszowe', {
        description: shortcuts.map(s => `${s.ctrlKey ? 'Ctrl+' : ''}${s.key.toUpperCase()}: ${s.description}`).join('\n'),
        duration: 5000,
      });
    },
    description: 'Pokaż skróty klawiszowe',
  },
];

export function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcuts.find(s => 
        s.key.toLowerCase() === e.key.toLowerCase() &&
        !!s.ctrlKey === (e.ctrlKey || e.metaKey) &&
        !!s.shiftKey === e.shiftKey &&
        !!s.altKey === e.altKey
      );

      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}
