/**
 * TypeScript types for Amazon Product Advertising API integration
 * 
 * These types represent the data structures returned by Amazon PA API
 * and used internally for transformation.
 */

/**
 * Raw product data from Amazon API
 */
export interface AmazonProduct {
  asin: string;
  title: string;
  description?: string;
  features?: string[];
  imageUrls: string[];
  price: {
    current: number;
    original?: number;
    currency: string;
    savings?: number;
  };
  rating?: {
    score: number;
    count: number;
  };
  availability: 'InStock' | 'OutOfStock' | 'LowStock' | 'Unknown';
  categoryPath?: string[];
  productUrl: string;
  brand?: string;
  manufacturer?: string;
  merchantInfo?: {
    name: string;
    rating?: number;
  };
  isPrime?: boolean;
  shippingInfo?: {
    cost: number;
    free: boolean;
    estimatedDelivery?: string;
  };
  variants?: ProductVariant[];
  specifications?: Record<string, string>;
}

/**
 * Product variant (size, color, etc.)
 */
export interface ProductVariant {
  asin: string;
  name: string;
  attributes: Record<string, string>;
  priceDiff?: number;
}

/**
 * Search response from Amazon API
 */
export interface AmazonSearchResponse {
  success: boolean;
  totalResults: number;
  page: number;
  pageSize: number;
  products: AmazonProduct[];
  searchRefinements?: {
    categories: string[];
    brands: string[];
    priceRanges: { min: number; max: number }[];
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Product details response from Amazon API
 */
export interface AmazonProductDetailsResponse {
  success: boolean;
  product: AmazonProduct;
  reviews?: ProductReview[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Product review from Amazon
 */
export interface ProductReview {
  id: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  verified: boolean;
  helpful?: number;
  createdAt: string;
}

/**
 * OAuth token response for Amazon API
 */
export interface AmazonOAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
  obtained_at: number; // timestamp when token was obtained
}

/**
 * API client configuration
 */
export interface AmazonClientConfig {
  accessKey: string;
  secretKey: string;
  partnerTag: string; // Amazon Associates tag
  region?: string; // e.g., 'us-east-1', 'eu-west-1'
  marketplace?: string; // e.g., 'www.amazon.com', 'www.amazon.pl'
  apiEndpoint?: string;
  timeout?: number; // milliseconds
  rateLimitPerMinute?: number;
}

/**
 * Search parameters for Amazon API
 */
export interface AmazonSearchParams {
  keywords: string; // search keywords
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  brand?: string;
  merchant?: 'Amazon' | 'All';
  primeEligible?: boolean;
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

/**
 * Product details request parameters
 */
export interface AmazonProductDetailsParams {
  asin: string;
  includeReviews?: boolean;
  includeVariants?: boolean;
}

/**
 * API error response
 */
export interface AmazonApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}
