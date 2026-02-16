// ====== KATEGORIE ======
export interface Category {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  accentColor?: string;
  heroImage?: string;
  sortOrder?: number;
  promo?: CategoryPromo;
  translations?: Record<string, { name: string; description?: string }>;
  subcategories?: Subcategory[];
  tiles?: CategoryTile[];
}

export interface Subcategory {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  translations?: Record<string, { name: string; description?: string }>;
  subcategories?: SubSubcategory[];
  id?: string;
  sortOrder?: number;
  image?: string;
  highlight?: boolean;
}

export interface SubSubcategory {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  translations?: Record<string, { name: string; description?: string }>;
  importKeywords?: string[]; // frazy pomocne w importach/wyszukiwaniu
  aliexpressCategoryIds?: string[]; // AliExpress category IDs dla hot-products mode
  exampleProducts?: Array<{ name: string; category: string }>; // przykładowe produkty z tej kategorii
  searchKeywords?: string[]; // słowa kluczowe do wyszukiwania (AI-generated)
  id?: string;
  sortOrder?: number;
  image?: string;
}

export interface CategoryPromo {
  id?: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  link?: string;
  badge?: string;
  color?: string;
  cta?: string;
  type?: 'custom' | 'top-rated' | 'best-selling' | 'hot-deals' | 'category';
}

export interface CategoryTile {
  id?: string;
  slug: string;
  name: string;
  image?: string;
  color?: string;
  description?: string;
  badge?: string;
  link?: string;
  subtitle?: string;
  title?: string; // alias for name used in legacy UI
}

// ============================================
// M4: LocalizedText & Smart Pricing Types
// ============================================

/**
 * AIContent - AI-generated multilingual content with quality score
 */
export interface AIContent {
  titlePL: string;                // AI-generated Polish title
  titleEN: string;                // AI-generated English title
  titleDE: string;                // AI-generated German title
  description: Record<string, string>; // Localized HTML descriptions { pl: '...', en: '...', de: '...' }
  bullets: Record<string, string[]>;   // Localized feature bullets { pl: [...], en: [...], de: [...] }
  score: number;                  // AI Quality Score 0-100
  seoTitle?: Record<string, string>;   // SEO-optimized titles { pl: '...', en: '...', de: '...' }
  seoDescription?: Record<string, string>; // SEO meta descriptions
  jsonLd?: string;                // JSON-LD structured data for rich snippets
  generatedAt?: string;           // ISO timestamp of AI generation
  modelVersion?: string;          // AI model version used (e.g., 'gemini-2.0-flash')
}

/**
 * LocalizedText - Multi-language text support with fallback chain
 * Priority: current language -> English -> Polish
 */
export interface LocalizedText {
  pl: string;  // Polish (required - base language)
  en: string;  // English (required)
  de?: string; // German (optional)
  fr?: string; // French (optional)
  es?: string; // Spanish (optional)
  uk?: string; // Ukrainian (optional)
  [key: string]: string | undefined; // Extensible for future languages
}

/**
 * SmartPrice - Enhanced price model with shipping & omnibus compliance
 */
export interface SmartPrice {
  basePrice?: number;              // Base product price in USD (source of truth - optional for backward compatibility)
  amount: number;                  // Base product price (can be in any currency)
  currency: string;                // Currency code (USD preferred, but supports PLN/EUR/GBP)
  shippingCost: number;           // Calculated shipping cost in USD
  totalPrice: number;              // basePrice + shippingCost (displayed as "Total Landed Cost")
  lowestPrice30Days?: number;     // Omnibus directive compliance (lowest price in last 30 days)
  originalPrice?: number;          // Original price before discount in USD
  discountPercent?: number;        // Calculated discount percentage
  freeShipping?: boolean;          // True if shippingCost is 0
  lastUpdated?: string;            // ISO timestamp of last price update
  estimatedDeliveryDays?: number; // Estimated shipping time in days
}

// Zaktualizowany interfejs Product (M4 Enhanced)
export interface Product {
  id: string;
  
  // DEPRECATED: Legacy single-language fields (keep for backward compatibility)
  // These will be auto-populated from title.pl / description.pl for existing code
  name: string;
  description: string;
  longDescription: string;
  
  // M4: NEW Multi-language fields (replace name/description/longDescription)
  title: LocalizedText;            // Product title in multiple languages
  shortDescription: LocalizedText; // Short description (1-2 sentences)
  fullDescription: LocalizedText;  // Full product description
  seoDescription?: LocalizedText;  // AI-generated SEO meta description
  
  image: string;
  imageHint: string;
  affiliateUrl: string;
  
  // M4: Smart Pricing Model
  price: any;                      // Allow legacy numeric price assignments
  smartPrice?: SmartPrice;         // Optional structured price
  
  // DEPRECATED: Legacy price fields (keep for compatibility)
  originalPrice?: number;
  discountPercent?: number;
  currency?: string;
  
  // Multi-language support (DEPRECATED - replaced by title/description LocalizedText)
  translations?: {
    en?: {
      name: string;
      description: string;
      longDescription?: string;
      seoKeywords?: string[];
      metaTitle?: string;
      metaDescription?: string;
    };
    de?: {
      name: string;
      description: string;
      longDescription?: string;
      seoKeywords?: string[];
      metaTitle?: string;
      metaDescription?: string;
    };
    [key: string]: {
      name: string;
      description: string;
      longDescription?: string;
      seoKeywords?: string[];
      metaTitle?: string;
      metaDescription?: string;
    } | undefined;
    // Możliwość rozszerzenia o inne języki (fr, es, etc.)
  };
  
  ratingCard: ProductRatingCard;
  /**
   * Rozdzielone źródła ocen:
   * - editorial: ocena redakcji / administracji (ustawiana ręcznie)
   * - users: agregowana ocena naszych użytkowników (wyliczana z kolekcji ratings/)
   * - external: ocena z zewnętrznego źródła (np. AliExpress) wraz z licznością jeśli dostępna
   * Zachowujemy ratingCard dla kompatybilności (aktualnie odzwierciedla users lub external fallback).
   */
  ratingSources?: ProductRatingSources;
  shareCount?: number; // Licznik udostępnień społecznościowych
  mainCategorySlug: string; // NOWE pole
  subCategorySlug: string;  // NOWE pole
  subSubCategorySlug?: string; // NOWE pole dla poziomu 3
  categoryName?: string; // Polish category name (derived from slug or set at import)
  subcategoryName?: string; // Polish subcategory name (derived from slug or set at import)
  subsubcategoryName?: string; // Polish sub-subcategory name (derived from slug or set at import)
  status: 'draft' | 'approved' | 'rejected' | 'ready_for_review'; // Status moderacji
  category?: string; // Stara wersja dla kompatybilności
  gallery?: ProductImageEntry[]; // Pełna galeria
  seo?: ProductSeoMeta; // Meta dane generowane przez AI / modyfikowane ręcznie
  seoKeywords?: string[]; // M2: SEO keywords dla search indexing
  metaTitle?: string; // M2: Meta title for SEO
  metaDescription?: string; // M2: Meta description for SEO
  ai?: ProductAiMeta; // Dane analityczne AI (duplikaty, propozycje)
  aiContent?: AIContent; // AI-generated multilingual content with quality score
  moderation?: ProductModerationState; // Informacje o procesie moderacji
  metadata?: ProductImportMetadata; // Źródło importu i dane oryginalne
  meta?: {
    isHotDeal: boolean;              // Auto-calculated: discount > 40% AND rating > 4.5
    importedAt: string;              // ISO timestamp of import
    salesVolume?: number;            // AliExpress sales volume (orders count)
    averageStarRate?: number;        // AliExpress star rating (0-5)
    conversionRate?: number;         // Estimated conversion rate (if available)
  };
  /**
   * Future-proof dwukierunkowe powiązanie: lista dealId powiązanych z tym produktem.
   * Aktualizowana transakcyjnie przy dodaniu/usunięciu powiązania.
   */
  linkedDealIds?: string[];
}

// Galeria obrazów produktu
export interface ProductImageEntry {
  id: string;
  type: 'url' | 'storage';
  src: string;
  alt?: string;
  isPrimary?: boolean;
  source?: 'aliexpress' | 'manual';
  addedAt?: string; // ISO
}

export interface ProductSeoMeta {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  aiVersion?: number;
  lastAiEnrichmentAt?: string;
}

export interface ProductAiMeta {
  suggestedCategoryPath?: string[]; // np. ['elektronika','telefony','smartfony']
  softDuplicateOf?: string | null; // ID podobnego produktu
  softDuplicateScore?: number; // 0..1 podobieństwo
  enrichmentConfidence?: number; // 0..1
  flags?: string[]; // np. ['enrichment_failed','duplicate_suspected']
  
