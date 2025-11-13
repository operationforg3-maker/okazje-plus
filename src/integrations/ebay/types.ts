/**
 * TypeScript types for eBay API integration
 * 
 * Uses eBay Browse API for product search and details
 */

/**
 * Raw product data from eBay API
 */
export interface EbayProduct {
  itemId: string;
  title: string;
  shortDescription?: string;
  description?: string;
  image: {
    imageUrl: string;
  };
  additionalImages?: Array<{
    imageUrl: string;
  }>;
  price: {
    value: string;
    currency: string;
  };
  originalPrice?: {
    value: string;
    currency: string;
  };
  condition?: string;
  conditionId?: string;
  itemWebUrl: string;
  itemLocation?: {
    country: string;
    postalCode?: string;
  };
  seller: {
    username: string;
    feedbackPercentage?: string;
    feedbackScore?: number;
  };
  categoryPath?: string;
  categoryId?: string;
  shippingOptions?: EbayShippingOption[];
  itemAffiliateWebUrl?: string;
  buyingOptions?: string[];
  estimatedAvailabilities?: Array<{
    availabilityThreshold?: number;
    deliveryOptions?: string[];
  }>;
  quantityLimitPerBuyer?: number;
}

/**
 * eBay shipping option
 */
export interface EbayShippingOption {
  shippingCostType: string;
  shippingCost?: {
    value: string;
    currency: string;
  };
  minEstimatedDeliveryDate?: string;
  maxEstimatedDeliveryDate?: string;
  shippingServiceCode?: string;
}

/**
 * Search response from eBay API
 */
export interface EbaySearchResponse {
  href: string;
  total: number;
  limit: number;
  offset: number;
  itemSummaries?: EbayItemSummary[];
  warnings?: Array<{
    category: string;
    message: string;
  }>;
}

/**
 * eBay item summary (search result)
 */
export interface EbayItemSummary {
  itemId: string;
  title: string;
  image?: {
    imageUrl: string;
  };
  price: {
    value: string;
    currency: string;
  };
  itemWebUrl: string;
  seller: {
    username: string;
    feedbackPercentage?: string;
  };
  condition?: string;
  buyingOptions?: string[];
  shippingOptions?: EbayShippingOption[];
  categories?: Array<{
    categoryId: string;
    categoryName?: string;
  }>;
}

/**
 * Product details response from eBay API
 */
export interface EbayProductDetailsResponse {
  itemId: string;
  title: string;
  shortDescription?: string;
  description?: string;
  image: {
    imageUrl: string;
  };
  additionalImages?: Array<{
    imageUrl: string;
  }>;
  price: {
    value: string;
    currency: string;
  };
  itemWebUrl: string;
  seller: {
    username: string;
    feedbackPercentage?: string;
    feedbackScore?: number;
  };
  condition?: string;
  categoryPath?: string;
  shippingOptions?: EbayShippingOption[];
}

/**
 * OAuth token response for eBay API
 */
export interface EbayOAuthToken {
  access_token: string;
  expires_in: number; // seconds
  token_type: string;
  obtained_at: number; // timestamp when token was obtained
}

/**
 * API client configuration
 */
export interface EbayClientConfig {
  clientId: string;
  clientSecret: string;
  apiEndpoint?: string;
  authEndpoint?: string;
  marketplaceId?: string; // e.g., 'EBAY_PL', 'EBAY_US'
  sandbox?: boolean; // Use sandbox environment
  timeout?: number; // milliseconds
  rateLimitPerMinute?: number;
}

/**
 * Search parameters for eBay API
 */
export interface EbaySearchParams {
  q?: string; // search keywords
  category_ids?: string; // comma-separated category IDs
  filter?: string; // filters like 'price:[10..100],priceCurrency:USD'
  sort?: 'price' | '-price' | 'distance' | 'newlyListed';
  limit?: number;
  offset?: number;
  fieldgroups?: string; // e.g., 'MATCHING_ITEMS,FULL'
}

/**
 * Product details request parameters
 */
export interface EbayProductDetailsParams {
  itemId: string;
  fieldgroups?: string; // e.g., 'PRODUCT,COMPACT'
}

/**
 * API error response
 */
export interface EbayApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * eBay category
 */
export interface EbayCategory {
  categoryId: string;
  categoryName: string;
  categoryTreeId?: string;
  parentCategoryId?: string;
  leafCategory?: boolean;
}
