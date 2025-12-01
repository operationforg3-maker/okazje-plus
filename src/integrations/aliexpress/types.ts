/**
 * TypeScript types for AliExpress API integration
 * 
 * These types represent the data structures returned by AliExpress API
 * and used internally for transformation.
 */

/**
 * Raw product data from AliExpress API
 */
export interface AliExpressProduct {
  item_id: string;
  title: string;
  description?: string;
  image_urls: string[];
  video_url?: string;
  price: {
    current: number;
    original?: number;
    currency: string;
    app_sale?: number; // Special app-only price
  };
  rating?: {
    score: number;
    count: number;
  };
  sales?: number;
  shipping?: {
    cost: number;
    free: boolean;
    info?: string;
    method?: string; // Standard, Express, etc.
    delivery_time?: {
      min: number;
      max: number;
      unit: 'days' | 'weeks';
    };
    from_country?: string;
    to_country?: string;
  };
  category_path?: string[];
  product_url: string;
  merchant?: {
    id: string;
    name: string;
    rating?: number;
    followers?: number;
    positive_feedback?: number; // percentage
  };
  variants?: ProductVariant[];
  discount_percent?: number;
  
  // Extended attributes
  specifications?: ProductSpecification[];
  attributes?: Record<string, string>;
  stock?: {
    available: number;
    total?: number;
  };
  warranty?: {
    type: string;
    duration?: {
      value: number;
      unit: 'months' | 'years';
    };
  };
  return_policy?: {
    allowed: boolean;
    days: number;
    conditions?: string | string[];
  };
  certifications?: string[]; // CE, FCC, etc.
  package_info?: {
    weight?: {
      value: number;
      unit: 'kg' | 'g' | 'lb';
    };
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: 'cm' | 'inch';
    };
    contents?: string;
  };
  tags?: string[]; // hot deal, best seller, new arrival
  availability?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order';
}

/**
 * Product variant (size, color, etc.)
 */
export interface ProductVariant {
  id: string;
  name: string;
  values: string[];
  price_diff?: number;
  stock?: Record<string, number>; // variant value -> stock count
  sku?: string;
}

/**
 * Product specification entry
 */
export interface ProductSpecification {
  name: string;
  value: string;
  unit?: string;
}

/**
 * Search response from AliExpress API
 */
export interface AliExpressSearchResponse {
  success: boolean;
  total: number;
  page: number;
  page_size: number;
  products: AliExpressProduct[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Product details response from AliExpress API
 */
export interface AliExpressProductDetailsResponse {
  success: boolean;
  product: AliExpressProduct;
  reviews?: ProductReview[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Product review from AliExpress
 */
export interface ProductReview {
  id: string;
  user_name: string;
  rating: number;
  content: string;
  images?: string[];
  created_at: string;
}

/**
 * OAuth token response
 */
export interface AliExpressOAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
  obtained_at: number; // timestamp when token was obtained
}

/**
 * API client configuration
 */
export interface AliExpressClientConfig {
  appKey: string;
  appSecret: string;
  apiEndpoint?: string;
  apiVersion?: string;
  timeout?: number; // milliseconds
  rateLimitPerMinute?: number;
}

/**
 * Search parameters for AliExpress API
 */
export interface AliExpressSearchParams {
  q: string; // search query
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minOrders?: number;
  minDiscount?: number;
  shippingType?: 'free' | 'paid' | 'any';
  page?: number;
  limit?: number;
  sort?: 'price_asc' | 'price_desc' | 'orders' | 'rating' | 'newest';
}

/**
 * Product details request parameters
 */
export interface AliExpressProductDetailsParams {
  productId: string;
  includeReviews?: boolean;
  includeVariants?: boolean;
}

/**
 * API error response
 */
export interface AliExpressApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}
