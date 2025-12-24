/**
 * Unified Filter Configuration for E-Commerce Platform
 * Based on best practices from: Ceneo, PriceRunner, Amazon, Allegro, AliExpress
 * 
 * M6: Filters for both ProductCore (products) and DealM6 (deals)
 */

export interface PriceRangeFilter {
  min: number;
  max: number;
  step?: number; // UI slider step (default: 10)
}

export interface RatingFilter {
  minStars: number; // 1-5
  onlyReviewed?: boolean; // Must have at least one review
}

export interface AvailabilityFilter {
  inStockOnly?: boolean;
  excludeOutOfStock?: boolean;
}

export interface PromoFilter {
  discountOnly?: boolean;
  minDiscount?: number; // percentage 0-100
  freeShippingOnly?: boolean;
}

export interface SpecificationFilter {
  // Flexible key-value for product specs
  // e.g., { "RAM": ["8GB", "16GB"], "Storage": ["256GB"] }
  [key: string]: string[];
}

export interface BrandFilter {
  brands: string[]; // Multi-select
}

export interface UnifiedFilters {
  // Price
  priceRange?: PriceRangeFilter;
  
  // Quality/Reviews
  rating?: RatingFilter;
  
  // Availability
  availability?: AvailabilityFilter;
  
  // Promotions
  promo?: PromoFilter;
  
  // Product-level filters
  categoryId?: string; // mainCategorySlug
  subcategoryId?: string; // subCategorySlug
  subSubcategoryId?: string;
  
  // Specifications (Electronics: RAM, Storage, Screen; Shoes: Size, Color; etc)
  specifications?: SpecificationFilter;
  
  // Brand/Manufacturer
  brands?: BrandFilter;
  
  // Source (for deals)
  sources?: Array<'aliexpress' | 'amazon' | 'allegro'>;
  
  // Condition
  condition?: 'new' | 'used' | 'both';
  
  // Free text search
  searchTerm?: string;
}

/**
 * Sort options in order of importance
 * Each platform prioritizes differently, but these are the most common
 */
export type SortBy =
  | 'relevance'       // Default: AI-matched products (if search term exists)
  | 'price_asc'       // Najtańsze
  | 'price_desc'      // Najdroższe
  | 'rating_desc'     // Najwyższa ocena (⭐⭐⭐⭐⭐)
  | 'newest'          // Najnowsze (createdAt DESC)
  | 'hot'             // Trending/Hot deals (temperature DESC - for deals)
  | 'discount_desc'   // Największa zniżka (for deals)
  | 'reviews_count'   // Liczba opinii (most discussed)
  | 'popularity';     // Najpopularniejsze (deal vote count, product frequency)

export const SORT_OPTIONS: Record<SortBy, { label: string; icon: string }> = {
  relevance: { label: 'Najlepsze dopasowanie', icon: 'Sparkles' },
  price_asc: { label: 'Najtańsze', icon: 'DollarSign' },
  price_desc: { label: 'Najdroższe', icon: 'DollarSign' },
  rating_desc: { label: 'Najwyższa ocena', icon: 'Star' },
  newest: { label: 'Najnowsze', icon: 'Clock' },
  hot: { label: 'Trending (Gorące)', icon: 'Flame' },
  discount_desc: { label: 'Największa zniżka', icon: 'Tag' },
  reviews_count: { label: 'Najbardziej dyskutowane', icon: 'MessageSquare' },
  popularity: { label: 'Najpopularniejsze', icon: 'TrendingUp' },
};

/**
 * Default filter ranges (can be customized per category)
 */
export const DEFAULT_FILTERS = {
  price: { min: 0, max: 10000, step: 100 },
  rating: { minStars: 1 },
  discount: { minDiscount: 0 },
};

/**
 * Common product specifications by category
 * Used to populate spec filter options
 */
export const CATEGORY_SPECS: Record<string, string[]> = {
  'electronics/smartphones': ['RAM', 'Storage', 'Screen', 'Battery', 'Processor', 'Camera'],
  'electronics/laptops': ['RAM', 'Storage', 'Screen', 'Processor', 'GPU', 'Battery'],
  'electronics/tablets': ['RAM', 'Storage', 'Screen', 'Processor', 'Battery'],
  'electronics/computers': ['RAM', 'Storage', 'Processor', 'GPU', 'Motherboard'],
  'fashion/shoes': ['Size', 'Color', 'Material', 'Style'],
  'fashion/clothing': ['Size', 'Color', 'Material', 'Gender', 'Style'],
  'home/furniture': ['Color', 'Material', 'Dimensions', 'Style'],
};

/**
 * Parse filter query string from URL
 * @example
 * ?filters=price:100-500,rating:4,inStock:true,brands:Apple,Samsung
 */
export function parseFilterString(filterString: string): UnifiedFilters {
  if (!filterString) return {};
  
  const filters: UnifiedFilters = {};
  const parts = filterString.split(',');
  
  for (const part of parts) {
    const [key, value] = part.split(':');
    
    switch (key) {
      case 'price':
        const [min, max] = value.split('-').map(Number);
        filters.priceRange = { min, max };
        break;
      case 'rating':
        filters.rating = { minStars: Number(value) };
        break;
      case 'inStock':
        filters.availability = { inStockOnly: value === 'true' };
        break;
      case 'discount':
        filters.promo = { minDiscount: Number(value) };
        break;
      case 'brands':
        filters.brands = { brands: value.split('|') };
        break;
      case 'sources':
        filters.sources = value.split('|') as any[];
        break;
    }
  }
  
  return filters;
}

/**
 * Convert filters back to URL query string
 */
export function filtersToString(filters: UnifiedFilters): string {
  const parts: string[] = [];
  
  if (filters.priceRange) {
    parts.push(`price:${filters.priceRange.min}-${filters.priceRange.max}`);
  }
  if (filters.rating) {
    parts.push(`rating:${filters.rating.minStars}`);
  }
  if (filters.availability?.inStockOnly) {
    parts.push('inStock:true');
  }
  if (filters.promo?.minDiscount) {
    parts.push(`discount:${filters.promo.minDiscount}`);
  }
  if (filters.brands?.brands) {
    parts.push(`brands:${filters.brands.brands.join('|')}`);
  }
  if (filters.sources) {
    parts.push(`sources:${filters.sources.join('|')}`);
  }
  
  return parts.join(',');
}
