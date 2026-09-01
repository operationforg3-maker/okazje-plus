/**
 * TradeTracker Integration Types
 * Supporting TradeTracker SOAP Web Services & XML/CSV Product/Voucher Feeds
 * https://tradetracker.com
 */

export interface TradeTrackerConfig {
  customerId?: string;      // Customer ID from TradeTracker (Creatives > Web Services)
  passphrase?: string;      // Passphrase from TradeTracker Web Services
  affiliateSiteId?: string; // Affiliate Site ID (numer ID zarejestrowanej witryny)
  locale?: string;          // e.g., 'pl_PL', 'en_GB', 'de_DE'
  sandbox?: boolean;        // Whether to use sandbox mode
  feedUrl?: string;         // Default XML/CSV feed URL (e.g. pf.tradetracker.net)
}

/**
 * Raw product item extracted from TradeTracker XML or CSV Feed
 */
export interface TradeTrackerProductFeedItem {
  productID: string;
  name: string;
  price: number;
  fromPrice?: number;         // Original price before discount
  discount?: number;          // Discount percent (e.g. 25 for 25%)
  currency?: string;          // Currency code (e.g. 'PLN', 'EUR')
  categories?: string[];      // Category breadcrumbs / hierarchy
  category?: string;          // Primary category name
  description?: string;
  shortDescription?: string;
  imageURL: string;
  additionalImages?: string[];
  productURL: string;         // Direct affiliate link or product landing link
  trackingURL?: string;       // Affiliate tracking URL
  shippingCosts?: number;
  deliveryTime?: string;      // e.g. "1-2 dni robocze" or days number
  deliveryDays?: number;
  brand?: string;
  merchantName?: string;
  ean?: string;
  gtin?: string;
  upc?: string;
  mpn?: string;
  sku?: string;
  inStock?: boolean;
  stockCount?: number;
  rating?: number;
  ratingCount?: number;
  properties?: Record<string, string>;
  voucherCode?: string;
}

/**
 * Voucher / coupon / promotion item from TradeTracker Web Services API
 */
export interface TradeTrackerVoucherItem {
  id: string;
  campaignID: string;
  campaignName: string;
  name: string;
  code?: string;              // Voucher / coupon code
  discount?: number;          // Discount amount or percent
  discountType?: 'percentage' | 'fixed' | 'free_shipping' | 'general';
  description?: string;
  termsAndConditions?: string;
  validFromDate?: string;     // YYYY-MM-DD
  validToDate?: string;       // YYYY-MM-DD
  url: string;                // Affiliate landing URL
  imageURL?: string;
  category?: string;
  minimumOrderValue?: number;
  currency?: string;
  isExclusive?: boolean;
}

/**
 * TradeTracker Campaign
 */
export interface TradeTrackerCampaign {
  id: string;
  name: string;
  url: string;
  category: string;
  commission?: string;
  currency?: string;
  country?: string;
  assignmentStatus?: 'accepted' | 'pending' | 'rejected' | 'notsignedup';
}

/**
 * TradeTracker Fetch / Search Options
 */
export interface TradeTrackerFetchOptions {
  query?: string;
  mode?: 'products' | 'vouchers' | 'auto-browse';
  feedUrl?: string;
  category?: string;
  minDiscountPercent?: number; // Minimum discount percentage (e.g. 10%)
  page?: number;
  limit?: number;
  sortBy?: 'discount' | 'price_asc' | 'popularity' | 'latest';
}
