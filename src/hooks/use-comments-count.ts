"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';

export function useCommentsCount(
  collectionName: 'deals' | 'products',
  docId: string,
  initialCount?: number
) {
  const [count, setCount] = useState<number>(typeof initialCount === 'number' ? initialCount : 0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        setLoading(true);
        const commentsCol = collection(db, `${collectionName}/${docId}/comments`);
        const snapshot = await getCountFromServer(commentsCol);
        if (!cancelled) setCount(snapshot.data().count || 0);
      } catch (e) {
        // Silent fallback, keep initialCount
        if (!cancelled && typeof initialCount !== 'number') setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Tylko jeśli nie mamy wiarygodnego initialCount albo chcemy odświeżyć
    if (typeof initialCount !== 'number') {
      fetchCount();
    }

    return () => { cancelled = true; };
  }, [collectionName, docId, initialCount]);

  return { count, loading };
}