  // M2: AI Quality Score metadata
  quality?: {
    score: number; // 0-100
    recommendation: 'approve' | 'review' | 'reject';
    factors: {
      priceQuality: number;
      discountLegitimacy: number;
      merchantTrust: number;
      productPopularity: number;
      contentQuality: number;
    };
    warnings: string[];
    reasoning: string;
    scoredAt: string;
  };
  
  // M2: Title Normalization metadata
  titleNormalization?: {
    originalTitle: string;
    normalizedTitle: string;
    translated: boolean;
    changes: string[];
  };
  
  // M2: Category Mapping metadata
  categoryMapping?: {
    suggestedPath: string[];
    confidence: number;
    reasoning?: string;
  };
  
  // M2: SEO Generation metadata
  seo?: {
    generatedDescription: string;
    keywords: string[];
    generatedAt: string;
  };

  // M3: Enrichment szczegółowy (cechy i słowa kluczowe)
  enrichment?: {
    features?: string[];
    keywords?: string[];
  };
}

export interface ProductModerationState {
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  reviewerUid?: string;
  rejectionReason?: string;
}

export interface ProductImportMetadata {
  source: 'aliexpress' | 'manual' | 'csv' | 'amazon' | 'allegro' | 'ebay';
  originalId?: string; // External ID from source platform
  
  // Product identifiers (critical for deduplication & SEO)
  sku?: string; // Stock Keeping Unit (seller's internal ID)
  ean?: string; // European Article Number (8 or 13 digits)
  gtin?: string; // Global Trade Item Number (GTIN-8/12/13/14)
  upc?: string; // Universal Product Code (12 digits, primarily North America)
  isbn?: string; // International Standard Book Number (for books)
  mpn?: string; // Manufacturer Part Number
  
  createdAt?: string; // ISO timestamp when product was first created
  importedAt?: string; // ISO timestamp when imported to our system
  importedBy?: string; // UID of user who triggered import
  orders?: number; // Number of orders/sales from source
  shipping?: string; // Shipping description
  merchant?: string; // Merchant/seller name
  merchantId?: string; // Merchant ID in source system
  brand?: string; // Brand name
  rawDataStored?: boolean; // Whether raw API response is stored
  locale?: string; // Locale of import (e.g., 'pl', 'en', 'de')
  
  // Currency conversion metadata
  currencyRate?: number; // Exchange rate at import time (e.g., 4.0 for USD→PLN)
  qualityScore?: number; // 0-100 overall quality score
  
  // Price tracking
  priceHistory?: Array<{
    price: number;
    currency: string;
    timestamp: string;
    source: 'import' | 'sync' | 'manual';
  }>;
  
  // Advanced API fields (AliExpress, Amazon, etc.)
  promotionId?: string;
  commissionRate?: number; // Affiliate commission rate (0-100)
  evaluateCount?: number; // Number of reviews/ratings
  evaluateRate?: string; // Raw rating from API (e.g., "4.5/5")
  sellerRating?: number; // Seller rating (0-5)
  returnPolicy?: string | {
    allowed: boolean;
    days: number;
    conditions?: string;
  };
  hotProduct?: boolean; // Marked as hot/trending in source
  flashDeal?: boolean; // Flash sale/deal
  platformProductType?: string; // Product type in source platform
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  stockLevel?: number; // Available quantity
  specifications?: Array<{key?: string; name?: string; value: string; unit?: string}>; // Technical specs
  productVideoUrl?: string;
  warehouse?: string; // Warehouse location
  deliveryTime?: string; // Estimated delivery time
  freeShipping?: boolean;
  shippingCost?: number;
  shippingMethod?: string;
  
  // Enhanced fields from enriched AliExpress data
  shippingDetails?: {
    method?: string;
    deliveryTime?: string;
    fromCountry?: string;
    toCountry?: string;
    cost?: number;
    free?: boolean;
  };
  stock?: {
    available?: number;
    total?: number;
    availability?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order';
  };
  warranty?: {
    type?: string;
    duration?: string;
  };
  certifications?: string[];
  packageInfo?: {
    weight?: string;
    dimensions?: string;
  };
  tags?: string[];
  merchantDetails?: {
    name?: string;
    rating?: number;
    followers?: number;
    positiveFeedback?: number;
  };
  videoUrl?: string;
  appSalePrice?: number;
}

// ============================================
// Deal Type (Okazje) - LEGACY
// ============================================

/**
 * @deprecated Use DealM6 (line 2314) for new code. This legacy interface kept for Cloud Functions compatibility.
 * Will be removed after Cloud Functions migration to M6 schema.
 */
export interface DealLegacy {
  id: string;
  
  // M4: Multi-language fields (STANDARD - all deals must use LocalizedText)
  title: LocalizedText;                  // Deal title in multiple languages
  description: LocalizedText;            // Deal description in multiple languages
  
  // M6 compatibility: Allow object format
  price: number | { amount: number; currency: string };
  // M6+: Alternative price format (from Harvester/M6)
  legacyPrice?: number; // Fallback for M6 compatibility
  originalPrice?: number;
  link: string;
  image: string;
  imageHint: string;
  postedBy: string;
  postedAt: string;
  voteCount: number;
  temperature: number;
  commentsCount: number;
  shareCount?: number;
  
  // Categories
  category: string; // legacy backward compatibility
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug?: string;
  
  // Deal specifics
  merchant?: string;
  shippingCost?: number;
  status: 'draft' | 'approved' | 'rejected';
  createdBy?: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  
  // Links & Source
  linkedProductIds?: string[];
  externalOriginalId?: string;
  source?: 'manual' | 'aliexpress' | 'csv' | 'pepper' | 'mydealz' | 'reddit' | 'other' | 'auto-scraped';
  
  // Extended deal parameters
  dealType?: 'sale' | 'coupon' | 'freebie' | 'pricing-error' | 'cashback' | 'bundle';
  couponCode?: string;
  freeShipping?: boolean;
  cashback?: {
    amount?: number;
    percentage?: number;
    provider?: string;
  };
  minOrderValue?: number;
  stockAlert?: 'limited' | 'low' | 'ending-soon';
  expiryDate?: string;
  availableQuantity?: number;
  limitPerUser?: number;
  requiresMembership?: string;
  conditions?: string[];
  gallery?: string[];
  
  // Verification
  verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  
  // SEO & Tags
  tags?: string[];
  
  // AI Quality
  aiQuality?: {
    score?: number;
    factors?: {
      titleQuality?: number;
      descriptionCompleteness?: number;
      discountLegitimacy?: number;
      merchantTrust?: number;
      productPopularity?: number;
      contentQuality?: number;
    };
    warnings?: string[];
    reasoning?: string;
    scoredAt?: string;
  };
  
  // Import Metadata (unified with Product)
  importMetadata?: {
    source?: 'aliexpress' | 'manual' | 'csv' | 'amazon' | 'allegro' | 'pepper' | 'mydealz' | 'reddit' | 'auto-scraped';
    originalId?: string; // External ID from source
    importedAt?: string; // ISO timestamp
    importedBy?: string; // UID of importer
    originalUrl?: string;
    locale?: string; // Locale of import
    promotionId?: string;
    commissionRate?: number;
    evaluateCount?: number;
    evaluateRate?: string;
    sellerRating?: number;
    returnPolicy?: string;
    hotProduct?: boolean;
    flashDeal?: boolean;
    platformProductType?: string;
    stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
    stockLevel?: number;
    specifications?: any;
    productVideoUrl?: string;
    warehouse?: string;
    deliveryTime?: string;
    shippingMethod?: string;
    merchant?: string;
    merchantId?: string;
    orders?: number;
    brand?: string;
    // Price tracking for deals
    priceHistory?: Array<{
      price: number;
      currency: string;
      timestamp: string;
      source: 'import' | 'sync' | 'manual';
    }>;
  };
  
  // General Metadata
  metadata?: {
    source?: string;
    importedAt?: string;
    originalId?: string;
    originalUrl?: string;
    promotionId?: string;
    commissionRate?: number;
    evaluateCount?: number;
    evaluateRate?: string;
    sellerRating?: number;
    returnPolicy?: string;
    hotProduct?: boolean;
    flashDeal?: boolean;
    platformProductType?: string;
    stockStatus?: 'in_stock' | 'out_of_stock' | 'low_stock' | 'unknown';
    stockLevel?: number;
    specifications?: any;
    productVideoUrl?: string;
    warehouse?: string;
    deliveryTime?: string;
    shippingMethod?: string;
    contentConfidence?: number;
    generationWarnings?: string[];
    dealTags?: string[];
    flashSale?: { active?: boolean; appSalePrice?: number; originalPrice?: number };
    stockAlert?: { lowStock?: boolean; available?: number; total?: number };
    shippingDetails?: { method?: string; deliveryTime?: string; fromCountry?: string; free?: boolean; cost?: number };
    merchantRating?: number;
    certifications?: string[];
    videoUrl?: string;
    translationInProgress?: string[];
    isExpired?: boolean;
    expiryReason?: string;
    expiryCheckedAt?: string;
  };
}

