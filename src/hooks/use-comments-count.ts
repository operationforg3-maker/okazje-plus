"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export function useCommentsCount(
  collectionName: 'deals' | 'products',
  docId: string,
  initialCount?: number
) {
  const [count, setCount] = useState<number>(typeof initialCount === 'number' ? initialCount : 0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    try {
      setLoading(true);
      const commentsCol = collection(db, `${collectionName}/${docId}/comments`);
      
      // Real-time listener — automatycznie aktualizuje licznik gdy komentarz zostanie dodany/usunięty
      const unsubscribe = onSnapshot(
        commentsCol,
        (snapshot) => {
          setCount(snapshot.size);
          setLoading(false);
        },
        (error) => {
          console.error('Comments listener error:', error);
          // Fallback do initialCount w przypadku błędu
          setCount(typeof initialCount === 'number' ? initialCount : 0);
          setLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error('Failed to set up comments listener:', error);
      setCount(typeof initialCount === 'number' ? initialCount : 0);
      setLoading(false);
    }
  }, [collectionName, docId, initialCount]);

  return { count, loading };
}
