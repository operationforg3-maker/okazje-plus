/**
 * Migration Helpers for M4 Smart Pricing
 * 
 * Provides backward-compatible wrappers for legacy code
 * that expects price: number instead of price: SmartPrice
 */

import { Product, SmartPrice } from './types';
import { getPriceAmount, getTotalPrice, createSmartPrice } from './i18n-utils';

/**
 * Ensure product has SmartPrice (convert if legacy number)
 * 
 * @param product Product with either SmartPrice or legacy number price
 * @returns Product with guaranteed SmartPrice
 */
export function ensureSmartPrice(product: any): Product {
  // If price is already SmartPrice, return as-is
  if (typeof product.price === 'object' && product.price.amount !== undefined) {
    return product as Product;
  }
  
  // Convert legacy number to SmartPrice
  const legacyPrice = product.price as number;
  const smartPrice = createSmartPrice(
    legacyPrice,
    product.currency || 'PLN',
    product.originalPrice
  );
  
  return {
    ...product,
    price: smartPrice,
  } as Product;
}

/**
 * Get price for display (handles both formats)
 * 
 * @param price SmartPrice or number
 * @returns Price amount as number
 */
export function getDisplayPrice(price: SmartPrice | number | undefined): number {
  if (!price) return 0;
  return getPriceAmount(price);
}

/**
 * Check if product has discount
 * 
 * @param product Product with SmartPrice or legacy price
 * @returns True if product has discount
 */
export function hasDiscount(product: any): boolean {
  if (typeof product.price === 'object') {
    return !!product.price.discountPercent && product.price.discountPercent > 0;
  }
  
  return !!product.originalPrice && product.originalPrice > product.price;
}

/**
 * Get discount percentage
 * 
 * @param product Product with SmartPrice or legacy price
 * @returns Discount percentage or 0
 */
export function getDiscountPercentage(product: any): number {
  if (typeof product.price === 'object' && product.price.discountPercent) {
    return product.price.discountPercent;
  }
  
  if (product.originalPrice && product.originalPrice > product.price) {
    return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  }
  
  return 0;
}

/**
 * Convert Product to legacy format (for old components)
 * 
 * @param product Product with SmartPrice
 * @returns Product with legacy number price
 */
export function toLegacyProduct(product: Product): any {
  const price = getPriceAmount(product.price);
  const originalPrice = typeof product.price === 'object' ? product.price.originalPrice : undefined;
  
  return {
    ...product,
    price,
    originalPrice,
  };
}
