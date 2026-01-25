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
  price: number;
  originalPrice?: number;
  currency: string;
  discount?: number;
  rating?: number;
  orders?: number;
  link: string;
  description?: string;
  specs?: Record<string, string>;
  gallery?: string[];
  storeName?: string;
  storeUrl?: string;
  shipping?: string;
  // Enhanced fields
  rawSpecs?: any;
  videoUrl?: string;
  hasVideo?: boolean;
}

export interface EnrichedProduct extends Partial<AliExpressProduct> {
  // Identification
  originalId: string;
  
  // Refined Content (Localized)
  title: LocalizedText;
  description: LocalizedText;
  specs: LocalizedText; // HTML formatted list per language
  
  // SEO Metadata
  seo: {
    [key in 'pl' | 'en' | 'de']?: {
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
