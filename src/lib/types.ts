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
  /**
   * Powiązanie z produktami (future-proof: wiele produktów może być powiązanych z jednym dealem — np. różne warianty).
   * Zwykle będzie 0 lub 1 ID.
   */
  linkedProductIds?: string[];
  /**
   * Oryginalny identyfikator zewnętrzny jeśli deal pochodzi z importu marketplace (np. AliExpress product_id / item_id).
   */
  externalOriginalId?: string;
  /** Źródło pochodzenia dealu (manual, aliexpress, csv, other). */
  source?: 'manual' | 'aliexpress' | 'csv' | 'other';
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
  /**
   * Rozdzielone źródła ocen:
   * - editorial: ocena redakcji / administracji (ustawiana ręcznie)
   * - users: agregowana ocena naszych użytkowników (wyliczana z kolekcji ratings/)
   * - external: ocena z zewnętrznego źródła (np. AliExpress) wraz z licznością jeśli dostępna
   * Zachowujemy ratingCard dla kompatybilności (aktualnie odzwierciedla users lub external fallback).
   */
  ratingSources?: ProductRatingSources;
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
