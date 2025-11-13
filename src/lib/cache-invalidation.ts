/**
 * Cache Invalidation Utilities
 * 
 * This module provides utilities to invalidate cache keys when data changes.
 * Call these functions after modifying data to ensure users see fresh content.
 */

import { cacheDel } from '@/lib/cache';

/**
 * Invalidate all category-related cache
 * Call this when categories are modified
 */
export async function invalidateCategoriesCache(): Promise<void> {
  await cacheDel('categories:all');
  console.log('Invalidated categories cache');
}

/**
 * Invalidate navigation showcase cache
 * Call this when showcase configuration changes
 */
export async function invalidateNavigationShowcaseCache(): Promise<void> {
  await cacheDel('navigation:showcase');
  console.log('Invalidated navigation showcase cache');
}

/**
 * Invalidate hot deals cache
 * Call this when deals are approved, rejected, or temperature changes significantly
 */
export async function invalidateHotDealsCache(): Promise<void> {
  // Invalidate common cache keys
  const counts = [3, 5, 10, 20, 50];
  for (const count of counts) {
    await cacheDel(`deals:hot:${count}`);
  }
  console.log('Invalidated hot deals cache');
}

/**
 * Invalidate recommended products cache
 * Call this when products are approved or rejected
 */
export async function invalidateRecommendedProductsCache(): Promise<void> {
  // Invalidate common cache keys
  const counts = [3, 5, 10, 20, 50];
  for (const count of counts) {
    await cacheDel(`products:recommended:${count}`);
  }
  console.log('Invalidated recommended products cache');
}

/**
 * Invalidate admin dashboard stats cache
 * Call this after significant data changes or manually refresh
 */
export async function invalidateAdminStatsCache(): Promise<void> {
  await cacheDel('admin:dashboard:stats');
  console.log('Invalidated admin dashboard stats cache');
}

/**
 * Invalidate all cache keys (nuclear option)
 * Use sparingly - only for major data migrations or system updates
 */
export async function invalidateAllCache(): Promise<void> {
  await Promise.all([
    invalidateCategoriesCache(),
    invalidateNavigationShowcaseCache(),
    invalidateHotDealsCache(),
    invalidateRecommendedProductsCache(),
    invalidateAdminStatsCache(),
  ]);
  console.log('Invalidated all cache');
}

/**
 * Cache key patterns for documentation
 * These should match the keys used in data.ts
 */
export const CACHE_KEYS = {
  CATEGORIES: 'categories:all',
  NAVIGATION_SHOWCASE: 'navigation:showcase',
  HOT_DEALS: (count: number) => `deals:hot:${count}`,
  RECOMMENDED_PRODUCTS: (count: number) => `products:recommended:${count}`,
  ADMIN_STATS: 'admin:dashboard:stats',
} as const;

/**
 * Recommended cache TTL (Time To Live) in seconds
 */
export const CACHE_TTL = {
  CATEGORIES: 3600,        // 1 hour - rarely changes
  NAVIGATION: 1800,        // 30 minutes - changes occasionally
  HOT_DEALS: 300,          // 5 minutes - changes frequently
  PRODUCTS: 600,           // 10 minutes - moderate change rate
  ADMIN_STATS: 900,        // 15 minutes - balance freshness and load
  SEARCH: 300,             // 5 minutes - search results
  USER_FAVORITES: 60,      // 1 minute - personalized, needs freshness
} as const;
