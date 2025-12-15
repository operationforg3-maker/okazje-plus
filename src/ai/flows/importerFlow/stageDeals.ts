/**
 * Stage Deals: Fetch HOT DEALS from AliExpress (products with discount >= 30%)
 * 
 * Dedicated pipeline for finding and importing hot deals (okazje)
 * - Filters products by discount percentage
 * - Adds deal-specific metadata (temperature, urgency)
 * - Auto-links to existing products
 */

import { AliExpressProduct, ImportStageConfig, AliExpressDeal } from './types';
import { fetchHotProductsByCategory } from './stageFetch';

export interface DealsFetchConfig extends ImportStageConfig {
  minDiscount?: number; // Minimum discount % (default: 30%)
  maxDeals?: number;    // Max deals to return (default: 100)
  sortBy?: 'discount' | 'orders' | 'rating'; // Sort criteria
}

/**
 * Fetch hot deals from AliExpress (products with high discount)
 * 
 * @param categoryIds - AliExpress category IDs to search (optional, searches all if empty)
 * @param config - Configuration with minDiscount filter
 * @returns Array of AliExpressDeal objects (only products meeting discount criteria)
 */
export async function fetchHotDealsFromAliexpress(
  categoryIds: string[],
  config: DealsFetchConfig
): Promise<AliExpressDeal[]> {
  console.log(`[Importer:Deals] ===== FETCH HOT DEALS START =====`);
  console.log(`[Importer:Deals] Category IDs: ${categoryIds.join(', ')}`);
  console.log(`[Importer:Deals] Min discount: ${config.minDiscount || 30}%`);
  
  const minDiscount = config.minDiscount || 30;
  const maxDeals = config.maxDeals || 100;
  const sortBy = config.sortBy || 'discount';
  
  try {
    // Step 1: Fetch products using existing fetchHotProductsByCategory
    console.log(`[Importer:Deals] Fetching products from AliExpress...`);
    const products = await fetchHotProductsByCategory(categoryIds, config);
    console.log(`[Importer:Deals] Fetched ${products.length} products from API`);
    
    // Step 2: Filter by discount percentage (only keep high-discount items)
    const hotDeals = products
      .filter(p => {
        const discount = p.discount || 0;
        const hasGoodDiscount = discount >= minDiscount;
        const hasOriginalPrice = p.originalPrice && p.originalPrice > p.price;
        
        if (!hasGoodDiscount || !hasOriginalPrice) {
          console.log(`[Importer:Deals] ❌ Filtered out: ${p.title.substring(0, 50)} - discount: ${discount}%`);
          return false;
        }
        
        return true;
      })
      .map(p => convertProductToDeal(p))
      .slice(0, maxDeals); // Limit results
    
    console.log(`[Importer:Deals] ✅ Found ${hotDeals.length} hot deals (${minDiscount}%+ discount)`);
    
    // Step 3: Sort by criteria
    hotDeals.sort((a, b) => {
      switch (sortBy) {
        case 'discount':
          return (b.discount || 0) - (a.discount || 0);
        case 'orders':
          return (b.orders || 0) - (a.orders || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });
    
    // Step 4: Log top deals
    console.log(`[Importer:Deals] 🔥 TOP 5 HOT DEALS:`);
    hotDeals.slice(0, 5).forEach((deal, idx) => {
      console.log(`[Importer:Deals]   ${idx + 1}. ${deal.title.substring(0, 60)}...`);
      console.log(`[Importer:Deals]      💰 ${deal.price} PLN (was ${deal.originalPrice}) - ${deal.discount}% OFF`);
      console.log(`[Importer:Deals]      📦 ${deal.orders} orders | ⭐ ${deal.rating}/5`);
    });
    
    console.log(`[Importer:Deals] ===== FETCH HOT DEALS END =====\n`);
    return hotDeals;
    
  } catch (error: any) {
    console.error(`[Importer:Deals] ❌ Error fetching deals:`, error.message);
    return [];
  }
}

/**
 * Convert AliExpressProduct to AliExpressDeal with deal-specific fields
 */
function convertProductToDeal(product: AliExpressProduct): AliExpressDeal {
  const discount = product.discount || 0;
  const orders = product.orders || 0;
  const rating = product.rating || 0;
  
  // Calculate temperature (0-100) based on discount, orders, rating
  const temperature = calculateTemperature(discount, orders, rating);
  
  // Determine deal type based on discount
  let dealType: 'sale' | 'hot-deal' | 'flash-sale' = 'sale';
  if (discount >= 70) {
    dealType = 'flash-sale'; // Bardzo gorąca okazja (70%+ zniżki)
  } else if (discount >= 50) {
    dealType = 'hot-deal';   // Gorąca okazja (50-69% zniżki)
  }
  
  // Estimate expiry (hot deals usually last 1-7 days)
  const expiryDate = estimateExpiryDate(dealType);
  
  return {
    ...product,
    discount,
    dealType,
    temperature,
    expiryDate,
    stockLevel: undefined, // Could be fetched from product details API
  };
}

/**
 * Calculate deal temperature (heat score) based on discount, popularity, rating
 * 
 * Formula:
 * - Discount: 50% weight (higher discount = hotter)
 * - Orders: 30% weight (more orders = more trusted)
 * - Rating: 20% weight (higher rating = better quality)
 * 
 * @returns Temperature score 0-100
 */
function calculateTemperature(discount: number, orders: number, rating: number): number {
  // Normalize inputs to 0-1 scale
  const discountScore = Math.min(discount / 100, 1);  // Discount % → 0-1
  const ordersScore = Math.min(Math.log10(orders + 1) / 6, 1); // Log scale for orders (10^6 = max)
  const ratingScore = rating / 5; // Rating 0-5 → 0-1
  
  // Weighted average
  const temperature = (
    discountScore * 0.5 +  // 50% weight
    ordersScore * 0.3 +    // 30% weight
    ratingScore * 0.2      // 20% weight
  ) * 100;
  
  return Math.round(Math.min(Math.max(temperature, 0), 100));
}

/**
 * Estimate expiry date for deal based on type
 * 
 * - Flash sales: 1-2 days
 * - Hot deals: 3-5 days
 * - Regular sales: 5-7 days
 */
function estimateExpiryDate(dealType: 'sale' | 'hot-deal' | 'flash-sale'): string {
  const now = new Date();
  let daysToAdd = 7;
  
  switch (dealType) {
    case 'flash-sale':
      daysToAdd = 1 + Math.floor(Math.random() * 2); // 1-2 days
      break;
    case 'hot-deal':
      daysToAdd = 3 + Math.floor(Math.random() * 3); // 3-5 days
      break;
    default:
      daysToAdd = 5 + Math.floor(Math.random() * 3); // 5-7 days
  }
  
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

/**
 * Quality check for deals - stricter than products
 * 
 * Requirements:
 * - Minimum discount >= 30%
 * - Must have original price
 * - Minimum orders >= 10 (proven demand)
 * - Rating >= 3.5 (quality threshold)
 */
export function validateDealQuality(deal: AliExpressDeal): { valid: boolean; reason?: string } {
  if (!deal.discount || deal.discount < 30) {
    return { valid: false, reason: `Discount too low: ${deal.discount}%` };
  }
  
  if (!deal.originalPrice || deal.originalPrice <= deal.price) {
    return { valid: false, reason: 'Missing or invalid original price' };
  }
  
  if (!deal.orders || deal.orders < 10) {
    return { valid: false, reason: `Too few orders: ${deal.orders}` };
  }
  
  if (!deal.rating || deal.rating < 3.5) {
    return { valid: false, reason: `Rating too low: ${deal.rating}` };
  }
  
  return { valid: true };
}
