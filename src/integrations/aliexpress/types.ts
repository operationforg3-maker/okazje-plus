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
  affiliateId?: string; // Tracking/Affiliate ID for commission tracking
  trackingId?: string; // Alternative name for affiliate ID
  region?: string; // 'eu', 'us', 'sg' - API region
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
  targetLanguage?: string; // e.g. 'EN', 'PL'
  targetCurrency?: string; // e.g. 'USD', 'PLN'
  shipToCountry?: string; // e.g. 'PL', 'DE'
}

/**
 * Product details request parameters
 */
export interface AliExpressProductDetailsParams {
  productId: string;
  includeReviews?: boolean;
  includeVariants?: boolean;
  // M6+: Specify destination country for warehouse/shipping info
  shipToCountry?: string;
  targetLanguage?: string; // e.g. 'EN', 'PL'
  targetCurrency?: string; // e.g. 'USD', 'PLN'
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

// ============================================================
// RAW AFFILIATE API RESPONSE TYPES (source of truth)
// Based on AliExpress Open Platform types (ae_sdk / official docs)
// ============================================================

/**
 * Single product as returned by the Affiliate API
 * Methods: aliexpress.affiliate.product.query, aliexpress.affiliate.hotproduct.query,
 *          aliexpress.affiliate.productdetail.get
 *
 * Reference: https://openservice.aliexpress.com/doc/api.htm
 */
export interface AffiliateProductRaw {
  product_id?: number | string;
  product_title?: string;
  product_main_image_url?: string;
  /** Gallery thumbnails – direct string array */
  product_small_image_urls?: string[];
  product_video_url?: string;
  product_detail_url?: string;
  promotion_link?: string;

  /** Price in original seller currency */
  sale_price?: string;
  sale_price_currency?: string;
  original_price?: string;
  original_price_currency?: string;

  /** Price converted to target_currency requested in the API call */
  target_sale_price?: string;
  target_sale_price_currency?: string;
  target_original_price?: string;
  target_original_price_currency?: string;

  /** App-exclusive price */
  app_sale_price?: string;
  app_sale_price_currency?: string;
  target_app_sale_price?: string;
  target_app_sale_price_currency?: string;

  /** Promotion / campaign details when present */
  promotion_id?: string | number;
  promotion_name?: string;
  campaign_name?: string;
  promotion_type?: string;
  flash_deal?: boolean;
  promotion_start_time?: string;
  promotion_end_time?: string;
  activity_start_time?: string;
  activity_end_time?: string;

  /** Discount percentage as string, e.g. "23" */
  discount?: string;

  /** Affiliate commission rate, e.g. "0.08" */
  commission_rate?: string;
  hot_product_commission_rate?: string;
  relevant_market_commission_rate?: string;

  /** Rating 0–5 as string, e.g. "4.9" */
  evaluate_rate?: string;

  /** Sales / order volume – field name is intentional (AliExpress typo in API) */
  lastest_volume?: number | string;

  shop_id?: number | string;
  shop_url?: string;

  first_level_category_id?: number;
  first_level_category_name?: string;
  second_level_category_id?: number;
  second_level_category_name?: string;

  /** Estimated delivery days as string */
  ship_to_days?: string;

  promo_code_info?: {
    promo_code?: string;
    code_value?: string;
    code_mini_spend?: string;
    code_quantity?: string;
    code_availabletime_start?: string;
    code_availabletime_end?: string;
    code_promotionurl?: string;
  };

  coupon_list?: Array<{
    coupon_code?: string;
    code?: string;
    coupon_discount?: string;
    discount_amount?: string;
    amount?: string;
    coupon_min_amount?: string;
    min_order_amount?: string;
    min_spend?: string;
  }>;
}

/**
 * Paginated cursor result – wraps the products array
 */
export interface AffiliateProductsCursor {
  products?: AffiliateProductRaw[];
  current_record_count?: number;
  current_page_no?: number;
  total_page_no?: number;
  total_record_count?: number;
  is_finished?: boolean;
}

/**
 * Inner resp_result envelope shared by all Affiliate product methods
 */
export interface AffiliateRespResult {
  resp_code?: number | string;
  resp_msg?: string;
  result?: AffiliateProductsCursor;
}

/**
 * Top-level response for aliexpress.affiliate.product.query
 */
export interface AffiliateProductQueryResponse {
  aliexpress_affiliate_product_query_response?: {
    resp_result?: AffiliateRespResult;
  };
}

/**
 * Top-level response for aliexpress.affiliate.hotproduct.query
 */
export interface AffiliateHotproductQueryResponse {
  aliexpress_affiliate_hotproduct_query_response?: {
    resp_result?: AffiliateRespResult;
  };
}

/**
 * Top-level response for aliexpress.affiliate.productdetail.get
 */
export interface AffiliateProductDetailResponse {
  aliexpress_affiliate_productdetail_get_response?: {
    resp_result?: AffiliateRespResult;
  };
}

