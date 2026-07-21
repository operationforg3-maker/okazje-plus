'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

interface ImpressionOptions {
  category?: string;
  temperature?: number;
  merchant?: string;
  /** Minimalna widoczność (0-1), domyślnie 0.5 */
  threshold?: number;
}

/**
 * Hook śledzący widoczność elementu (IntersectionObserver).
 * Wysyła event `deal_impression` do GA4 gdy element staje się widoczny.
 * Event jest wysyłany tylko raz na sesję (sessionStorage guard).
 *
 * Użycie:
 * ```tsx
 * const ref = useImpressionTracker(deal.id, { category: deal.mainCategorySlug, temperature: deal.temperature });
 * return <div ref={ref}>{...}</div>
 * ```
 */
export function useImpressionTracker<T extends HTMLElement = HTMLDivElement>(
  dealId: string,
  options?: ImpressionOptions
) {
  const ref = useRef<T>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (!ref.current || tracked.current) return;

    // Sprawdź sessionStorage — nie trackuj ponownie w tej samej sesji
    const sessionKey = `imp_${dealId}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !tracked.current) {
            tracked.current = true;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(sessionKey, '1');
            }
            trackEvent('deal_impression', {
              deal_id: dealId,
              deal_category: options?.category,
              deal_temperature: options?.temperature,
              deal_merchant: options?.merchant,
            });
          }
        });
      },
      { threshold: options?.threshold ?? 0.5 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [dealId, options?.category, options?.temperature, options?.merchant, options?.threshold]);

  return ref;
}
