import { LocalizedText, SmartPrice } from '@/lib/types';

export interface ImportStageConfig {
  name: string;
  batchSize?: number;
  delayBetweenItems?: number;
  delayBetweenBatches?: number;
  maxRetries?: number;
  [key: string]: any;
}

export interface ProductImportState {
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface AliExpressProduct {
  id: string;
  title: string;
  image: string;
  images?: string[]; // Added: raw images array
  price: number;
  originalPrice?: number;
  currency: string;
  discount?: number;
  rating?: number;
  orders?: number;
  link: string;
  description?: string;
  descriptionHtml?: string; // HTML Description support
  specs?: Record<string, string>;
  gallery?: string[];
  storeName?: string;
  storeUrl?: string;
  shipping?: string;
  // Enhanced fields
  rawSpecs?: any;
  videoUrl?: string;
  hasVideo?: boolean;
  attributes?: any[]; // Added: raw attributes
  specifications?: any[]; // Added: specifications alias
  variants?: any[]; // Added: variants
  skuList?: any[]; // Added: concrete SKU details (options, price, image, stock)
  warehouse?: string; // Added: warehouse
  deliveryTime?: string; // Added: deliveryTime
  freeShipping?: boolean; // Added: freeShipping
  _enhanced?: boolean; // Added: enhancement flag
  _enhancedAt?: string; // Added: enhancement timestamp
}

export interface AliExpressDeal extends AliExpressProduct {
  dealPrice: number;
  startTime?: string;
  endTime?: string;
  stock?: number;
  stockLevel?: number; // Added alias
  dealType?: string; // Added: deal type identifier
  temperature?: number; // Added: deal temperature
  expiryDate?: string; // Added: expiry date
}
export interface EnrichedProduct extends Omit<Partial<AliExpressProduct>, 'title' | 'price' | 'description'> {
  // Identification
  originalId: string;
  
  // Refined Content (Localized)
  title: LocalizedText;
  description: LocalizedText;
  specs: LocalizedText; // HTML formatted list per language
  specsLocalized?: Record<string, Record<string, string>>;
  
  // Temporary / Working fields during import
  titlePL?: string;
  titleEN?: string;
  titleDE?: string;
  titleNormalizedEN?: string;
  titleOriginal?: string;
  
  descriptionPL?: string;
  descriptionEN?: string;
  descriptionDE?: string;
  
  pricePLN?: number;
  priceUSD?: number;
  
  affiliateUrl?: string;
  
  // Category Flattening
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  
  categoryName?: string;
  subcategoryName?: string;
  subsubcategoryName?: string;

  // AI Content Container
  aiContent?: {
      titlePL?: string;
      titleEN?: string;
      titleDE?: string;
      description?: {
          pl?: string;
          en?: string;
          de?: string;
      }
  };
  
  // SEO Metadata
  seo: {
    [key in 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk']?: {
      title: string;
      description: string;
      keywords: string[];
    }
  };

  // Pricing (Raw & Smart)
  price: SmartPrice;
  originalPriceValue?: number;
  discountValue?: number;

  // Categorization
  categorySlugEN: string;
  subcategorySlugEN: string;
  subsubcategorySlugEN: string;
  
  // Quality & Status
  qualityScore: number;
  
  // Media
  image: string;
  gallery: string[];
}

export interface ImportJobConfig {
  keywords: string[];
  maxProducts: number;
  categoryPath: string[]; // [Main, Sub, SubSub]
  jobId?: string;
}

export interface PipelineConfig extends Partial<ImportJobConfig> {
  jobId?: string;
  keywords: string[];
  maxProducts?: number;
  categoryPath: string[];
  categorySlugEN: string;
  subcategorySlugEN: string;
  subsubcategorySlugEN?: string;
  importerType?: 'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct';
  enrich?: { batchSize?: number };
  fetch?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; maxRetries?: number };
}
