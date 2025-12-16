/**
 * Modular Importer Types & Interfaces
 * Complete refactoring of product/deal import system
 * 
 * Philosophy:
 * - Backend uses ENGLISH as official language
 * - Polish is a translation layer only
 * - Currency handling explicit everywhere
 * - Stages: fetch → dedupe → enrich → translate → save
 */

export interface ImportStageConfig {
  name: string;
  batchSize: number;
  delayBetweenItems: number; // ms
  delayBetweenBatches: number; // ms
  maxRetries: number;
  importerType?: 'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct'; // How to fetch products
  // Optional legacy aliases used by some stages
  // Keep for backward-compat between stage implementations
  maxItemsPerSubcategory?: number;
  fetchDelay?: number; // ms
}

export interface ProductImportState {
  // Input
  categoryNameEN: string;
  categorySlugEN: string;
  subcategoryNameEN: string;
  subcategorySlugEN: string;
  subsubcategoryNameEN: string;
  subsubcategorySlugEN: string;
  importerType?: 'keyword-search' | 'hot-products' | 'category-direct';
  
  // Processing
  aliexpressProductData: AliExpressProduct[];
  deduplicatedProducts: AliExpressProduct[];
  enrichedProducts: EnrichedProduct[];
  
  // Output
  savedProductIds: string[];
  errors: string[];
}

export interface AliExpressProduct {
  id: string; // productId
  title: string;
  image: string;
  price: number; // in USD typically
  originalPrice?: number;
  discount?: number; // %
  rating?: number;
  orders?: number;
  merchant?: string;
  link: string;
  currency?: string; // e.g., 'USD', 'CNY'
  
  // Extra fields from API
  description?: string;
  descriptionHtml?: string; // Full HTML description from /item endpoint
  attributes?: any[]; // Technical specifications/attributes
  specifications?: any[]; // Alias for attributes
  variants?: any[]; // Product variants/SKUs
  images?: string[];
  categories?: string[];
  warehouse?: string; // Shipping warehouse location
  deliveryTime?: string; // Estimated delivery time
  freeShipping?: boolean;
  videoUrl?: string; // Product video if available
  shipping?: {
    cost: number;
    currency: string;
    estimatedDays: number;
  };
  // Enhancement metadata
  _enhanced?: boolean; // Flag if product was enhanced with /item data
  _enhancedAt?: string; // Timestamp of enhancement
  [key: string]: any;
}

export interface EnrichedProduct {
  // From AliExpress
  originalId: string;
  titleOriginal: string;
  image: string;
  images?: string[]; // Gallery images from AliExpress
  link: string; // AliExpress product URL
  affiliateUrl?: string; // Optional affiliate link
  price: number;
  originalPrice?: number;
  discount?: number;
  sales_volume?: number; // AliExpress sales volume (orders count)
  
  // Normalized (English) - Backend language
  titleNormalizedEN: string;
  descriptionEN: string;
  
  // Translated to Polish - UI language
  titlePL?: string;
  descriptionPL?: string;
  
  // AI-generated multilingual content
  aiContent?: {
    titlePL: string;
    titleEN: string;
    titleDE: string;
    description: Record<string, string>;
    bullets: Record<string, string[]>;
    score: number;
    seoTitle?: Record<string, string>;
    seoDescription?: Record<string, string>;
    jsonLd?: string;
    generatedAt?: string;
    modelVersion?: string;
    warnings?: string[];
  };
  
  // Currency
  priceUSD: number;
  pricePLN?: number;
  currency: 'USD' | 'PLN' | 'EUR';
  exchangeRate?: number;
  
  // Category assignments
  categorySlugEN: string;
  subcategorySlugEN: string;
  subsubcategorySlugEN: string;
  
  // Quality metadata
  quality: {
    titleQuality: number; // 0-100
    descriptionQuality: number; // 0-100
    priceReliability: number; // 0-100
  };
}

export interface DealImportState extends ProductImportState {
  dealsData: AliExpressDeal[];
  enrichedDeals: EnrichedDeal[];
}

export interface AliExpressDeal extends AliExpressProduct {
  discount: number; // Required for deals, >= 30%
  expiryDate?: string;
  stockLevel?: number;
}

export interface EnrichedDeal extends EnrichedProduct {
  discount: number;
  dealType: 'sale' | 'hot-deal' | 'flash-sale';
  temperature: number; // 0-100
  expiryDate?: string;
}

export interface ImportJobConfig {
  type: 'products' | 'deals';
  itemsPerSubcategory: number;
  stageConfigs: {
    fetch: ImportStageConfig;
    dedupe: ImportStageConfig;
    enrich: ImportStageConfig;
    translate: ImportStageConfig;
    save: ImportStageConfig;
  };
  currencyTarget: 'USD' | 'PLN';
  skipExistingProducts: boolean;
}
