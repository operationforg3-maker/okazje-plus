/**
 * Normalizer - Maps external API responses to internal NormalizedDeal/Product schema
 * - AliExpress (SKU Dimension, Advanced API)
 * - Convertiser (Products/Offers)
 * - Multi-language support (detect+fallback)
 * - Currency detection & base currency conversion
 */

import logger from "../logger";
import { NormalizedDeal, NormalizedProduct, TranslationMap, MoneyValue } from "./api-interfaces";

const BASE_CURRENCY = "USD"; // Internal base
const DEFAULT_LOCALES = ["pl", "en"];

// ===== Currency Exchange Rates (mock - fetch real rates from API/Firebase) =====
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  PLN: 0.24,
  CNY: 0.14,
  GBP: 1.25,
  JPY: 0.0067,
};

function convertToBaseCurrency(amount: number, fromCurrency: string): number {
  const rate = EXCHANGE_RATES[fromCurrency] || 1;
  return amount * rate;
}

// ===== Detect language from text =====
function detectLanguage(text: string): string {
  // Simple heuristic (preferably use ML library like franc)
  if (/[а-я]/.test(text)) return "ru";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[éèêêàâôûùç]/.test(text)) return "fr";
  if (/[äöüß]/.test(text)) return "de";
  if (/[áéíóúñ]/.test(text)) return "es";
  return "en";
}

// ===== Ensure translations map =====
function ensureTranslations(
  title: string,
  description: string,
  detectedLang: string
): TranslationMap {
  const translations: TranslationMap = {};

  // Primary language (detected)
  translations[detectedLang] = { title, description };

  // Fallback: if not Polish/English, add them (leave empty for now; will be filled by AI)
  if (detectedLang !== "pl") {
    translations["pl"] = { title: "", description: "" };
  }
  if (detectedLang !== "en") {
    translations["en"] = { title: "", description: "" };
  }

  return translations;
}

// ===== Validate price =====
function validatePrice(price?: number): number | undefined {
  if (price === undefined || price === null) return undefined;
  if (typeof price !== "number" || price < 0) {
    logger.warn("Invalid price detected", { price });
    return undefined;
  }
  return price;
}

// ===== NORMALIZER: AliExpress =====
export function normalizeAliExpressProduct(
  apiResponse: any,
  categoryPath: { main: string; sub: string; subSub?: string }
): NormalizedProduct {
  const id = apiResponse.product_id || apiResponse.id || "";
  const title = apiResponse.title || apiResponse.product_name || "";
  const description = apiResponse.description || "";
  const detectedLang = detectLanguage(title);

  // Ceny (mogą być w różnych polach zależnie od metody API)
  const salePrice = validatePrice(
    apiResponse.sale_price ||
    apiResponse.app_sale_price ||
    apiResponse.price
  );
  const originalPrice = validatePrice(
    apiResponse.original_price ||
    apiResponse.app_original_price
  );
  const currency = apiResponse.currency || "USD";

  // Konwersja na walutę bazową
  const basePrice: MoneyValue = {
    amount: salePrice ? convertToBaseCurrency(salePrice, currency) : 0,
    currency: BASE_CURRENCY,
  };

  const baseOriginalPrice = originalPrice
    ? convertToBaseCurrency(originalPrice, currency)
    : undefined;

  const discountPercent =
    basePrice.amount && baseOriginalPrice
      ? Math.round(
          ((baseOriginalPrice - basePrice.amount) / baseOriginalPrice) * 100
        )
      : undefined;

  // Obrazy
  const images: string[] = [];
  if (apiResponse.image_url) images.push(apiResponse.image_url);
  if (apiResponse.images && Array.isArray(apiResponse.images)) {
    images.push(...apiResponse.images.map((img: any) => img.url || img));
  }

  return {
    id,
    source: "aliexpress",
    originalId: id,
    affiliateUrl: apiResponse.product_link || "",
    images,
    basePrice,
    originalPrice: baseOriginalPrice
      ? { amount: baseOriginalPrice, currency: BASE_CURRENCY }
      : undefined,
    currencyDetected: currency,
    translations: ensureTranslations(title, description, detectedLang),
    categoryPath,
    merchant: apiResponse.seller_name || apiResponse.merchant,
    stockStatus: apiResponse.stock_status || (salePrice ? "in_stock" : "out_of_stock"),
    metadata: {
      promotionId: apiResponse.promotion_id,
      commissionRate: apiResponse.commission_rate,
      evaluateCount: apiResponse.evaluate_count,
      evaluateRate: apiResponse.evaluate_rate,
      sellerRating: apiResponse.seller_rating,
      returnPolicy: apiResponse.return_policy,
      hotProduct: apiResponse.hot_product || false,
      flashDeal: apiResponse.flash_deal || false,
      platformProductType: apiResponse.platform_product_type,
      stockLevel: apiResponse.stock_level,
      productVideoUrl: apiResponse.video_url,
      warehouse: apiResponse.warehouse,
      deliveryTime: apiResponse.delivery_time,
      shippingMethod: apiResponse.shipping_method,
      originalUrl: apiResponse.product_link,
      sku: apiResponse.sku,
    },
    createdAt: new Date().toISOString(),
  };
}