/**
 * Type alias for backward compatibility. Cloud Functions use DealLegacy schema.
 * New M6 code should use DealM6 interface (line 2314+).
 */
export type Deal = DealLegacy;

// Reszta interfejsów pozostaje bez zmian
export interface ProductRatingCard {
  average: number;
  count: number;
  durability: number;
  easeOfUse: number;
  valueForMoney: number;
  versatility: number;
}

export interface ProductRatingSources {
  editorial?: {
    average: number;
    count?: number; // liczba recenzji redakcyjnych (często 1)
    updatedAt?: string;
  };
  users?: {
    average: number;
    count: number; // liczba ocen użytkowników
    updatedAt?: string;
  };
  external?: {
    average: number;
    count?: number; // np. liczba zamówień lub liczba recenzji w źródle
    source?: string; // np. 'aliexpress'
    updatedAt?: string;
  };
}

// Nowy interfejs dla pojedynczej oceny użytkownika
export interface ProductRating {
  id: string;
  productId: string;
  userId: string;
  userDisplayName?: string;
  rating: number; // 1-5
  durability: number;
  easeOfUse: number;
  valueForMoney: number;
  versatility: number;
  review?: string; // Opcjonalna recenzja tekstowa
  createdAt: string; // ISO string
}

export interface UserStats {
  voteCount: number;              // Total votes user has cast on deals
  commentCount: number;           // Total comments user has posted (on deals + products)
  forumPostCount: number;         // Total forum posts (threads) created
  forumReplyCount: number;        // Total replies in forum threads
  ratingCount: number;            // Total product ratings
  totalLikesReceived: number;     // Total likes on user's comments + posts
  dealsPostedCount: number;       // Total deals posted by user
  lastUpdated: string;            // ISO timestamp of last stats update
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'moderator' | 'specjalista' | 'user';
  betaRole?: 'pioneer' | 'beta'; // Rola z pre-rejestracji (opcjonalna)
  betaNumber?: number; // Numer rejestracji (opcjonalny)
  createdAt?: string; // Data utworzenia konta
  stats?: UserStats; // Cached user statistics - updated by Cloud Functions
}

// Import/Seeding profiles and AI prompt configuration
export type AiFlowTarget = "categories" | "products" | "deals" | "translations";

