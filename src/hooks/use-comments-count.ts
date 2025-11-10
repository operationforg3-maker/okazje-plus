"use client";
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export function useCommentsCount(
  collectionName: 'deals' | 'products',
  docId: string,
  initialCount?: number
) {
  const [baseCount, setBaseCount] = useState<number>(typeof initialCount === 'number' ? initialCount : 0);
  const [optimisticDelta, setOptimisticDelta] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    try {
      setLoading(true);
      const commentsCol = collection(db, `${collectionName}/${docId}/comments`);

      const unsubscribe = onSnapshot(
        commentsCol,
        (snapshot) => {
          // Aktualizuj bazowy count (pochodzący z Firestore)
          setBaseCount(snapshot.size);
          // Po otrzymaniu rzeczywistego snapshotu, zresetuj optymistyczny delta
          setOptimisticDelta(0);
          setLoading(false);
        },
        (error) => {
          console.error('Comments listener error:', error);
          setBaseCount(typeof initialCount === 'number' ? initialCount : 0);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to set up comments listener:', error);
      setBaseCount(typeof initialCount === 'number' ? initialCount : 0);
      setLoading(false);
    }
  }, [collectionName, docId, initialCount]);

  const increment = useCallback((delta = 1) => {
    setOptimisticDelta((d) => d + delta);
  }, []);

  const decrement = useCallback((delta = 1) => {
    setOptimisticDelta((d) => d - delta);
  }, []);

  const count = baseCount + optimisticDelta;
  return { count, loading, increment, decrement } as const;
}
