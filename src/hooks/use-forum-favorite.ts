import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

/**
 * Hook do zarządzania ulubionymi wątkami/postami forum
 * @param itemId - threadId lub postId
 * @param type - 'thread' lub 'post'
 * @param onToggle - Optional callback when favorite state changes
 */
export function useForumFavorite(
  itemId: string,
  type: 'thread' | 'post',
  onToggle?: (isFavorited: boolean) => void
) {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  // Sprawdź czy jest ulubione
  useEffect(() => {
    if (!user || !itemId) return;

    setIsLoading(true);
    fetch(`/api/forum/favorites/check?${type === 'thread' ? 'threadId' : 'postId'}=${itemId}`)
      .then((res) => res.json())
      .then((data) => {
        setIsFavorited(data.isFavorited || false);
        setFavoriteId(data.favoriteId || null);
      })
      .catch((err) => console.error('Check favorite error:', err))
      .finally(() => setIsLoading(false));
  }, [user, itemId, type]);

  const toggleFavorite = useCallback(async () => {
    if (!user) {
      toast.error('Musisz być zalogowany');
      return;
    }

    setIsLoading(true);
    try {
      if (isFavorited && favoriteId) {
        // Usuń z ulubionych
        const res = await fetch('/api/forum/favorites', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favoriteId }),
        });

        if (!res.ok) throw new Error('Failed to remove favorite');

        setIsFavorited(false);
        setFavoriteId(null);
        onToggle?.(false);
        toast.success('Usunięto z ulubionych');
      } else {
        // Dodaj do ulubionych
        const body =
          type === 'thread'
            ? { threadId: itemId, type }
            : { postId: itemId, type };

        const res = await fetch('/api/forum/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 409) {
            toast.info('Już w ulubionych');
            return;
          }
          throw new Error(data.error || 'Failed to add favorite');
        }

        const data = await res.json();
        setIsFavorited(true);
        setFavoriteId(data.id);
        onToggle?.(true);
        toast.success('Dodano do ulubionych');
      }
    } catch (error: any) {
      console.error('Toggle favorite error:', error);
      toast.error(error.message || 'Błąd przy zapisywaniu');
    } finally {
      setIsLoading(false);
    }
  }, [user, itemId, type, isFavorited, favoriteId, onToggle]);

  return { isFavorited, isLoading, toggleFavorite };
}
