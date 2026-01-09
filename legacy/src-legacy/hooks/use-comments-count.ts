"use client";
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, getCountFromServer } from 'firebase/firestore';

export function useCommentsCount(
  collectionName: 'deals' | 'products',
  docId: string,
  initialCount?: number
) {
  const [baseCount, setBaseCount] = useState<number>(typeof initialCount === 'number' ? initialCount : 0);
  const [optimisticDelta, setOptimisticDelta] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    async function setup() {
      try {
        setLoading(true);
        const commentsCol = collection(db, `${collectionName}/${docId}/comments`);

        // 1) Spróbuj ustawić real-time listener
        unsub = onSnapshot(
          commentsCol,
          (snapshot) => {
            if (cancelled) return;
            setBaseCount(snapshot.size);
            setOptimisticDelta(0);
            setLoading(false);
          },
          async (error) => {
            console.error('Comments listener error:', error);
            // 2) Fallback: jeśli mamy initialCount użyj, dodatkowo spróbuj jednorazowego zliczenia z serwera
            const fallback = typeof initialCount === 'number' ? initialCount : 0;
            setBaseCount(fallback);
            try {
              const agg = await getCountFromServer(commentsCol);
              if (!cancelled) {
                const srvCount = (agg.data() as any).count as number;
                setBaseCount(typeof srvCount === 'number' ? srvCount : fallback);
              }
            } catch (e) {
              // Ignoruj jeśli brak uprawnień/indeksów
              console.warn('getCountFromServer failed, using fallback count');
            } finally {
              if (!cancelled) setLoading(false);
            }
          }
        );

        // 3) Jeśli nie dostarczono initialCount, zainicjalizuj licznik jednorazowo zanim przyjdzie snapshot
        if (typeof initialCount !== 'number') {
          try {
            const agg = await getCountFromServer(commentsCol);
            if (!cancelled) {
              const srvCount = (agg.data() as any).count as number;
              if (typeof srvCount === 'number') setBaseCount(srvCount);
            }
          } catch {
            // brak dostępu – zostaw 0 do czasu snapshota lub fallbacku
          } finally {
            if (!cancelled) setLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to set up comments listener:', error);
        setBaseCount(typeof initialCount === 'number' ? initialCount : 0);
        setLoading(false);
      }
    }

    void setup();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
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
