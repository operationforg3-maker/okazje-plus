/**
 * Unified Currency System
 * 
 * Single source of truth for all currency operations across the app.
 * Features:
 * - Real-time exchange rates from NBP API
 * - Fallback to hardcoded rates for reliability
 * - React hook for components to use selected currency
 * - Consistent formatting across all UI
 * - localStorage persistence for user preference
 * - Event-based currency change notifications
 */

import { useEffect, useState, useCallback } from 'react';

export type Currency = 'PLN' | 'USD' | 'EUR' | 'GBP';

interface ExchangeRates {
  PLN: number;
  USD: number;
  EUR: number;
  GBP: number;
  lastUpdated: Date;
  source: 'api' | 'fallback';
}

/**
 * Fallback rates (updated manually, current as of Dec 2025)
 * All rates relative to PLN (base currency)
 */
const FALLBACK_RATES: Record<Currency, number> = {
  PLN: 1.0,   // Base currency
  USD: 4.0,   // 1 USD = 4 PLN (approx)
  EUR: 4.3,   // 1 EUR = 4.3 PLN
  GBP: 5.1,   // 1 GBP = 5.1 PLN
};

/**
 * Locale mappings for Intl.NumberFormat
 */
const LOCALE_MAP: Record<Currency, string> = {
  PLN: 'pl-PL',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

/**
 * Currency symbols for display
 */
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  PLN: 'zł',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Singleton manager for exchange rates and currency operations
 * This class handles fetching, caching, and converting between currencies
 */
class CurrencyManager {
  private static rates: ExchangeRates = {
    PLN: 1.0,
    USD: FALLBACK_RATES.USD,
    EUR: FALLBACK_RATES.EUR,
    GBP: FALLBACK_RATES.GBP,
    lastUpdated: new Date(),
    source: 'fallback',
  };

  private static isFetching = false;
  private static lastFetchTime = 0;
  private static FETCH_INTERVAL = 60 * 60 * 1000; // 1 hour

  /**
   * Get current exchange rates (with caching and automatic refresh)
   */
  static async getRates(): Promise<ExchangeRates> {
    const now = Date.now();
    
    // If rates are fresh, return them
    if (this.rates.source === 'api' && now - this.lastFetchTime < this.FETCH_INTERVAL) {
      return { ...this.rates };
    }

    // If already fetching, return current rates while fetch is in progress
    if (this.isFetching) {
      return { ...this.rates };
    }

    // Fetch fresh rates in background
    this.isFetching = true;
    try {
      const freshRates = await this.fetchFromNBP();
      if (freshRates) {
        this.rates = freshRates;
        this.lastFetchTime = now;
        console.log('[Currency] Fetched fresh rates from NBP API', freshRates);
      }
    } catch (error) {
      console.warn('[Currency] Failed to fetch rates from NBP, using fallback', error);
    } finally {
      this.isFetching = false;
    }

    return { ...this.rates };
  }

  /**
   * Fetch exchange rates from NBP API (Polish National Bank)
   * https://api.nbp.pl/
   */
  private static async fetchFromNBP(): Promise<ExchangeRates | null> {
    try {
      const response = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/?format=json', {
        next: { revalidate: 3600 }, // Cache for 1 hour in Next.js
      });

      if (!response.ok) {
        throw new Error(`NBP API returned ${response.status}`);
      }

      const data = await response.json() as { rates: Array<{ code: string; mid: number }> };
      
      const rates: ExchangeRates = {
        PLN: 1.0,
        USD: FALLBACK_RATES.USD,
        EUR: FALLBACK_RATES.EUR,
        GBP: FALLBACK_RATES.GBP,
        lastUpdated: new Date(),
        source: 'api',
      };

      // Map API response to our rates
      for (const rate of data.rates) {
        if (rate.code === 'USD') rates.USD = rate.mid;
        if (rate.code === 'EUR') rates.EUR = rate.mid;
        if (rate.code === 'GBP') rates.GBP = rate.mid;
      }

      return rates;
    } catch (error) {
      console.error('[Currency] Failed to fetch from NBP API:', error);
      return null;
    }
  }

  /**
   * Convert amount from PLN to target currency
   * All amounts in the app are stored in PLN internally
   */
  static convertFromPLN(amountPLN: number, targetCurrency: Currency): number {
    if (targetCurrency === 'PLN') {
      return amountPLN;
    }

    const rate = this.rates[targetCurrency];
    const converted = amountPLN / rate;

    // Round to 2 decimal places
    return Math.round(converted * 100) / 100;
  }

  /**
   * Convert amount from source currency to PLN
   * Used primarily during import/harvesting
   */
  static convertToPLN(amount: number, sourceCurrency: Currency): number {
    if (sourceCurrency === 'PLN') {
      return amount;
    }

    const rate = this.rates[sourceCurrency];
    const converted = amount * rate;

    // Round to 2 decimal places
    return Math.round(converted * 100) / 100;
  }

  /**
   * Format price for display with currency symbol
   * Input: amount in PLN, output: localized formatted string
   */
  static formatPrice(amountPLN: number, targetCurrency: Currency): string {
    const displayAmount = this.convertFromPLN(amountPLN, targetCurrency);
    const locale = LOCALE_MAP[targetCurrency];

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: targetCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(displayAmount);
    } catch (error) {
      console.error('[Currency] Format error for', targetCurrency, error);
      return `${displayAmount.toFixed(2)} ${CURRENCY_SYMBOLS[targetCurrency]}`;
    }
  }

  /**
   * Get symbol for currency
   */
  static getSymbol(currency: Currency): string {
    return CURRENCY_SYMBOLS[currency];
  }

  /**
   * Get current rates synchronously (for import pipeline)
   * Falls back to hardcoded rates if not yet fetched
   */
  static getRatesSync(): Record<Currency, number> {
    return {
      PLN: this.rates.PLN,
      USD: this.rates.USD,
      EUR: this.rates.EUR,
      GBP: this.rates.GBP,
    };
  }
}

