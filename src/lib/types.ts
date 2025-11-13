
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
  canonicalProductId: string; // The "main" product in the group
  alternativeProductIds: string[]; // Similar/duplicate products
  similarityScores: Record<string, number>; // productId -> similarity score (0-1)
  status: 'pending_review' | 'confirmed' | 'rejected' | 'merged';
  detectedAt: string;
  reviewedAt?: string;
  reviewedBy?: string; // UID of moderator
  mergeStrategy?: 'keep_canonical' | 'merge_attributes' | 'keep_both';
  notes?: string;
  aiSuggestion?: {
    confidence: number;
    reasoning: string;
    recommendedCanonical: string;
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
  preservedFields: Record<string, any>; // Fields kept from merged products
  changes: {
    field: string;
    before: any;
    after: any;
    source: 'canonical' | 'merged' | 'manual';
  }[];
  mergedBy: string; // UID of admin
  mergedAt: string;
  snapshot: {
    canonical: Partial<Product>;
    merged: Partial<Product>[];
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
