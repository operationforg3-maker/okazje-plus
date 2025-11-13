
// Nowe interfejsy dla zagnieżdżonych kategorii

// Sub-subkategoria (poziom 3)
export interface SubSubcategory {
  name: string;
  slug: string; // unikalny w ramach podkategorii
  id?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  image?: string;
}

// Podkategoria (poziom 2)
export interface Subcategory {
  name: string;
  slug: string; // unikalny w ramach kategorii nadrzędnej
  id?: string; // identyfikator dokumentu, jeśli przechowywany w osobnej kolekcji
  icon?: string;
  description?: string;
  sortOrder?: number;
  image?: string;
  highlight?: boolean;
  subcategories?: SubSubcategory[]; // Sub-subkategorie (opcjonalne)
  // Rozszerzenia konfiguracyjne (opcjonalne)
  bestSellingIds?: string[]; // ręcznie przypięte bestsellery
  topRatedIds?: string[]; // ręcznie przypięte najwyżej oceniane
  // Kafelki promocyjne dla danej (pod)kategorii
  tiles?: CategoryTile[];
  /**
   * Metryki dynamiczne generowane automatycznie (np. CRON/Functions)
   * Mogą być używane jako szybki cache do renderowania showcase.
   */
  dynamicMetrics?: {
    updatedAt?: string | number; // ISO lub epoch ms
    topProductIds?: string[];
    hotDealIds?: string[];
    trendingDealIds?: string[];
  };
}

export interface CategoryPromo {
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  link?: string;
  cta?: string;
  badge?: string;
  color?: string;
}

// Kafelek promocyjny kategorii (konfigurowalny w panelu admina)
export interface CategoryTile {
  id?: string;
  title: string;
  subtitle?: string;
  image?: string;
  link?: string;
  badge?: string;
  color?: string;
  // Typ kafelka, pozwala na automatyczne wypełnianie
  type?: 'custom' | 'top-rated' | 'best-selling' | 'hot-deals' | 'category';
}

export interface Category {
  id: string; // ID dokumentu (slug kategorii głównej)
  name: string;
  slug?: string;
  parentId?: string; // dla drzewa kategorii (null dla poziomu 1)
  level?: number; // 1 | 2 | 3
  path?: string[]; // pełna ścieżka slugów [main, sub, subSub]
  icon?: string;
  description?: string;
  sortOrder?: number;
  accentColor?: string;
  heroImage?: string;
  promo?: CategoryPromo;
  tiles?: CategoryTile[]; // dodatkowe kafelki prezentacyjne
  subcategories: Subcategory[]; // Tablica obiektów podkategorii
  // Rozszerzenia konfiguracyjne na poziomie kategorii
  bestSellingIds?: string[];
  topRatedIds?: string[];
  /**
   * Metryki dynamiczne generowane automatycznie (np. przez funkcję agregującą)
   */
  dynamicMetrics?: {
    updatedAt?: string | number;
    topProductIds?: string[];
    hotDealIds?: string[];
    trendingDealIds?: string[];
  };
  ai?: {
    missingCoverage?: boolean; // kategoria wymaga uzupełnienia
    recommendedExpansionQueries?: string[]; // zapytania wygenerowane przez AI
    lastAuditAt?: string;
  };
}

// Zaktualizowany interfejs Deal
export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  imageHint: string;
  postedBy: string;
  postedAt: string; // Użyjemy ISO string dla spójności
  voteCount: number;
  temperature: number;
  commentsCount: number;
  category: string;
  mainCategorySlug: string; // NOWE pole
  subCategorySlug: string;  // NOWE pole
  subSubCategorySlug?: string; // NOWE pole dla poziomu 3
  merchant?: string;
  shippingCost?: number;
  status?: 'draft' | 'approved' | 'rejected';
  createdBy?: string;
}

// Zaktualizowany interfejs Product
export interface Product {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  image: string;
  imageHint: string;
  affiliateUrl: string;
  ratingCard: ProductRatingCard;
  price: number;
  originalPrice?: number;
  discountPercent?: number; // denormalizacja wyliczona (originalPrice - price)/originalPrice
  mainCategorySlug: string; // NOWE pole
  subCategorySlug: string;  // NOWE pole
  subSubCategorySlug?: string; // NOWE pole dla poziomu 3
  status: 'draft' | 'approved' | 'rejected'; // Status moderacji
  category?: string; // Stara wersja dla kompatybilności
  gallery?: ProductImageEntry[]; // Pełna galeria
  seo?: ProductSeoMeta; // Meta dane generowane przez AI / modyfikowane ręcznie
  ai?: ProductAiMeta; // Dane analityczne AI (duplikaty, propozycje)
  moderation?: ProductModerationState; // Informacje o procesie moderacji
  metadata?: ProductImportMetadata; // Źródło importu i dane oryginalne
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
}

export interface ProductModerationState {
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  reviewerUid?: string;
  rejectionReason?: string;
}

export interface ProductImportMetadata {
  source: 'aliexpress' | 'manual' | 'csv';
  originalId?: string;
  importedAt?: string;
  importedBy?: string;
  orders?: number;
  shipping?: string;
  merchant?: string;
  rawDataStored?: boolean;
}

// Reszta interfejsów pozostaje bez zmian
export interface ProductRatingCard {
  average: number;
  count: number;
  durability: number;
  easeOfUse: number;
  valueForMoney: number;
  versatility: number;
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

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'moderator' | 'specjalista' | 'user';
}

export interface Vote {
  direction: 'up' | 'down';
}

export interface Comment {
  id: string;
  dealId: string;
  userId: string;
  userDisplayName: string;
  content: string;
  createdAt: string; // ISO string
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
  type: 'comment_reply' | 'new_deal' | 'system' | 'deal_approved' | 'deal_rejected';
  title: string;
  message: string;
  link?: string; // Link do odpowiedniego zasobu
  itemId?: string; // ID powiązanego elementu (deal, product, comment)
  itemType?: 'deal' | 'product' | 'comment';
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
// AliExpress Integration Data Models (M1)
// ============================================

/**
 * Vendor - stores metadata about external vendors like AliExpress
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
    // TODO: OAuth credentials will be stored in Secret Manager
  };
  stats?: {
    totalProducts?: number;
    totalDeals?: number;
    lastImportCount?: number;
    failedImportsCount?: number;
  };
  createdAt: string;
  updatedAt?: string;
}

/**
 * ImportProfile - defines rules for importing from a vendor
 */
export interface ImportProfile {
  id: string;
  vendorId: string; // Reference to Vendor
  name: string; // Human-readable name
  enabled: boolean;
  schedule?: string; // Cron expression for scheduled imports
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
  deduplicationStrategy: 'skip' | 'update' | 'create_new';
  maxItemsPerRun?: number; // Limit for safety
  createdAt: string;
  updatedAt?: string;
  createdBy: string; // UID of admin who created
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
  };
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorSummary?: ImportError[];
  logsRef?: string; // Reference to detailed logs (e.g., Storage path)
  triggeredBy: 'scheduled' | 'manual';
  triggeredByUid?: string; // If manual
}

/**
 * ImportError - categorized error type for import failures
 */
export interface ImportError {
  code: 'NETWORK' | 'RATE_LIMIT' | 'MAPPING' | 'VALIDATION' | 'UNKNOWN';
  message: string;
  itemId?: string; // Original item ID from vendor
  timestamp: string;
  details?: any; // Additional error context
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
