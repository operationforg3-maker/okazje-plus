/**
 * Standardowe rozmiary ikon dla całej aplikacji
 * Używaj tych klas zamiast definiować rozmiary inline dla lepszej spójności
 */

export const iconSizes = {
  /** Bardzo małe ikony - badges inline, tiny buttons */
  xs: "h-3 w-3 sm:h-4 sm:w-4",
  
  /** Małe ikony - karty, standardowe przyciski */
  sm: "h-4 w-4 md:h-5 md:w-5",
  
  /** Średnie ikony - statystyki, wyróżnione elementy */
  md: "h-5 w-5 md:h-6 md:w-6",
  
  /** Duże ikony - nagłówki, duże przyciski */
  lg: "h-6 w-6 md:h-8 md:w-8",
  
  /** Extra duże - logo, hero elements */
  xl: "h-8 md:h-10 lg:h-12",
  
  /** Logo specyficzne */
  logo: {
    navbar: "h-8 md:h-9 lg:h-10",
    footer: "h-8 md:h-10 lg:h-12",
    hero: "h-16 md:h-20 lg:h-24",
    icon: "h-8 w-8"
  }
} as const;

/**
 * Przykłady użycia:
 * 
 * import { iconSizes } from '@/lib/icon-sizes';
 * 
 * // W komponencie:
 * <Flame className={iconSizes.sm} />
 * <TrendingUp className={iconSizes.md} />
 * <img src="/logo.svg" className={iconSizes.logo.navbar} />
 */
