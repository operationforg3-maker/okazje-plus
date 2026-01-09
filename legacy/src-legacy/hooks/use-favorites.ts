"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { addToFavorites, removeFromFavorites, isFavorite } from '@/lib/data';
import { trackFirestoreFavorite } from '@/lib/analytics';

interface UseFavoritesReturn {
  isFavorited: boolean;
  isLoading: boolean;
  toggleFavorite: () => Promise<void>;
}

/**
 * Hook do zarządzania ulubionych dla okazji i produktów
 */
export function useFavorites(itemId: string, itemType: 'deal' | 'product'): UseFavoritesReturn {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Sprawdź początkowy stan
  useEffect(() => {
    if (!user) {
      setIsFavorited(false);
      setIsChecking(false);
      return;
    }

    const checkFavoriteStatus = async () => {
      try {
        const status = await isFavorite(user.uid, itemId, itemType);
        setIsFavorited(status);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkFavoriteStatus();
  }, [user, itemId, itemType]);

  const toggleFavorite = useCallback(async () => {
    if (!user) {
      // TODO: Pokazać modal logowania
      alert('Zaloguj się, aby dodawać do ulubionych');
      return;
    }

    setIsLoading(true);

    try {
      if (isFavorited) {
        await removeFromFavorites(user.uid, itemId, itemType);
        setIsFavorited(false);
        
        // Analytics (rejestrujemy remove jako action w metadata, ale nie liczymy do KPI)
        void trackFirestoreFavorite(itemType, itemId, user.uid, 'remove');
      } else {
        await addToFavorites(user.uid, itemId, itemType);
        setIsFavorited(true);
        
        // Analytics
        void trackFirestoreFavorite(itemType, itemId, user.uid, 'add');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Przywróć poprzedni stan w razie błędu
      setIsFavorited(!isFavorited);
    } finally {
      setIsLoading(false);
    }
  }, [user, itemId, itemType, isFavorited]);

  return {
    isFavorited,
    isLoading: isLoading || isChecking,
    toggleFavorite
  };
}
