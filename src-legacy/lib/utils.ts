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
