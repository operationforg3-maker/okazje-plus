/**
 * Enhanced Currency Service
 * - Real-time exchange rates from API
 * - Multiple currency support (PLN, USD, EUR, GBP)
 * - Caching to reduce API calls
 * - Fallback to hardcoded rates
 */

import { logger } from "./logger";

export type SupportedCurrency = 'PLN' | 'USD' | 'EUR' | 'GBP';

export interface ExchangeRates {
  PLN: number;
  USD: number;
  EUR: number;
  GBP: number;
  lastUpdated: Date;
  source: 'api' | 'cache' | 'fallback';
}

// Fallback rates (updated manually as backup)
const FALLBACK_RATES: Omit<ExchangeRates, 'lastUpdated' | 'source'> = {
  PLN: 1.0,    // Base currency
  USD: 0.25,   // 1 PLN = 0.25 USD (approx 4.0 PLN/USD)
  EUR: 0.23,   // 1 PLN = 0.23 EUR (approx 4.3 PLN/EUR)
  GBP: 0.20,   // 1 PLN = 0.20 GBP (approx 5.0 PLN/GBP)
};

// Rates to convert TO PLN (inverse of above)
const FALLBACK_TO_PLN: Record<SupportedCurrency, number> = {
  PLN: 1.0,
  USD: 4.0,
  EUR: 4.3,
  GBP: 5.0,
};

// Cache exchange rates (expires after 1 hour)
let cachedRates: ExchangeRates | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch exchange rates from external API
 * Using exchangerate-api.com (free tier: 1500 requests/month)
 */
async function fetchExchangeRatesFromAPI(): Promise<ExchangeRates | null> {
  try {
    // Using EUR as base to get PLN rate directly
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/PLN', {
      next: { revalidate: 3600 } // Cache for 1 hour in Next.js
    });
    
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.rates) {
      throw new Error('Invalid API response format');
    }
    
    const rates: ExchangeRates = {
      PLN: 1.0,
      USD: data.rates.USD || FALLBACK_RATES.USD,
      EUR: data.rates.EUR || FALLBACK_RATES.EUR,
      GBP: data.rates.GBP || FALLBACK_RATES.GBP,
      lastUpdated: new Date(),
      source: 'api',
    };
    
    logger.info('Exchange rates fetched from API', {
      rates,
      timestamp: rates.lastUpdated,
    });
    
    return rates;
  } catch (error) {
    logger.error('Failed to fetch exchange rates from API', { error });
    return null;
  }
}

/**
 * Get current exchange rates (with caching)
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  // Check cache
  if (cachedRates) {
    const cacheAge = Date.now() - cachedRates.lastUpdated.getTime();
    if (cacheAge < CACHE_DURATION) {
      logger.debug('Using cached exchange rates', { 
        age: Math.round(cacheAge / 1000 / 60), 
        unit: 'minutes' 
      });
      return { ...cachedRates, source: 'cache' };
    }
  }
  
  // Try to fetch from API
  const apiRates = await fetchExchangeRatesFromAPI();
  if (apiRates) {
    cachedRates = apiRates;
    return apiRates;
  }
  
  // Fallback to hardcoded rates
  logger.warn('Using fallback exchange rates');
  const fallbackRates: ExchangeRates = {
    ...FALLBACK_RATES,
    lastUpdated: new Date(),
    source: 'fallback',
  };
  
  cachedRates = fallbackRates;
  return fallbackRates;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<number> {
  if (from === to) {
    return amount;
  }
  
  const rates = await getExchangeRates();
  
  // Convert to PLN first, then to target currency
  const amountInPLN = from === 'PLN' ? amount : amount / rates[from];
  const result = to === 'PLN' ? amountInPLN : amountInPLN * rates[to];
  
  return Math.round(result * 100) / 100;
}

/**
 * Convert amount to PLN (most common operation for import)
 */
export async function convertToPLN(
  amount: number,
  currency: SupportedCurrency
): Promise<number> {
  if (currency === 'PLN') {
    return amount;
  }
  
  // Use fallback rates for faster synchronous conversion during import
  const rate = FALLBACK_TO_PLN[currency];
  return Math.round(amount * rate * 100) / 100;
}

/**
 * Format price with currency symbol
 */
export function formatPrice(
  amount: number,
  currency: SupportedCurrency,
  locale?: string
): string {
  const localeMap: Record<SupportedCurrency, string> = {
    PLN: 'pl-PL',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
  };
  
  const targetLocale = locale || localeMap[currency];
  
  return new Intl.NumberFormat(targetLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get exchange rate for converting TO PLN
 * (Synchronous version using fallback rates for import pipeline)
 */
export function getExchangeRateToPLN(currency: SupportedCurrency): number {
  return FALLBACK_TO_PLN[currency];
}

/**
 * Calculate discount percentage
 */
export function calculateDiscountPercent(
  originalPrice: number,
  currentPrice: number
): number {
  if (!originalPrice || originalPrice <= currentPrice) {
    return 0;
  }
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

/**
 * Invalidate cache (useful for manual refresh)
 */
export function invalidateExchangeRatesCache(): void {
  cachedRates = null;
  logger.info('Exchange rates cache invalidated');
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  const symbols: Record<SupportedCurrency, string> = {
    PLN: 'zł',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  return symbols[currency];
}