export interface PromptConfig {
  id: string;
  target: AiFlowTarget;
  name: string;
  prompt: string;
  params?: { temperature?: number; maxTokens?: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminImportProfile {
  id: string;
  target: Exclude<AiFlowTarget, "translations">;
  name: string;
  upsert?: boolean;
  dedupe?: boolean;
  batchSize?: number;
  autoApproveDeals?: boolean;
  categoryMapping?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vote {
  direction: 'up' | 'down';
}

export interface Comment {
  id: string;
  dealId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string; // Avatar użytkownika
  content: string;
  createdAt: string; // ISO string
  parentId?: string | null; // ID komentarza rodzica dla odpowiedzi
  repliesCount?: number; // Liczba bezpośrednich odpowiedzi
  edited?: boolean;
  editedAt?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  itemId: string; // ID okazji lub produktu
  itemType: 'deal' | 'product';
  createdAt: string; // ISO string
}

export interface Notification {
  id: string;
  userId: string;
  type: 'comment_reply' | 'forum_mention' | 'new_deal' | 'system' | 'deal_approved' | 'deal_rejected';
  title: string;
  message: string;
  link?: string; // Link do odpowiedniego zasobu
  itemId?: string; // ID powiązanego elementu (deal, product, comment, forum_thread)
  itemType?: 'deal' | 'product' | 'comment' | 'forum_thread';
  read: boolean;
  createdAt: string; // ISO string
  metadata?: {
    dealTitle?: string;
    commentText?: string;
    categorySlug?: string;
    [key: string]: any;
  };
}

export interface NavigationShowcaseConfig {
  promotedType: 'deals' | 'products';
  promotedIds: string[];
  dealOfTheDayId?: string | null;
  productOfTheDayId?: string | null;
}

// Log pojedynczego importu (ręczny lub auto-fill)
export interface ImportLog {
  id: string;
  mode: 'manual' | 'auto_fill';
  categoryTarget?: {
    main?: string;
    sub?: string;
    subSub?: string;
  };
  totalRequested: number;
  importedCount: number;
  skipped: { originalId?: string; reason: string }[];
  softDuplicates?: { originalId?: string; matchedId?: string; score?: number }[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  invokedBy: string; // UID
  aiUsed: boolean;
}

export interface SystemReportDetail {
  categoryId: string;
  currentCount: number;
  requiredMin: number;
  deficit: number;
  suggestedQueries?: string[];
}

export interface SystemReport {
  id: string;
  type: 'coverage' | 'quality';
  createdAt: string;
  summary?: string;
  details: SystemReportDetail[];
  resolved?: boolean;
  resolvedAt?: string;
  triggeredBy: 'scheduler' | 'manual';
}

export interface AiJobRef {
  collection: string;
  id: string;
}

export interface AiJob {
  id: string;
  kind: 'enrich_product' | 'expand_category' | 'detect_duplicates';
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputRef: AiJobRef;
  outputRef?: AiJobRef;
  progress?: number; // 0..1
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

// ============================================
// Forum (wątki i posty)
// ============================================

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  createdAt?: string;
}

export interface CategorySuggestion {
  id: string;
  name: string;
  description: string;
  suggestedByUid: string;
  suggestedByName?: string | null;
  status: 'pending' | 'approved' | 'rejected'; // pending = oczekujące, approved = zaakceptowana i stworzona jako kategoria
  createdAt: string;
  reviewedAt?: string;
  reviewedByUid?: string; // Admin który zaakceptował/odrzucił
  rejectionReason?: string; // Powód odrzucenia (jeśli applicable)
}

export type PostAttachment =
  | { type: 'deal'; id: string }
  | { type: 'product'; id: string };

export interface ForumThread {
  id: string;
  title: string;
  authorUid: string;
  authorDisplayName?: string | null;
  categoryId?: string | null;
  tags?: string[];
  summary?: string; // pierwsze 200 znaków pierwszego posta
  attachments?: PostAttachment[]; // np. załączony deal lub produkt
  postsCount: number;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
  lastPostAt?: string; // ISO
  
  // Moderacja i status
  status?: 'draft' | 'approved' | 'rejected' | 'spam'; // Status moderacji
  isPinned?: boolean; // Przypięty wątek (sticky)
  isLocked?: boolean; // Zablokowany (no new posts)
  lockedBy?: string; // UID moderatora
  lockedAt?: string; // ISO
  lockedReason?: string;
  
  // Engagement
  views?: number; // Liczba wyświetleń
  bestAnswerId?: string; // ID posta oznaczonego jako najlepsza odpowiedź
  
  // SEO & Search
  slug?: string; // URL-friendly slug
}

export interface ForumPost {
  id: string;
  threadId: string;
  authorUid: string;
  authorDisplayName?: string | null;
  content: string;
  attachments?: PostAttachment[];
  parentId?: string | null; // dla odpowiedzi zagnieżdżonych (M2)
  upvotes?: number;
  downvotes?: number;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
  
  // Moderacja
  status?: 'approved' | 'pending' | 'deleted' | 'spam';
  deletedBy?: string; // UID moderatora lub autora
  deletedAt?: string; // ISO
  deletedReason?: string;
  
  // Edycja
  isEdited?: boolean;
  editedAt?: string; // ISO
  editHistory?: Array<{
    content: string;
    editedAt: string;
    editedBy: string;
  }>;
  
  // Reactions
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  
  // Flagging & Reports
  reportCount?: number;
  reports?: Array<{
    reportedBy: string;
    reason: string;
    reportedAt: string;
  }>;
}

// ============================================
// AliExpress Integration Data Models (M1)
// ============================================

/**
 * Vendor - stores metadata about external vendors like AliExpress (M2 enhanced)
 */
export interface Vendor {
  id: string;
  name: string; // e.g., "AliExpress"
  slug: string; // e.g., "aliexpress"
  enabled: boolean;
  lastSyncAt?: string; // ISO timestamp
  config?: {
    apiEndpoint?: string;
    apiVersion?: string;
    rateLimitPerMinute?: number;
    supportsOAuth?: boolean; // M2: OAuth support flag
    oauthConfigId?: string; // M2: Reference to OAuthConfig
  };
  stats?: {
    totalProducts?: number;
    totalDeals?: number;
    lastImportCount?: number;
    failedImportsCount?: number;
    activeTokensCount?: number; // M2: Number of active OAuth tokens
  };
  createdAt: string;
  updatedAt?: string;
}

/**
 * ImportProfile - defines rules for importing from a vendor (M2 enhanced)
 */
export interface ImportProfile {
  id: string;
  vendorId: string; // Reference to Vendor
  name: string; // Human-readable name
  enabled: boolean;
  schedule?: string; // Cron expression for scheduled imports (deprecated - use scheduleConfig)
  scheduleConfig?: ImportScheduleConfig; // M2: Advanced scheduling
  filters: {
    searchQuery?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    minOrders?: number;
    minDiscount?: number;
    categoryFilter?: string;
    shippingType?: 'free' | 'paid' | 'any';
  };
  mapping: {
    targetMainCategory: string; // Slug of target category
    targetSubCategory: string; // Slug of target subcategory
    targetSubSubCategory?: string; // Optional level 3
    priceMarkup?: number; // Percentage markup to apply
    defaultStatus?: 'draft' | 'approved'; // Default status for imported items
  };
  deduplicationStrategy: 'skip' | 'update' | 'create_new' | 'ai_merge'; // M2: Added ai_merge
  maxItemsPerRun?: number; // Limit for safety
  cacheConfig?: CacheConfig; // M2: HTTP cache configuration
  rateLimitConfig?: RateLimitConfig; // M2: Rate limiting
  createdAt: string;
  updatedAt?: string;
  createdBy: string; // UID of admin who created
  // M2: Usage statistics
  stats?: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalItemsImported: number;
    averageDurationMs: number;
    lastRunAt?: string;
    cacheHitRate?: number;
    apiCallsSaved?: number; // Via caching
  };
}

/**
 * ImportRun - tracks execution of an import job
 */
export interface ImportRun {
  id: string;
  profileId: string; // Reference to ImportProfile
  vendorId: string; // Reference to Vendor
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  dryRun: boolean; // If true, no actual writes were made
  stats: {
    fetched: number; // Items fetched from API
    created: number; // New items created
    updated: number; // Existing items updated
    skipped: number; // Items skipped (duplicates, filters, etc)
    errors: number; // Items that failed to process
    duplicates?: number; // Detected duplicates
    autoApproved?: number; // Items auto-approved based on config
    aiEnriched?: number; // Items enriched with AI
  };
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorSummary?: ImportError[];
  logsRef?: string; // Reference to detailed logs (e.g., Storage path or import_logs collection)
  triggeredBy: 'scheduled' | 'manual' | 'cron';
  triggeredByUid?: string; // If manual
  config?: {
    maxItems?: number;
    autoApprove?: boolean;
    enableAI?: boolean;
    dryRun?: boolean;
  };
  // Progress tracking for long-running imports
  progress?: {
    current: number;
    total: number;
    phase: 'fetching' | 'processing' | 'enriching' | 'completing';
  };
}

/**
 * ImportError - categorized error type for import failures
 */
export interface ImportError {
  code: 'NETWORK' | 'RATE_LIMIT' | 'MAPPING' | 'VALIDATION' | 'DEDUPLICATION' | 'AI_ENRICHMENT' | 'UNKNOWN';
  message: string;
  itemId?: string; // Original item ID from vendor
  timestamp: string;
  details?: any; // Additional error context
  retryable?: boolean; // Whether this error can be retried
}

/**
 * ImportItemLog - detailed log entry for individual imported items
 * Stored in import_logs subcollection under each ImportRun
 */
export interface ImportItemLog {
  id: string;
  importRunId: string; // Parent ImportRun
  originalId: string; // ID from source vendor
  action: 'created' | 'updated' | 'skipped' | 'error';
  itemType: 'product' | 'deal';
  itemId?: string; // Our internal ID (if created/updated)
  reason?: string; // Reason for skip/error
  error?: ImportError;
  timestamp: string;
  metadata?: {
    title?: string;
    price?: number;
    category?: string;
    aiEnriched?: boolean;
    autoApproved?: boolean;
    duplicateOf?: string; // ID of duplicate item if detected
  };
}

/**
 * AuditLog - tracks administrative actions (stub for M1)
 */
export interface AuditLog {
  id: string;
  action: string; // e.g., "import_run_started", "profile_created"
  userId: string;
  userEmail?: string;
  resourceType: string; // e.g., "import_profile", "import_run"
  resourceId: string;
  changes?: Record<string, any>; // Before/after snapshots
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * MetricsEvent - tracks metrics for analytics (stub for M1)
 */
export interface MetricsEvent {
  id: string;
  eventType: string; // e.g., "import_completed", "api_call"
  category: string; // e.g., "import", "api"
  value?: number; // Numeric value for aggregation
  metadata?: Record<string, any>;
  timestamp: string;
}

// ============================================
// M2: OAuth & Token Management
// ============================================

/**
 * OAuthToken - Stores OAuth tokens for vendor API access
 */
export interface OAuthToken {
  id: string;
  vendorId: string; // Reference to Vendor
  accountName?: string; // Human-readable name for multi-account support
  accessToken: string;
  refreshToken?: string;
  tokenType: string; // e.g., "Bearer"
  expiresAt: string; // ISO timestamp when token expires
  obtainedAt: string; // ISO timestamp when token was obtained
  scope?: string[]; // OAuth scopes granted
  status: 'active' | 'expired' | 'revoked';
  lastUsedAt?: string;
  lastRefreshedAt?: string;
  createdBy: string; // UID of admin who authorized
  createdAt: string;
  updatedAt?: string;
  metadata?: {
    authorizationCode?: string; // For debugging
    userAgent?: string;
    ipAddress?: string;
  };
}

/**
 * OAuthConfig - Configuration for OAuth flow
 */
export interface OAuthConfig {
  id: string;
  vendorId: string;
  clientId: string;
  clientSecret: string; // Should be encrypted/stored in Secret Manager
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  authType?: 'oauth' | 'signature' | 'aop-oauth' | string;
  signMethod?: 'sha256' | 'md5' | string;
  systemPath?: string;
}

// ============================================
// M2: Deduplication Engine
// ============================================

/**
 * ProductEmbedding - Stores embeddings for similarity comparison
 */
export interface ProductEmbedding {
  id: string; // Same as product ID
  productId: string;
  titleEmbedding: number[]; // Vector embedding of normalized title
  descriptionEmbedding?: number[]; // Vector embedding of description
  imageEmbedding?: number[]; // Vector embedding of primary image (future)
  combinedEmbedding: number[]; // Weighted combination for quick comparison
  embeddingVersion: string; // Model version used (e.g., "gemini-2.5-flash-v1")
  generatedAt: string;
  updatedAt?: string;
}

/**
 * DuplicateGroup - Groups of similar/duplicate products
 */
export interface DuplicateGroup {
  id: string;
  canonicalProductId: string;
  alternativeProductIds: string[];
  similarityScores: Record<string, number>;
  status: 'pending_review' | 'merged' | 'rejected';
  detectedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  mergeStrategy?: 'keep_canonical' | 'merge_attributes' | 'keep_both';
  notes?: string;
  aiSuggestion?: {
    recommendedCanonical: string;
    confidence: number;
    reasoning: string;
  };
}

/**
 * MergeLog - Audit trail for product merges
 */
export interface MergeLog {
  id: string;
  duplicateGroupId: string;
  canonicalProductId: string;
  mergedProductIds: string[];
  mergeStrategy: 'keep_canonical' | 'merge_attributes' | 'keep_both';
  preservedFields: Record<string, any>;
  changes: Array<{
    field: string;
    before: any;
    after: any;
    source: string;
  }>;
  mergedBy: string;
  mergedAt: string;
  snapshot: {
    canonical: Product;
    merged: Product[];
  };
}

// ============================================
// M2: Advanced Moderation Workflow
// ============================================

/**
 * ModerationQueue - Items awaiting moderation
 */
export interface ModerationQueueItem {
  id: string;
  itemId: string;
  itemType: 'product' | 'deal';
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  submittedAt: string;
  submittedBy?: string; // UID of submitter (for manual submissions)
  source: 'import' | 'manual' | 'ai_flagged';
  assignedTo?: string; // UID of moderator
  assignedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  aiScore?: ModerationAIScore;
  flags: string[]; // e.g., ["offensive_content", "spam", "duplicate"]
  notes?: ModerationNote[];
  tags?: string[]; // Custom tags for filtering
  changes?: {
    // Track changes made during moderation
    field: string;
    before: any;
    after: any;
    timestamp: string;
  }[];
}

/**
 * ModerationAIScore - AI-powered content scoring
 */
export interface ModerationAIScore {
  overallScore: number; // 0-100
  contentQuality: number;
  priceQuality: number;
  trustworthiness: number;
  suspicionFlags: string[]; // e.g., ["suspiciously_high_discount", "poor_description"]
  recommendation: 'approve' | 'review' | 'reject';
  confidence: number; // 0-1
  reasoning: string;
  generatedAt: string;
  modelVersion: string;
}

/**
 * ModerationNote - Notes added by moderators
 */
export interface ModerationNote {
  id: string;
  userId: string;
  userDisplayName?: string;
  content: string;
  createdAt: string;
  visibility: 'internal' | 'public'; // Internal notes only visible to mods
}

/**
 * ModerationStats - Statistics for moderation performance
 */
export interface ModerationStats {
  userId: string;
  period: 'day' | 'week' | 'month' | 'all_time';
  startDate: string;
  endDate: string;
  totalReviewed: number;
  totalApproved: number;
  totalRejected: number;
  averageReviewTimeMs: number;
  productivityScore: number; // Items reviewed per hour
  accuracyScore?: number; // Based on appeals/overturns
  generatedAt: string;
}

// ============================================
// M2: Enhanced Import Profile with Cache
// ============================================

/**
 * CacheConfig - HTTP cache configuration for imports
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time-to-live in seconds
  useETag: boolean; // Use ETag headers for conditional requests
  useCacheControl: boolean; // Respect Cache-Control headers
  lastETag?: string;
  lastModified?: string;
  cacheHitRate?: number; // Percentage of requests served from cache
}

/**
 * RateLimitConfig - Rate limiting per vendor
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit?: number; // Max burst requests allowed
  adaptiveWindow?: boolean; // Adjust based on API response times
}

/**
 * ImportScheduleConfig - Advanced scheduling configuration
 */
export interface ImportScheduleConfig {
  cronExpression: string;
  timezone: string; // e.g., "Europe/Warsaw"
  enabled: boolean;
  windowStart?: string; // e.g., "02:00" - only run during this window
  windowEnd?: string; // e.g., "06:00"
  maxDurationMinutes?: number; // Kill import if exceeds duration
  retryOnFailure: boolean;
  retryDelayMinutes?: number;
  maxRetries?: number;
}

// ============================================
// M2: Typesense Indexing
// ============================================

/**
 * IndexingJob - Tracks batch indexing operations
 */
export interface IndexingJob {
  id: string;
  collection: 'products' | 'deals';
  operation: 'create' | 'update' | 'delete' | 'reindex';
  itemIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  batchSize: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errors?: {
    itemId: string;
    error: string;
  }[];
  triggeredBy: 'manual' | 'import' | 'moderation' | 'scheduled';
  triggeredByUid?: string;
}

/**
 * SearchFacet - Faceting configuration for search
 */
export interface SearchFacet {
  field: string; // e.g., "mainCategorySlug", "priceRange", "rating"
  label: string; // Display name
  type: 'category' | 'range' | 'boolean' | 'multi_select';
  enabled: boolean;
  sortOrder: number;
  ranges?: { // For range facets (price, rating)
    label: string;
    min: number;
    max: number;
  }[];
  values?: string[]; // For category/multi-select facets
}

// ============================================
// M2: Enhanced Audit Log
// ============================================

/**
 * ProductSnapshot - Historical snapshot of product state
 */
export interface ProductSnapshot {
  id: string;
  productId: string;
  snapshot: Partial<Product>;
  version: number; // Incremental version number
  createdAt: string;
  createdBy: string; // UID of user who made the change
  changeType: 'created' | 'updated' | 'approved' | 'rejected' | 'merged' | 'deleted';
  changeSummary: string;
  parentVersion?: number; // Previous version number
}

/**
 * DealSnapshot - Historical snapshot of deal state
 */
export interface DealSnapshot {
  id: string;
  dealId: string;
  snapshot: Partial<Deal>;
  version: number;
  createdAt: string;
  createdBy: string;
  changeType: 'created' | 'updated' | 'approved' | 'rejected' | 'expired' | 'deleted';
  changeSummary: string;
  parentVersion?: number;
}

/**
 * Enhanced AuditLog with detailed change tracking
 */
export interface DetailedAuditLog extends AuditLog {
  snapshotId?: string; // Reference to snapshot
  ipAddress?: string;
  userAgent?: string;
  duration?: number; // Duration of operation in ms
  stackTrace?: string; // For error tracking
}

// ============================================
// M3: Price Monitoring & Alerts
// ============================================

/**
 * PriceSnapshot - Historical price point for a product or deal
 */
export interface PriceSnapshot {
  id: string;
  itemId: string; // Product or Deal ID
  itemType: 'product' | 'deal';
  price: number;
  originalPrice?: number;
  currency: string; // e.g., "PLN"
  discountPercent?: number;
  source: string; // e.g., "aliexpress", "manual", "scraper"
  availability: 'in_stock' | 'out_of_stock' | 'low_stock' | 'unknown';
  timestamp: string; // ISO timestamp when price was recorded
  metadata?: {
    shippingCost?: number;
    couponCode?: string;
    couponDiscount?: number;
    stockLevel?: number;
    url?: string;
  };
}

/**
 * PriceHistory - Aggregated price history for an item
 */
export interface PriceHistory {
  id: string; // Same as itemId
  itemId: string;
  itemType: 'product' | 'deal';
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceDropCount: number; // Number of times price decreased
  lastUpdated: string;
  snapshots: PriceSnapshot[]; // Recent snapshots (last 30 days)
  chartData?: {
    date: string;
    price: number;
    originalPrice?: number;
  }[];
}

/**
 * PriceAlert - User subscription for price notifications
 */
export interface PriceAlert {
  id: string;
  userId: string;
  itemId: string;
  itemType: 'product' | 'deal';
  alertType: 'price_drop' | 'target_price' | 'back_in_stock' | 'coupon_expiry';
  targetPrice?: number; // For target_price alerts
  dropPercentage?: number; // For price_drop alerts (e.g., 10 for 10% drop)
  status: 'active' | 'triggered' | 'expired' | 'cancelled';
  createdAt: string;
  triggeredAt?: string;
  expiresAt?: string;
  notificationSent: boolean;
  metadata?: {
    itemName?: string;
    itemImage?: string;
    currentPrice?: number;
  };
}

/**
 * PriceChangeNotification - Notification for price changes
 */
export interface PriceChangeNotification {
  id: string;
  alertId: string;
  userId: string;
  itemId: string;
  itemType: 'product' | 'deal';
  changeType: 'price_drop' | 'target_reached' | 'back_in_stock';
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  message: string;
  link: string;
  sentAt: string;
  read: boolean;
}

// ============================================
// M3: AI Review Summaries & Topic Modeling
// ============================================

/**
 * ReviewSummary - AI-generated summary of product reviews
 */
export interface ReviewSummary {
  id: string; // Same as productId
  productId: string;
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number; // -1 to 1 (negative to positive)
  reviewCount: number; // Number of reviews analyzed
  pros: string[]; // Top positive points (max 5)
  cons: string[]; // Top negative points (max 5)
  topicTags: TopicTag[]; // Extracted topics
  summary: string; // 2-3 sentence summary
  confidence: number; // 0-1 confidence score
  generatedAt: string;
  modelVersion: string;
  language: string; // e.g., "pl", "en"
}

/**
 * TopicTag - Extracted topic from reviews
 */
export interface TopicTag {
  topic: string; // e.g., "battery_life", "build_quality", "customer_service"
  label: string; // Human-readable label (Polish)
  sentiment: 'positive' | 'neutral' | 'negative';
  frequency: number; // How many reviews mention this (0-1)
  keywords: string[]; // Related keywords
}

/**
 * SentimentAnalysis - Detailed sentiment breakdown
 */
export interface SentimentAnalysis {
  id: string;
  productId: string;
  overall: number; // -1 to 1
  aspects: {
    quality: number;
    value: number;
    shipping: number;
    customerService: number;
    accuracy: number; // Description vs reality
  };
  distribution: {
    positive: number; // Percentage (0-100)
    neutral: number;
    negative: number;
  };
  trendOverTime?: {
    month: string;
    sentiment: number;
  }[];
  generatedAt: string;
}

/**
 * ReviewAnalysisJob - Tracks AI review analysis jobs
 */
export interface ReviewAnalysisJob {
  id: string;
  productId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reviewCount: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  triggeredBy: 'manual' | 'scheduled' | 'threshold'; // threshold = new reviews reached
}

// ============================================
// M3: Community Gamification & Reputation
// ============================================

/**
 * UserPoints - Point balance and history for a user
 */
export interface UserPoints {
  userId: string;
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number;
  lifetimePoints: number; // Total ever earned (doesn't decrease)
  rank?: number; // Global rank
  lastUpdated: string;
  breakdown: {
    dealSubmissions: number;
    productReviews: number;
    comments: number;
    votes: number;
    reports: number;
    moderationActions: number;
  };
}

/**
 * PointTransaction - Individual point earning/spending event
 */
export interface PointTransaction {
  id: string;
  userId: string;
  amount: number; // Can be negative for penalties
  type: 'earn' | 'spend' | 'bonus' | 'penalty';
  action: string; // e.g., "deal_submitted", "review_written", "spam_reported"
  reason: string; // Human-readable description
  relatedItemId?: string;
  relatedItemType?: 'deal' | 'product' | 'comment' | 'review';
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Badge - Achievement badge definition
 */
export interface Badge {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string; // Emoji or icon identifier
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  category: 'contribution' | 'engagement' | 'quality' | 'milestone' | 'special';
  criteria: {
    type: string; // e.g., "deal_count", "review_quality", "consecutive_days"
    threshold: number;
    timeframe?: string; // e.g., "30d", "all_time"
  };
  points: number; // Points awarded when earned
  color?: string;
  sortOrder?: number;
}

/**
 * UserBadge - Badge earned by a user
 */
export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  progress?: number; // For progressive badges (0-100)
  level?: number; // For multi-level badges
  displayOnProfile: boolean;
}

/**
 * ReputationLevel - Defines reputation tiers
 */
export interface ReputationLevel {
  level: number;
  name: string;
  minPoints: number;
  maxPoints?: number;
  icon: string;
  color: string;
  perks: string[]; // Benefits of this level
}

/**
 * Leaderboard - Tracks top contributors
 */
export interface Leaderboard {
  id: string;
  type: 'weekly' | 'monthly' | 'all_time' | 'category';
  category?: string; // For category-specific leaderboards
  entries: LeaderboardEntry[];
  periodStart: string;
  periodEnd?: string;
  lastUpdated: string;
}

/**
 * LeaderboardEntry - Individual leaderboard position
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  photoURL?: string;
  points: number;
  contributionCount: number;
  badges?: string[]; // Badge IDs to display
  change?: number; // Position change from previous period
}

/**
 * UserActivity - User activity history
 */
export interface UserActivity {
  id: string;
  userId: string;
  activityType: 'deal_submitted' | 'product_reviewed' | 'comment_posted' | 
                'vote_cast' | 'report_submitted' | 'badge_earned' | 'level_up';
  description: string;
  points?: number; // Points earned for this activity
  relatedItemId?: string;
  relatedItemType?: 'deal' | 'product' | 'comment' | 'review' | 'badge';
  timestamp: string;
  visibility: 'public' | 'private'; // Some activities may be private
  metadata?: Record<string, any>;
}

/**
 * Report - User report for issues, duplicates, spam, etc.
 */
export interface Report {
  id: string;
  reportedBy: string;
  itemId: string;
  itemType: 'deal' | 'product' | 'comment' | 'review' | 'user';
  reportType: 'spam' | 'duplicate' | 'incorrect_info' | 'offensive' | 'expired' | 'other';
  description: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolution?: string;
  pointsAwarded?: number; // If report was helpful
}

// ============================================
// M3: Personalization
// ============================================

/**
 * UserPreferences - User's personalization preferences
 */
export interface UserPreferences {
  userId: string;
  favoriteCategories: string[]; // Category slugs
  subscribedTopics: string[]; // Topic tags
  priceRange?: {
    min?: number;
    max?: number;
  };
  preferredMerchants?: string[];
  excludedMerchants?: string[];
  notificationSettings: {
    priceAlerts: boolean;
    newDealsInCategories: boolean;
    reviewResponses: boolean;
    badgesAndAchievements: boolean;
    weeklyDigest: boolean;
  };
  feedPreferences: {
    showPersonalized: boolean;
    includeFollowedUsers: boolean;
    sortBy: 'trending' | 'newest' | 'price' | 'discount';
  };
  updatedAt: string;
}

/**
 * UserInteraction - Tracks user interactions for recommendations
 */
export interface UserInteraction {
  id: string;
  userId: string;
  itemId: string;
  itemType: 'deal' | 'product';
  interactionType: 'view' | 'click' | 'favorite' | 'vote' | 'comment' | 'share';
  timestamp: string;
  duration?: number; // Time spent (for views)
  metadata?: {
    source?: string; // Where they found it (search, feed, category)
    position?: number; // Position in list when clicked
    categorySlug?: string;
  };
}

/**
 * UserEmbedding - Vector embedding of user preferences/behavior
 */
export interface UserEmbedding {
  userId: string;
  embedding: number[]; // Vector representation
  embeddingVersion: string;
  basedOnInteractions: number; // Number of interactions used
  generatedAt: string;
  updatedAt: string;
}

/**
 * FeedRecommendation - Personalized recommendation for user feed
 */
export interface FeedRecommendation {
  id: string;
  userId: string;
  itemId: string;
  itemType: 'deal' | 'product';
  score: number; // Relevance score (0-1)
  reason: string; // Why this was recommended
  algorithm: 'embedding' | 'collaborative' | 'content' | 'trending' | 'hybrid';
  generatedAt: string;
  expiresAt: string;
  shown: boolean;
  clicked: boolean;
  metadata?: {
    similarItems?: string[];
    matchingCategories?: string[];
    confidence?: number;
  };
}

/**
 * ABTestVariant - A/B test configuration
 */
export interface ABTestVariant {
  id: string;
  testName: string;
  variantName: string;
  description: string;
  isControl: boolean;
  trafficPercentage: number; // 0-100
  config: Record<string, any>; // Variant-specific configuration
  enabled: boolean;
  startDate: string;
  endDate?: string;
}

/**
 * ABTestAssignment - User assignment to A/B test variant
 */
export interface ABTestAssignment {
  userId: string;
  testName: string;
  variantId: string;
  assignedAt: string;
  sticky: boolean; // Keep user in same variant
}

// ============================================
// M3: Multi-Marketplace Integration
// ============================================

/**
 * Marketplace - Definition of a marketplace/source
 */
export interface Marketplace {
  id: string;
  name: string;
  slug: string; // e.g., "aliexpress", "amazon", "allegro"
  country: string; // e.g., "CN", "US", "PL"
  currency: string;
  enabled: boolean;
  logo?: string;
  color?: string;
  config: {
    apiEndpoint?: string;
    rateLimitPerMinute?: number;
    supportsReviews: boolean;
    supportsPriceHistory: boolean;
    supportsTracking: boolean;
  };
  stats?: {
    totalProducts: number;
    totalDeals: number;
    averageRating?: number;
  };
  createdAt: string;
  updatedAt?: string;
}

/**
 * CategoryMapping - Maps platform categories to marketplace categories
 */
export interface CategoryMapping {
  id: string;
  platformCategory: {
    mainSlug: string;
    subSlug?: string;
    subSubSlug?: string;
  };
  marketplaceId: string;
  marketplaceCategory: {
    id: string;
    name: string;
    path?: string[]; // Category hierarchy
  };
  confidence: number; // 0-1 mapping quality
  verified: boolean; // Manually verified by admin
  createdAt: string;
  updatedAt?: string;
}

/**
 * PriceComparison - Aggregated price comparison across marketplaces
 */
export interface PriceComparison {
  id: string; // Canonical product ID
  productName: string;
  canonicalImage: string;
  prices: MarketplacePrice[];
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceSpread: number; // Difference between highest and lowest
  lastUpdated: string;
}

/**
 * MarketplacePrice - Price from a specific marketplace
 */
export interface MarketplacePrice {
  marketplaceId: string;
  marketplaceName: string;
  productId: string; // ID on that marketplace
  price: number;
  currency: string;
  originalPrice?: number;
  inStock: boolean;
  shippingCost?: number;
  estimatedDelivery?: string;
  rating?: number;
  reviewCount?: number;
  url: string;
  lastChecked: string;
}

/**
 * MultiSourceProduct - Product aggregated from multiple marketplaces
 */
export interface MultiSourceProduct {
  id: string;
  canonicalName: string;
  canonicalImage: string;
  category: {
    mainSlug: string;
    subSlug: string;
    subSubSlug?: string;
  };
  sources: ProductSource[];
  aggregatedRating: {
    average: number;
    count: number;
    breakdown: Record<string, number>; // marketplace -> rating
  };
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  bestOffer?: {
    marketplaceId: string;
    price: number;
    url: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * ProductSource - Individual product from a marketplace
 */
export interface ProductSource {
  marketplaceId: string;
  productId: string; // ID on that marketplace
  name: string;
  url: string;
  price: number;
  inStock: boolean;
  rating?: number;
  reviewCount?: number;
  lastSynced: string;
}

/**
 * ReviewAggregation - Aggregated reviews from multiple sources
 */
export interface ReviewAggregation {
  id: string; // Canonical product ID
  productId: string;
  totalReviews: number;
  averageRating: number;
  sources: ReviewSource[];
  combinedSummary?: ReviewSummary; // AI summary across all sources
  lastAggregated: string;
}

/**
 * ReviewSource - Reviews from a specific marketplace
 */
export interface ReviewSource {
  marketplaceId: string;
  reviewCount: number;
  averageRating: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  lastFetched: string;
  reviews?: {
    text: string;
    rating: number;
    date: string;
    verified: boolean;
  }[];
}

// ============================================
// Secret Promotional Pages
// ============================================

/**
 * WheelPrize - Prize configuration for the fortune wheel
 */
export interface WheelPrize {
  id: string;
  label: string;
  description?: string;
  probability: number; // 0-100 percentage chance
  color?: string; // Hex color for the wheel segment
  icon?: string; // Emoji or icon
  isSpecial?: boolean; // Highlighted prize
  link?: string; // Optional redirect after winning
}

/**
 * SecretPage - Secret promotional page with fortune wheel
 */
export interface SecretPage {
  id: string;
  slug: string; // e.g., "super-okazja-tomek"
  title: string;
  description?: string;
  heroImage?: string;
  heroText?: string;
  isActive: boolean;
  wheelEnabled: boolean;
  wheelTitle?: string;
  wheelPrizes: WheelPrize[];
  content?: string; // Additional HTML/markdown content
  backgroundColor?: string;
  textColor?: string;
  spinLimit?: number; // Max spins per user (null = unlimited)
  requiresAuth?: boolean; // Must be logged in to spin
  expiresAt?: string; // Optional expiration date
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  stats?: {
    totalViews: number;
    totalSpins: number;
    uniqueVisitors: number;
  };
}

/**
 * SecretPageSpin - Record of user spin
 */
export interface SecretPageSpin {
  id: string;
  pageId: string;
  userId?: string; // Optional if not requiring auth
  sessionId?: string; // For anonymous users
  prizeId: string;
  prizeLabel: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * PreRegistration - Beta/Pioneer pre-registration
 */
export interface PreRegistration {
  id: string;
  email: string;
  name: string;
  role: 'beta' | 'pioneer'; // beta = beta release, pioneer = early access
  status: 'pending' | 'confirmed' | 'invited';
  registrationNumber: number; // Unique sequential number (1-5000)
  createdAt: string;
  confirmedAt?: string;
  invitedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  referralSource?: string;
}

// ====== SOCIAL MEDIA AUTOMATION ======
export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok';

export interface SocialConfig {
  id: string; // document ID = platform name
  platform: SocialPlatform;
  enabled: boolean;
  credentials: {
    accessToken?: string;
    pageId?: string; // Facebook/Instagram Page ID
    organizationId?: string; // LinkedIn Organization ID
    accountId?: string; // Twitter/TikTok account ID
    refreshToken?: string;
    expiresAt?: string;
  };
  settings: {
    autoPost: boolean; // Auto-publish or require manual approval
    postFrequency: number; // Minutes between posts (min 5)
    maxPostsPerDay: number;
    postTypes: ('deal' | 'product')[]; // What to post
    minTemperature?: number; // Min temperature/rating to auto-post
    includeImage: boolean;
    includePrice: boolean;
    addHashtags: boolean;
    customHashtags?: string[];
    utmParams: {
      source: string;
      medium: string;
      campaign: string;
    };
  };
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastPostAt?: string;
    lastError?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SocialTemplate {
  id?: string;
  platform: SocialPlatform;
  type: 'deal' | 'product' | 'article';
  name: string;
  template?: string; // Deprecated - use contentTemplate
  contentTemplate?: string; // Template with placeholders: {title}, {price}, {url}, {merchant}, {temperature}
  hashtagsTemplate?: string; // Hashtag template (optional)
  imageStyle?: 'clean' | 'minimal' | 'bold' | 'gradient'; // Image overlay style
  enabled?: boolean;
  maxLength?: number; // Platform character limit
  createdAt?: string;
  updatedAt?: string;
}

export type SocialPostStatus = 'pending' | 'approved' | 'posting' | 'posted' | 'failed' | 'cancelled';

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  status: SocialPostStatus;
  type: 'deal' | 'product';
  itemId: string; // Deal or Product ID
  itemData: {
    title: string;
    description?: string;
    price?: number;
    image?: string;
    url: string;
    merchant?: string;
    temperature?: number;
    category?: string;
  };
  content: {
    text: string; // Generated post text
    imageUrl?: string;
    linkUrl: string; // Short URL with UTM params
    hashtags?: string[];
  };
  scheduledFor?: string; // When to post (null = ASAP)
  postedAt?: string;
  platformPostId?: string; // ID from platform API
  platformUrl?: string; // Public URL of the post
  attempts: number;
  lastAttemptAt?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    templateId?: string;
    manuallyApproved?: boolean;
    approvedBy?: string;
    approvedAt?: string;
    createdBy?: string; // 'auto' or userId
  };
  createdAt: string;
  updatedAt: string;
}

export interface SocialPostLog {
  id: string;
  postId: string;
  platform: SocialPlatform;
  action: 'created' | 'approved' | 'posted' | 'failed' | 'cancelled' | 'retried';
  status: SocialPostStatus;
  message: string;
  error?: any;
  userId?: string;
  timestamp: string;
}

// ============================================
// M6: PRODUCT-CENTRIC ARCHITECTURE (NEW)
// Separation of immutable Products from mutable Deals/Offers
// ============================================

/**
 * ProductCore - The immutable product entity
 * Represents a unique product identified by normalized specs
 * Maps to multiple Deals (offers) from different sources
 */
export interface ProductCore {
  id: string;
  
  // Identity & Uniqueness
  identityHash: string; // SHA-256 of normalized title + primary image hash
  // Prevents duplicate products from different sources
  
  // Product Information
  title: LocalizedText; // Multi-language title
  shortDescription: LocalizedText; // Concise 1-2 sentence description
  fullDescription: LocalizedText; // Detailed description (optional, generated)
  /**
   * Optional unified description field (HTML), per locale
   * Aligns with master data schema (description: Localized<HTML>)
   */
  description?: LocalizedText;
  
  // Specifications (Standardized Key-Value)
  specs: Record<string, string>; // e.g., {"RAM": "16GB", "Storage": "512GB SSD", "Screen": "15.6\" OLED"}
  /**
   * Optional localized specs map to support multi-language spec labels
   */
  specsLocalized?: {
    [locale: string]: Record<string, string>;
  };
  
  // Taxonomy
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug?: string;
  
  // Media
  imageUrl?: string; // Primary image URL (convenience field)
  images: string[]; // Gallery URLs (high-res)
  primaryImageHash?: string; // Hash of primary image for identity matching
  /**
   * Optional product video URL (e.g., AliExpress product_video_url)
   */
  videoUrl?: string;
  
  // Ratings & Reviews
  reviewsSummary: LocalizedText; // AI-generated pros/cons summary (e.g., "Users praise durability and performance...")
  rating: {
    score: number; // 0-5
    count: number; // Number of reviews/ratings
    provider: 'mixed' | 'aliexpress' | 'amazon' | 'allegro' | 'users' | 'editorial';
  };
  ratingCard?: ProductRatingCard;
  ratingSources?: ProductRatingSources;
  /**
   * Optional structured features, pros, cons (per locale)
   */
  features?: {
    [locale: string]: string[];
  };
  pros?: {
    [locale: string]: string[];
  };
  cons?: {
    [locale: string]: string[];
  };
  
  // Best Price (Calculated Field - Updated when deals change)
  bestPrice: {
    amount: number;
    currency: 'PLN' | 'USD' | 'EUR'; // M6: PLN for Polish market, USD/EUR for international
  };
  /**
   * ID najlepszej (najtańszej) oferty powiązanej z tym produktem
   * Ustawiane przez harvester/refiner po zmianach w ofertach
   */
  bestDealId?: string;
  /**
   * Typ najlepszej oferty (np. kupon)
   */
  bestDealType?: 'sale' | 'coupon' | 'freebie' | 'pricing-error' | 'cashback' | 'bundle' | string;
  /**
   * Czy produkt ma dostępne kupony/oferty promocyjne
   */
  hasCoupons?: boolean;
  /**
   * Liczba ofert kuponowych
   */
  couponDealsCount?: number;
  /**
   * Kod kuponu z najlepszej oferty (jeśli dostępny)
   */
  bestDealCouponCode?: string;
  /**
   * Najniższa łączna cena (produkt + dostawa) w PLN dla najlepszej oferty
   * Ułatwia szybkie wyświetlenie ceny bez dodatkowych zapytań
   */
  bestTotalPrice?: number;
  
  // Linked Offers
  linkedDealIds: string[]; // Foreign keys to Deal documents
  
  // SEO & Search
  searchTags: string[]; // For Typesense/full-text search
  seoTitle?: string; // Single-locale SEO title (legacy)
  seoDescription?: string; // Single-locale SEO description (legacy)
  /**
   * Optional localized SEO fields and slug
   */
  seoTitleLocalized?: {
    [locale: string]: string;
  };
  seoDescriptionLocalized?: {
    [locale: string]: string;
  };
  slug?: {
    [locale: string]: string;
  };
  
  // Status & Moderation
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  
  // Metadata
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // UID of creator
  approvedBy?: string; // UID of approver
  /**
   * Optional metadata for system integration (e.g., source IDs, enrichment data)
   */
  metadata?: {
    source?: 'aliexpress' | 'amazon' | 'allegro' | string;
    originalId?: string; // Original product ID from source
    importedAt?: string; // When it was first imported
    aliexpressCategoryIds?: string[]; // AliExpress category IDs for hot-products queries
    [key: string]: any; // Allow additional fields for flexibility
  };
  
  // Quality Metrics
  aiQualityScore?: number; // 0-100
  /**
   * Semantic embeddings vector for AI search (e.g., 768 dims)
   */
  embeddings?: number[];
  /**
   * AI rating of product quality (0-100), aligns with master schema
   */
  aiRating?: number;
  confidence?: number; // 0-1 confidence in specs/data quality
  warnings?: string[]; // e.g., ["missing_specs", "low_rating_count"]
  
  // ============================================================================
  // DEEP DATA EXTENSIONS (M6 Phase 2)
  // Additional structured data for rich product presentation
  // ============================================================================
  
  /**
   * Structured specifications with categories and types
   * Extends basic specs map with richer metadata
   */
  specificationsStructured?: Array<{
    label: string;
    value: string;
    category?: 'Appearance' | 'Physical' | 'Material' | 'Technical';
    unit?: string; // e.g., 'GB', 'inches', 'kg'
    order?: number;
  }>;
  
  /**
   * Gallery items with type indicators (for video support)
   * Alternative to separate images + videoUrl fields
   */
  gallery?: Array<{
    url: string;
    type: 'IMAGE' | 'VIDEO';
    thumbnail?: string; // For videos
    alt?: string;
    order?: number;
  }>;
  
  /**
   * Logistics information from best deal
   * Aggregated from linkedDeals for quick display
   */
  logistics?: {
    deliveryDays: number; // Typical delivery time
    deliveryDaysMax?: number; // Maximum delivery time
    isFreeShipping: boolean;
    shippingCost: number; // In PLN (converted from source)
    shippingCostUSD?: number; // Original USD amount
  };
  
  /**
   * Seller information from primary/best deal
   * Aggregated from linkedDeals for quick display
   */
  seller?: {
    name: string;
    rating: number; // 0-5
    followers?: number;
    storeUrl?: string;
    storeId?: string;
    positiveRate?: string; // M6+: "98.5%" format for trust badge
  };
  
  /**
   * M6+: Simple key-value attributes from product_props
   * Alternative format to specifications (flatter, better for display)
   */
  attributes?: Array<{ name: string; value: string }>;
  
  /**
   * M6+: Available warehouse locations (e.g., ['PL', 'CZ', 'CN'])
   * Extracted from ships_from_countries for logistics display
   * Enables "Fast Shipping from Poland" badge
   */
  warehouses?: string[];

  /**
   * M6+: Estimated Average Market Price
   * AI-generated estimation of what this product typically costs on other major platforms
   * Used to show "X% cheaper than market average"
   */
  averageMarketPrice?: {
    amount: number;
    currency: string;
    range?: { min: number; max: number };
  };
}

/**
 * DealM6 - The mutable offer/listing entity (M6 Product-Centric Architecture)
 * Represents a specific price point from a specific seller
 * Always links to exactly one ProductCore
 * Use this interface for new M6 code. Legacy code uses DealLegacy/Deal.
 */
export interface DealM6 {
  id: string;
  
  // Foreign Key
  productId: string; // References ProductCore.id (required)
  /** Alias for master schema compatibility */
  productCoreId?: string;
  
  // Pricing (Omnibus Directive Compliance)
  price: {
    amount: number;
    currency: string; // USD, PLN, EUR, etc.
  };
  lowestPriceIn30Days?: number; // Omnibus Directive: lowest price last 30 days
  originalPrice?: number; // Price before discount (for compliance)
  discount?: {
    amount?: number;
    percentage?: number;
  };
  /** Optional discount percent shortcut (master schema "discount: Int") */
  discountPercent?: number;
  
  // Shipping
  shipping: {
    cost: number; // In same currency as price
    timeDays: number; // Estimated delivery in days
    method?: string; // e.g., "Standard", "Express"
    fromCountry?: string;
  };
  
  // Source & Affiliate
  source: 'aliexpress' | 'amazon' | 'allegro' | 'ebay' | 'convertiser' | 'manual';
  affiliateLink: string; // Generated with tracking code
  /** Master schema names */
  affiliateUrl?: string;
  dealUrl?: string;
  merchantName?: string;
  merchantRating?: number; // 0-5
  
  // Deal Properties
  title: LocalizedText; // Offer-specific title (may differ from product)
  description?: LocalizedText; // Offer-specific description (AI-generated for deals, may include HTML)
  dealType?: 'sale' | 'coupon' | 'flash_deal' | 'cashback' | 'regular';
  couponCode?: string;
  
  // Availability
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order';
  /** Overall lifecycle status per master schema */
  lifecycleStatus?: 'active' | 'expired' | 'out_of_stock' | 'banned';
  stockLevel?: number;
  
  // Expiry
  expiryDate?: string; // ISO date
  isActive: boolean; // Whether deal is still valid
  
  // Price History (Time-series for Omnibus compliance)
  priceHistory: Array<{
    date: string; // ISO date YYYY-MM-DD
    price: number;
    currency: string;
    lowestPrice?: number; // Lowest price available that day
  }>;
  
  // Engagement
  voteCount: number;
  temperature: number; // Heat algorithm based on votes
  commentsCount: number;
  
  // Moderation
  status: 'draft' | 'approved' | 'rejected';
  
  // Metadata
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // UID of user who posted
  approvedBy?: string; // UID of moderator
  /** Last check timestamp for offer synchronization */
  lastCheck?: string; // ISO timestamp
  /** Structured seller and sales metrics (master schema) */
  seller?: {
    id?: string;
    name?: string;
    url?: string;
    rating?: number;
  };
  salesMetrics?: {
    soldCount?: number;
    reviewCount?: number;
    avgRating?: number;
  };
  
  // AI Enrichment (M6+ Deal Refiner)
  metadata?: {
    // Seller-specific selling points generated by AI
    sellingPoints?: {
      pl: string[];
      en: string[];
      de: string[];
      fr?: string[];
      es?: string[];
      uk?: string[];
    };
    // Deal highlights (key features/advantages)
    highlights?: {
      pl: string[];
      en: string[];
      de: string[];
      fr?: string[];
      es?: string[];
      uk?: string[];
    };
    // Offer summary per language
    offerSummary?: {
      pl: string;
      en: string;
      de: string;
      fr?: string;
      es?: string;
      uk?: string;
    };
    // Other metadata
    [key: string]: any;
  };
  
  // Import/Source Info
  sourceProductId?: string; // ID in source system (e.g., AliExpress product ID)
  sourceUrl: string; // Original product URL
}

/**
 * HarvesterJob - Tracks product harvesting operations
 * Used to monitor import progress and prevent duplicates
 */
export interface HarvesterJob {
  id: string;
  
  // Job Metadata
  status: 'running' | 'completed' | 'failed' | 'paused';
  source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser' | 'manual';
  
  // Input Parameters
  query: string; // Search term or category ID
  maxResults: number;
  
  // Progress Tracking (M6 Enhanced Control)
  currentCategory?: string;
  totalCategories?: number;
  processedCategories?: Array<{
    category: string;
    count: number;
    status: 'ok' | 'error' | 'skipped';
  }>;

  // Results
  productsFound: number;
  productsCreated: number;
  dealsCreated: number;
  dealsLinked: number; // Deals linked to existing products (not true duplicates)
  duplicatesSkipped: number; // True duplicates (same deal already exists)
  errors: Array<{
    productId?: string;
    message: string;
    timestamp: string;
  }>;
  
  // Progress
  startedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  lastUpdatedAt: string; // ISO timestamp
  
  // Logs
  logs: Array<{
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
    details?: any;
  }>;
}

/**
 * RefinerJob - Tracks AI enrichment operations
 * Used to clean specs, generate descriptions, etc.
 */
export interface RefinerJob {
  id: string;
  
  // Job Metadata
  status: 'running' | 'completed' | 'failed' | 'paused';
  
  // Input
  productIds: string[]; // Products to enrich
  refinationType: 'specs_cleanup' | 'description_generation' | 'review_summary' | 'full_enrichment';
  
  // Results
  productsProcessed: number;
  productsSuccessful: number;
  productsFailed: number;
  
  // Progress
  startedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  lastUpdatedAt: string; // ISO timestamp
  
  // Logs
  logs: Array<{
    productId: string;
    status: 'success' | 'failed';
    message: string;
    timestamp: string;
    details?: any;
  }>;
}

/**
 * IdentityMatch - For product deduplication
 * Stores calculated hashes for efficient matching
 */
export interface IdentityMatch {
  id: string;
  
  // Hash Values
  titleHash: string; // Normalized title hash
  primaryImageHash: string; // Primary image hash
  combinedHash: string; // SHA-256(titleHash + imageHash) = Identity
  
  // Product Reference
  productId: string; // Links to ProductCore
  
  // Source Info
  source: string; // Where this hash came from
  sourceProductId?: string; // ID in source system
  
  // Quality
  confidence: number; // 0-1 confidence in match
  
  createdAt: string;
}
