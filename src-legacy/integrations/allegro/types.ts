/**
 * TypeScript types for Allegro API integration
 * 
 * Allegro is the largest Polish marketplace. Uses REST API with OAuth 2.0.
 */

/**
 * Raw product data from Allegro API
 */
export interface AllegroProduct {
  id: string;
  name: string;
  description?: string;
  images: AllegroImage[];
  sellingMode: {
    price: {
      amount: number;
      currency: string;
    };
    format: 'BUY_NOW' | 'AUCTION' | 'ADVERTISEMENT';
  };
  stock?: {
    available: number;
    unit: string;
  };
  category: {
    id: string;
    name: string;
  };
  parameters?: AllegroParameter[];
  delivery?: {
    shippingRates: {
      id: string;
      name: string;
      price: {
        amount: number;
        currency: string;
      };
    }[];
  };
  publication?: {
    status: 'ACTIVE' | 'INACTIVE' | 'ENDED';
  };
  seller: {
    id: string;
    login: string;
  };
  stats?: {
    visitsCount: number;
    watchersCount: number;
  };
  external?: {
    id: string;
  };
}

/**
 * Allegro image
 */
export interface AllegroImage {
  url: string;
  type?: string;
}

/**
 * Allegro product parameter (specification)
 */
export interface AllegroParameter {
  id: string;
  name: string;
  values: string[];
  valuesLabels?: string[];
  unit?: string;
}

/**
 * Allegro offer listing item (search result)
 */
export interface AllegroOfferListingItem {
  id: string;
  name: string;
  category: {
    id: string;
  };
  primaryImage?: {
    url: string;
  };
  sellingMode: {
    price: {
      amount: number;
      currency: string;
    };
  };
  seller: {
    id: string;
  };
  delivery: {
    availableForFree: boolean;
    lowestPrice?: {
      amount: number;
      currency: string;
    };
  };
  publication?: {
    status: string;
  };
}

/**
 * Search response from Allegro API
 */
export interface AllegroSearchResponse {
  items: {
    promoted: AllegroOfferListingItem[];
    regular: AllegroOfferListingItem[];
  };
  count: number;
  totalCount: number;
  categories?: Array<{
    id: string;
    name: string;
    count: number;
  }>;
}

/**
 * Product details response from Allegro API (Sale Offer)
 */
export interface AllegroProductDetailsResponse {
  offer: AllegroProduct;
}

/**
 * OAuth token response for Allegro API
 */
export interface AllegroOAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
  scope?: string;
  obtained_at: number; // timestamp when token was obtained
}

/**
 * API client configuration
 */
export interface AllegroClientConfig {
  clientId: string;
  clientSecret: string;
  apiEndpoint?: string;
  authEndpoint?: string;
  sandbox?: boolean; // Use sandbox environment
  timeout?: number; // milliseconds
  rateLimitPerMinute?: number;
}

/**
 * Search parameters for Allegro API
 */
export interface AllegroSearchParams {
  phrase?: string; // search phrase
  category?: string; // category ID
  seller?: string; // seller ID
  'parameter.price.from'?: number;
  'parameter.price.to'?: number;
  'delivery.free'?: boolean;
  'sellingMode.format'?: 'BUY_NOW' | 'AUCTION';
  sort?: '-price' | '+price' | '-withDeliveryPrice' | '+withDeliveryPrice' | 'relevance';
  offset?: number;
  limit?: number;
}

/**
 * Product details request parameters
 */
export interface AllegroProductDetailsParams {
  offerId: string;
}

/**
 * API error response
 */
export interface AllegroApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Allegro category
 */
export interface AllegroCategory {
  id: string;
  name: string;
  parent?: {
    id: string;
  };
  leaf: boolean;
  options?: {
    advertisement: boolean;
    advertisementPriceOptional: boolean;
  };
}
