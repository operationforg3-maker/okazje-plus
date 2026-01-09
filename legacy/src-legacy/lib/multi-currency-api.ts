/**
 * Multi-Currency API Integration Helper
 * 
 * Coordinates currency handling between different APIs:
 * - AliExpress API: Returns prices in USD (or selected currency)
 * - Convertiser API: Supports multiple currencies
 * - Internal system: Stores in SmartPrice with proper currency
 */

import { logger } from './logger';
import { getExchangeRates, convertCurrency, type SupportedCurrency } from './currency-service';
import type { SmartPrice } from './types';

/**
 * Price data from external API (normalized format)
 */
export interface ExternalPrice {
  amount: number;
  currency: string; // API might return various currency codes
  originalAmount?: number;
  shippingCost?: number;
  freeShipping?: boolean;
}

/**
 * Convert external API price to SmartPrice
 * Handles currency conversion and normalization
 */
export async function externalPriceToSmartPrice(
  externalPrice: ExternalPrice,
  targetCurrency: SupportedCurrency = 'PLN'
): Promise<SmartPrice> {
  const sourceCurrency = normalizeApiCurrency(externalPrice.currency);
  
  // Convert amounts to target currency
  const amount = sourceCurrency === targetCurrency
    ? externalPrice.amount
    : await convertCurrency(externalPrice.amount, sourceCurrency, targetCurrency);
  
  const shippingCost = externalPrice.shippingCost
    ? (sourceCurrency === targetCurrency
        ? externalPrice.shippingCost
        : await convertCurrency(externalPrice.shippingCost, sourceCurrency, targetCurrency))
    : 0;
  
  const originalPrice = externalPrice.originalAmount
    ? (sourceCurrency === targetCurrency
        ? externalPrice.originalAmount
        : await convertCurrency(externalPrice.originalAmount, sourceCurrency, targetCurrency))
    : undefined;
  
  const totalPrice = amount + shippingCost;
  
  const discountPercent = originalPrice && originalPrice > amount
    ? Math.round(((originalPrice - amount) / originalPrice) * 100)
    : undefined;
  
  const smartPrice: SmartPrice = {
    amount: Math.round(amount * 100) / 100,
    currency: targetCurrency,
    shippingCost: Math.round(shippingCost * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
    freeShipping: externalPrice.freeShipping || shippingCost === 0,
    originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : undefined,
    discountPercent,
    lastUpdated: new Date().toISOString(),
  };
  
  logger.debug('Converted external price to SmartPrice', {
    source: externalPrice,
    result: smartPrice,
    sourceCurrency,
    targetCurrency,
  });
  
  return smartPrice;
}

/**
 * Normalize API currency codes to SupportedCurrency
 * Handles various currency code formats from different APIs
 */
function normalizeApiCurrency(apiCurrency: string): SupportedCurrency {
  const normalized = apiCurrency.toUpperCase().trim();
  
  // Map common variations
  const currencyMap: Record<string, SupportedCurrency> = {
    'USD': 'USD',
    'US': 'USD',
    'DOLLAR': 'USD',
    'EUR': 'EUR',
    'EURO': 'EUR',
    'PLN': 'PLN',
    'ZLOTY': 'PLN',
    'ZL': 'PLN',
    'ZŁ': 'PLN',
    'GBP': 'GBP',
    'POUND': 'GBP',
    'POUNDS': 'GBP',
  };
  
  const result = currencyMap[normalized];
  
  if (!result) {
    logger.warn('Unknown API currency code, defaulting to USD', { apiCurrency });
    return 'USD';
  }
  
  return result;
}

/**
 * Get preferred API request currency based on user/system settings
 * Some APIs support requesting data in specific currencies
 */
export function getPreferredApiCurrency(): SupportedCurrency {
  // Check environment variable
  const envCurrency = process.env.DEFAULT_API_CURRENCY as SupportedCurrency;
  if (envCurrency && ['PLN', 'USD', 'EUR', 'GBP'].includes(envCurrency)) {
    return envCurrency;
  }
  
  // Default to USD (most APIs default to this)
  return 'USD';
}

/**
 * Build currency parameter for API requests
 * Different APIs use different parameter names
 */
export function buildCurrencyParam(
  apiName: 'aliexpress' | 'convertiser' | 'other',
  currency?: SupportedCurrency
): Record<string, string> {
  const targetCurrency = currency || getPreferredApiCurrency();
  
  switch (apiName) {
    case 'aliexpress':
      // AliExpress uses 'target_currency' parameter
      return { target_currency: targetCurrency };
    
    case 'convertiser':
      // Convertiser uses currency in path or 'currency' parameter
      return { currency: targetCurrency };
    
    default:
      // Generic parameter name
      return { currency: targetCurrency };
  }
}

/**
 * Convert SmartPrice to different currency (for display)
 */
export async function convertSmartPrice(
  price: SmartPrice,
  targetCurrency: SupportedCurrency
): Promise<SmartPrice> {
  if (price.currency === targetCurrency) {
    return price;
  }
  
  const sourceCurrency = normalizeApiCurrency(price.currency);
  
  const amount = await convertCurrency(price.amount, sourceCurrency, targetCurrency);
  const shippingCost = await convertCurrency(price.shippingCost, sourceCurrency, targetCurrency);
  const totalPrice = amount + shippingCost;
  
  const originalPrice = price.originalPrice
    ? await convertCurrency(price.originalPrice, sourceCurrency, targetCurrency)
    : undefined;
  
  return {
    ...price,
    amount: Math.round(amount * 100) / 100,
    currency: targetCurrency,
    shippingCost: Math.round(shippingCost * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
    originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : undefined,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Batch convert multiple prices
 */
export async function convertPricesBatch(
  prices: SmartPrice[],
  targetCurrency: SupportedCurrency
): Promise<SmartPrice[]> {
  // Pre-fetch exchange rates once for efficiency
  await getExchangeRates();
  
  return Promise.all(
    prices.map(price => convertSmartPrice(price, targetCurrency))
  );
}

/**
 * Check if API supports multi-currency requests
 */
export function supportsMultiCurrency(apiName: string): boolean {
  const supportedApis = ['aliexpress', 'convertiser'];
  return supportedApis.includes(apiName.toLowerCase());
}
