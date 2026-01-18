/**
 * Currency Display Utilities
 * - Format prices in different currencies
 * - Handle SmartPrice objects
 * - Support legacy number prices
 */

import { useEffect, useState } from 'react';
import type { SmartPrice } from './types';
import { 
  formatPrice as formatPriceService, 
  getCurrencySymbol,
  type SupportedCurrency 
} from './currency-service';

/**
 * Hook to get current selected currency from localStorage
 */
export function useSelectedCurrency(): SupportedCurrency {
  const [currency, setCurrency] = useState<SupportedCurrency>('PLN');
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedCurrency = localStorage.getItem('preferredCurrency') as SupportedCurrency;
    if (savedCurrency && ['PLN', 'USD', 'EUR', 'GBP'].includes(savedCurrency)) {
      setCurrency(savedCurrency);
    }
    
    // Listen for currency changes
    const handleCurrencyChange = (e: CustomEvent) => {
      setCurrency(e.detail.currency);
    };
    
    window.addEventListener('currencyChange', handleCurrencyChange as EventListener);
    
    return () => {
      window.removeEventListener('currencyChange', handleCurrencyChange as EventListener);
    };
  }, []);
  
  return currency;
}

/**
 * Format price with selected currency
 */
export function formatPrice(
  price: number | SmartPrice | undefined,
  currency: SupportedCurrency = 'PLN'
): string {
  if (!price) return `0.00 ${getCurrencySymbol(currency)}`;
  
  if (typeof price === 'number') {
    return formatPriceService(price, currency);
  }
  
  // SmartPrice object
  const amount = price.totalPrice || price.amount;
  return formatPriceService(amount, price.currency as SupportedCurrency);
}

/**
 * Get price amount from SmartPrice or number
 */
export function getPriceAmount(price: number | SmartPrice | undefined): number {
  if (!price) return 0;
  if (typeof price === 'number') return price;
  return price.totalPrice || price.amount;
}

/**
 * Check if shipping is free
 */
export function isFreeShipping(price: number | SmartPrice | undefined): boolean {
  if (!price) return false;
  if (typeof price === 'number') return false;
  return price.freeShipping === true || price.shippingCost === 0;
}

/**
 * Get discount percentage
 */
export function getDiscountPercent(price: number | SmartPrice | undefined): number {
  if (!price) return 0;
  if (typeof price === 'number') return 0;
  if (typeof price === 'object' && price !== null && 'discountPercent' in price) {
    return (price as SmartPrice).discountPercent || 0;
  }
  return 0;
}

/**
 * Format discount badge
 */
export function formatDiscountBadge(price: number | SmartPrice | undefined): string | null {
  const discount = getDiscountPercent(price);
  if (discount <= 0) return null;
  return `-${discount}%`;
}

/**
 * Get original price (before discount)
 */
export function getOriginalPrice(price: number | SmartPrice | undefined): number | null {
  if (!price) return null;
  if (typeof price === 'number') return null;
  return price.originalPrice || null;
}

/**
 * Format original price with strikethrough styling
 */
export function formatOriginalPrice(
  price: number | SmartPrice | undefined,
  currency: SupportedCurrency = 'PLN'
): string | null {
  const originalPrice = getOriginalPrice(price);
  if (!originalPrice) return null;
  return formatPriceService(originalPrice, currency);
}

/**
 * Get shipping cost
 */
export function getShippingCost(price: number | SmartPrice | undefined): number {
  if (!price) return 0;
  if (typeof price === 'number') return 0;
  return price.shippingCost || 0;
}

/**
 * Format shipping cost text
 */
export function formatShippingText(
  price: number | SmartPrice | undefined,
  currency: SupportedCurrency = 'PLN'
): string {
  if (isFreeShipping(price)) {
    return 'Darmowa wysyłka';
  }
  
  const shipping = getShippingCost(price);
  if (shipping > 0) {
    return `Wysyłka: ${formatPriceService(shipping, currency)}`;
  }
  
  return '';
}

/**
 * Create SmartPrice from simple number (migration helper)
 */
export function createSmartPrice(
  amount: number,
  currency: SupportedCurrency = 'PLN',
  options?: {
    shippingCost?: number;
    originalPrice?: number;
    freeShipping?: boolean;
  }
): SmartPrice {
  const shippingCost = options?.freeShipping ? 0 : (options?.shippingCost || 0);
  const totalPrice = amount + shippingCost;
  
  const discountPercent = options?.originalPrice && options.originalPrice > amount
    ? Math.round(((options.originalPrice - amount) / options.originalPrice) * 100)
    : undefined;
  
  return {
    amount,
    currency,
    shippingCost,
    totalPrice,
    freeShipping: shippingCost === 0,
    originalPrice: options?.originalPrice,
    discountPercent,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * M6 Deal Compatibility: Extract price amount from deal
 * Supports both legacy (deal.price = number) and M6 (deal.price = {amount, currency}) formats
 */
export function extractDealPriceAmount(deal: any): number {
  if (!deal) return 0;

  // M6 format: price.amount
  if (deal.price && typeof deal.price === 'object' && 'amount' in deal.price) {
    return Number(deal.price.amount) || 0;
  }

  // Legacy format: price is number
  if (typeof deal.price === 'number') {
    return deal.price;
  }

  // Fallback: legacyPrice field
  if (typeof deal.legacyPrice === 'number') {
    return deal.legacyPrice;
  }

  // Last resort: try to parse as string
  if (typeof deal.price === 'string') {
    const parsed = parseFloat(deal.price);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}