// ===== NORMALIZER: Convertiser =====
export function normalizeConvertiserProduct(
  apiResponse: any,
  categoryPath: { main: string; sub: string; subSub?: string }
): NormalizedProduct {
  const id = apiResponse.id || apiResponse.uuid || "";
  const title = apiResponse.name || apiResponse.title || "";
  const description = apiResponse.description || "";
  const detectedLang = detectLanguage(title);

  // Ceny
  const salePrice = validatePrice(apiResponse.price || apiResponse.sale_price);
  const originalPrice = validatePrice(apiResponse.original_price);
  const currency = apiResponse.currency || "USD";

  const basePrice: MoneyValue = {
    amount: salePrice ? convertToBaseCurrency(salePrice, currency) : 0,
    currency: BASE_CURRENCY,
  };

  const baseOriginalPrice = originalPrice
    ? convertToBaseCurrency(originalPrice, currency)
    : undefined;

  const discountPercent =
    basePrice.amount && baseOriginalPrice
      ? Math.round(
          ((baseOriginalPrice - basePrice.amount) / baseOriginalPrice) * 100
        )
      : undefined;

  // Obrazy
  const images: string[] = [];
  if (apiResponse.image) images.push(apiResponse.image);
  if (apiResponse.gallery && Array.isArray(apiResponse.gallery)) {
    images.push(...apiResponse.gallery);
  }

  return {
    id,
    source: "convertiser",
    originalId: id,
    affiliateUrl: apiResponse.url || apiResponse.link || "",
    images,
    basePrice,
    originalPrice: baseOriginalPrice
      ? { amount: baseOriginalPrice, currency: BASE_CURRENCY }
      : undefined,
    currencyDetected: currency,
    translations: ensureTranslations(title, description, detectedLang),
    categoryPath,
    merchant: apiResponse.merchant || apiResponse.seller,
    couponCode: apiResponse.coupon_code,
    discountPercent,
    stockStatus: apiResponse.stock_status || "unknown",
    metadata: {
      source: "convertiser",
      importedAt: new Date().toISOString(),
      originalUrl: apiResponse.url,
      promotionId: apiResponse.promotion_id,
      commissionRate: apiResponse.commission_rate,
    },
    createdAt: new Date().toISOString(),
  };
}

// ===== NORMALIZER: Manual/CSV =====
export function normalizeManualDeal(
  data: any,
  categoryPath: { main: string; sub: string; subSub?: string }
): NormalizedDeal {
  const id = data.id || `manual-${Date.now()}`;
  const title = data.title || "";
  const description = data.description || "";
  const detectedLang = detectLanguage(title);

  const salePrice = validatePrice(data.price);
  const originalPrice = validatePrice(data.original_price);
  const currency = data.currency || "USD";

  const basePrice: MoneyValue = {
    amount: salePrice ? convertToBaseCurrency(salePrice, currency) : 0,
    currency: BASE_CURRENCY,
  };

  const baseOriginalPrice = originalPrice
    ? convertToBaseCurrency(originalPrice, currency)
    : undefined;

  return {
    id,
    source: "manual",
    affiliateUrl: data.link || "",
    images: data.images || [],
    basePrice,
    originalPrice: baseOriginalPrice
      ? { amount: baseOriginalPrice, currency: BASE_CURRENCY }
      : undefined,
    currencyDetected: currency,
    translations: ensureTranslations(title, description, detectedLang),
    categoryPath,
    merchant: data.merchant,
    couponCode: data.coupon_code,
    metadata: {
      originalUrl: data.link,
    },
    createdAt: new Date().toISOString(),
  };
}

// ===== Batch normalize =====
export function normalizeBatch(
  items: any[],
  source: "aliexpress" | "convertiser" | "manual",
  categoryPath: { main: string; sub: string; subSub?: string }
): (NormalizedDeal | NormalizedProduct)[] {
  return items.map((item) => {
    try {
      switch (source) {
        case "aliexpress":
          return normalizeAliExpressProduct(item, categoryPath);
        case "convertiser":
          return normalizeConvertiserProduct(item, categoryPath);
        case "manual":
          return normalizeManualDeal(item, categoryPath);
        default:
          throw new Error(`Unknown source: ${source}`);
      }
    } catch (error) {
      logger.error("Normalization failed for item", { item, source, error });
      return null;
    }
  }).filter(Boolean) as (NormalizedDeal | NormalizedProduct)[];
}