/**
 * React Hook: useCurrency
 * 
 * Use this hook in any component that needs to:
 * - Display prices in user's selected currency
 * - React to currency changes
 * - Get current selected currency
 * 
 * Example:
 * ```tsx
 * function ProductCard({ pricePLN }) {
 *   const { currency, formatPrice } = useCurrency();
 *   
 *   return (
 *     <div>
 *       <span className="price">{formatPrice(pricePLN)}</span>
 *       <span className="symbol">{currency}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>('PLN');
  const [isMounted, setIsMounted] = useState(false);

  /**
   * Initialize on client side:
   * - Load saved preference from localStorage
   * - Setup event listener for currency changes
   * - Fetch fresh exchange rates
   */
  useEffect(() => {
    setIsMounted(true);

    if (typeof window === 'undefined') return;

    // Load saved currency preference
    const saved = localStorage.getItem('preferredCurrency') as Currency | null;
    if (saved && ['PLN', 'USD', 'EUR', 'GBP'].includes(saved)) {
      setCurrencyState(saved);
    }

    // Fetch fresh rates on mount
    CurrencyManager.getRates().catch(console.error);

    // Listen for currency change events from CurrencySwitcher
    const handleCurrencyChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ currency: Currency }>;
      if (customEvent.detail?.currency) {
        setCurrencyState(customEvent.detail.currency);
      }
    };

    window.addEventListener('currencyChange', handleCurrencyChange);
    return () => window.removeEventListener('currencyChange', handleCurrencyChange);
  }, []);

  /**
   * Format price (amount in PLN) for current selected currency
   */
  const formatPrice = useCallback((amountPLN: number): string => {
    return CurrencyManager.formatPrice(amountPLN, currency);
  }, [currency]);

  /**
   * Format price with custom currency (override selected currency)
   */
  const formatPriceCustom = useCallback((amountPLN: number, targetCurrency: Currency): string => {
    return CurrencyManager.formatPrice(amountPLN, targetCurrency);
  }, []);

  /**
   * Convert amount from PLN to current currency
   */
  const convertFromPLN = useCallback((amountPLN: number): number => {
    return CurrencyManager.convertFromPLN(amountPLN, currency);
  }, [currency]);

  /**
   * Convert amount to PLN from source currency
   */
  const convertToPLN = useCallback((amount: number, sourceCurrency: Currency): number => {
    return CurrencyManager.convertToPLN(amount, sourceCurrency);
  }, []);

  /**
   * Set new currency preference (persists to localStorage)
   */
  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredCurrency', newCurrency);
    }
  }, []);

  /**
   * Get currency symbol
   */
  const getSymbol = useCallback((): string => {
    return CurrencyManager.getSymbol(currency);
  }, [currency]);

  return {
    // Current state
    currency,
    isMounted,
    
    // Formatting & conversion
    formatPrice,
    formatPriceCustom,
    convertFromPLN,
    convertToPLN,
    getSymbol,
    
    // Actions
    setCurrency,
  };
}

/**
 * Export CurrencyManager for use in non-React contexts (e.g., import pipeline)
 */
export { CurrencyManager };

/**
 * Export type for use in TypeScript files
 */
export type { ExchangeRates };
