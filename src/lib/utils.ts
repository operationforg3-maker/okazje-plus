import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Uniwersalna konwersja wartości daty / czasu na liczbowy timestamp (ms since epoch)
// Obsługuje: Firestore Timestamp, Date, string ISO/number oraz null/undefined (zwraca 0)
export function toTimestamp(value: any): number {
  if (!value) return 0;
  try {
    // Firestore Timestamp
    if (typeof value === 'object' && value !== null) {
      // firebase-admin Timestamp ma metody toMillis / seconds
      if (typeof (value as any).toMillis === 'function') {
        return (value as any).toMillis();
      }
      if ('seconds' in value && typeof value.seconds === 'number') {
        return value.seconds * 1000;
      }
      if (value instanceof Date) return value.getTime();
    }
    if (typeof value === 'number') {
      // Zakładamy ms jeśli jest > 10^10, w przeciwnym wypadku sekundy
      if (value < 1e11) return value * 1000; // prawdopodobnie sekundy
      return value;
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date.getTime();
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed < 1e11 ? parsed * 1000 : parsed;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Chunks an array into smaller arrays of a specified size.
 *
 * @param array The array to chunk.
 * @param size The size of each chunk.
 * @returns An array of chunks.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (!array) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function getExternalUrl(...candidates: Array<string | null | undefined>): string | null {
  const rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  const internalHosts = new Set<string>([
    'okazjeplus.pl',
    'okazje-plus-backend--okazje-plus.europe-west4.hosted.app',
    'localhost',
  ]);

  if (rawSiteUrl) {
    try {
      internalHosts.add(new URL(rawSiteUrl).hostname);
    } catch {
      // ignore invalid site url
    }
  }

  for (const candidate of candidates) {
    const url = String(candidate || '').trim();
    if (!url) continue;
    if (url.startsWith('/')) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (internalHosts.has(host) || host.endsWith('.okazjeplus.pl')) {
        continue;
      }
      return url;
    } catch {
      continue;
    }
  }

  return null;
}
