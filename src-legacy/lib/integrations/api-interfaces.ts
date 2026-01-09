// External API + internal DB schema interfaces derived from local docs (AliExpress, Convertiser, Vertex AI)
// Do not guess missing fields; only fields present in local documentation are typed.

// ===== Common =====
export type LocaleCode = 'pl' | 'en' | 'de' | string;

export interface TranslationMap {
  [locale: string]: {
    title?: string;
    description?: string;
    shortDescription?: string;
  };
}

export interface MoneyValue {
  amount: number; // stored in base currency (e.g., USD)
  currency: string; // base currency code
}

// ===== AliExpress (overview-only, dynamic portal) =====
// Base request surface from docs (dynamic per method)
export interface AliExpressRequestBase {
  app_key: string;
  method: string; // e.g., aliexpress.solution.product.info.get
  session?: string; // access_token/session when required
  timestamp: string; // yyyy-MM-dd HH:mm:ss
  sign_method: 'hmac' | 'md5' | string;
  sign: string;
  v: string; // version, e.g., "1.0"
  format?: 'json' | 'xml';
  [param: string]: string | number | undefined;
}

export interface AliExpressPaginationParams {
  page_no?: number;
  page_size?: number;
  sort?: string; // e.g., sale_price_asc
  start_time?: string;
  end_time?: string;
}

// Note: konkretne pola odpowiedzi i parametry metod są w portalu AE (dynamiczne docId) i muszą być mapowane per metoda w kodzie runtime.

// ===== Convertiser =====
export interface ConvertiserAuthHeaders {
  Authorization: `Token ${string}`;
}

export interface ConvertiserWebsite {
  uuid: string;
  title: string;
  url: string;
  category: string;
  status: string; // approved, etc.
  verification_status: string; // verified, etc.
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface ConvertiserTransaction {
  id: string;
  type: string; // commission, etc.
  amount: number;
  currency: string;
  status: string; // completed, etc.
  date: string; // ISO 8601
}

export interface ConvertiserOfferFinderParams {
  status?: string;
  country?: string;
  category?: string;
}

export interface ConvertiserProductLinkRequest {
  // endpoint: PUT /publisher/products/{id}/tracking_link/
  // payload fields are defined per use case in Convertiser; keep open for extension
  [key: string]: unknown;
}

// ===== Vertex AI (per local guide) =====
export interface VertexAiTextGenerationRequest {
  contents: Array<{ role: 'user' | 'system' | 'assistant'; parts: Array<{ text: string }> }>;
  generationConfig?: { temperature?: number; maxOutputTokens?: number };
  safetySettings?: unknown; // configured per policy
}

export interface VertexAiTextGenerationResponse {
  response?: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
      safetyRatings?: unknown;
    }>;
  };
}

export interface VertexAiEmbeddingResponse {
  embedding?: { values: number[] };
}

// ===== Internal normalized schema (Global First, multilingual, base currency) =====
export interface NormalizedDeal {
  id: string;
  source: 'aliexpress' | 'convertiser' | 'manual' | 'csv';
  originalId?: string;
  affiliateUrl: string;
  images: string[];
  basePrice: MoneyValue; // stored in base currency
  originalPrice?: MoneyValue;
  currencyDetected?: string; // from source payload
  translations: TranslationMap; // title/desc per language
  categoryPath: { main: string; sub: string; subSub?: string };
  merchant?: string;
  couponCode?: string;
  discountPercent?: number;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'low_stock' | 'unknown';
  metadata?: {
    promotionId?: string;
    commissionRate?: number;
    evaluateCount?: number;
    evaluateRate?: string;
    sellerRating?: number;
    returnPolicy?: string;
    hotProduct?: boolean;
    flashDeal?: boolean;
    platformProductType?: string;
    stockLevel?: number;
    productVideoUrl?: string;
    warehouse?: string;
    deliveryTime?: string;
    shippingMethod?: string;
    originalUrl?: string;
  };
  assignedPersonaId?: string; // AI Generated Persona
  createdAt: string; // ISO
  updatedAt?: string; // ISO
}

export interface NormalizedProduct extends NormalizedDeal {
  sku?: string;
  ean?: string;
}

// ===== Job/Worker inputs =====
export interface IngestionJobPayload {
  source: 'aliexpress' | 'convertiser';
  query: Record<string, unknown>; // pagination/filter params for iterator
  localeFallbacks: LocaleCode[]; // e.g., ['pl','en','de']
}

export interface AiEnrichmentPayload {
  title: string;
  description?: string;
  specs?: Record<string, string>;
  targetLocales: LocaleCode[];
}
