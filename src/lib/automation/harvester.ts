import { adminDb } from '@/lib/firebase-admin';
import {
  ProductCore,
  DealM6,
  HarvesterJob,
  IdentityMatch,
  LocalizedText,
} from '@/lib/types';
import {
  calculateIdentityHash,
  calculateTitleHash,
  calculateImageHash,
  extractDimensionsFromTitle,
  normalizeProductIdentifier,
} from './identity-matcher';
import { AIRefiner } from './refiner';
import { startDealRefinerJob } from './deal-refiner';
import { convertToPLN } from '@/lib/currency-exchange';
import { addToModerationQueue } from '@/lib/moderation';
import { batchAssignCategories } from '@/ai/flows/convertiser-auto-category';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { chunkArray } from '@/lib/utils';
import { load as loadHtml } from 'cheerio';
// deep-mapper consolidated into mappers.ts; migrate when harvester uses Universal Product Schema
// import { mapAliExpressToProductCoreDeepData } from '@/integrations/aliexpress/deep-mapper';

/**
 * Raw product data from external APIs (before transformation)
 */
interface RawProduct {
  title: string;
  description?: string;
  imageUrl: string;
  price: number;
  originalPrice?: number; // Price before discount (for strikethrough display)
  currency: string;
  shippingCost: number;
  shippingDays: number;
  sourceProductId: string;
  sourceUrl: string;
  videoUrl?: string; // Product video URL from source (e.g., AliExpress)
  merchantName?: string;
  merchantRating?: number;
  specs?: Record<string, string>;
  discountPercent?: number; // Procentowa obniżka ceny
  couponCode?: string;
  expiryDate?: string;
  conditions?: string[];
  freeShipping?: boolean;
  minOrderValue?: number;
  limitPerUser?: number;
  requiresMembership?: string;
  isOfferOnly?: boolean;
  rating?: number;
  ratingCount?: number; // Number of reviews/ratings
  evaluateCount?: number; // AliExpress: Liczba opinii (alternatywa dla ratingCount)
  soldCount?: number; // AliExpress: Liczba sprzedanych/ocenionych (dla popularity metric)
  images?: string[]; // All product images (gallery)
  variants?: Array<{ // Product variants (colors, sizes, etc.)
    id: string;
    name: string; // e.g., "Color", "Size"
    values: string[]; // e.g., ["Black", "White"], ["S", "M", "L"]
    sku?: string;
  }>;
  // Product identifiers (for deduplication & SEO)
  sku?: string;
  ean?: string;
  gtin?: string;
  upc?: string;
  mpn?: string;
  offerMeta?: {
    promotionType?: 'offer';
    terms?: string;
    previewUrl?: string;
    hasCoupons?: boolean;
  };
}

/**
 * Smart Harvester - Fetches products from sources (AliExpress, Amazon, etc.)
 * and intelligently creates Products + Deals with deduplication
 */
export class SmartHarvester {
  private jobId: string;
  private logs: HarvesterJob['logs'] = [];
  private currentJob: HarvesterJob | null = null;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  private getFallbackImageUrl(): string {
    return PlaceHolderImages?.[0]?.imageUrl || '/placeholder.png';
  }

  /**
   * Phase 1A: Extract specs from AliExpress product properties
   * Handles both array format {attr_name, attr_value} and JSON strings
   */
  private extractPropsFromProductProps(props: any): Record<string, string> {
    const specs: Record<string, string> = {};

    if (!props) return specs;

    // Props can be: array of {attr_name, attr_value} OR JSON string OR HTML string
    let propsArray: any[] = [];
    if (Array.isArray(props)) {
      propsArray = props;
    } else if (typeof props === 'string' && props.trim().length > 0) {
      try {
        const parsed = JSON.parse(props);
        propsArray = Array.isArray(parsed) ? parsed : [];
      } catch {
        // Property is not valid JSON, skip
        return specs;
      }
    }

    // Map common attribute name aliases to standard keys for Polish UI
    const standardKeys: Record<string, string[]> = {
      memory: ['memory', 'ram', 'memorystyle', 'pamięć', 'memory size'],
      storage: [
        'storage',
        'storage capacity',
        'hard disk',
        'dysk',
        'pojemność',
      ],
      color: ['color', 'colours', 'color classification', 'kolor', 'kolory'],
      brand: ['brand', 'brand name', 'marka'],
      screen: [
        'screen',
        'screen size',
        'display size',
        'screen type',
        'ekran',
        'rozmiar ekranu',
      ],
      battery: ['battery', 'battery capacity', 'bateria', 'pojemność baterii'],
      processor: ['cpu', 'processor', 'processor type', 'procesor'],
      os: ['operating system', 'os', 'system type', 'system', 'system'],
      weight: ['weight', 'item weight', 'waga'],
      material: ['material', 'material type', 'materiał'],
      connector: ['connector', 'port', 'złącze'],
      waterproof: ['waterproof', 'water resistant', 'ipx'],
      warranty: ['warranty', 'gwarancja'],
    };

    // Extract and normalize properties
    propsArray.forEach(prop => {
      const name = String(prop.attr_name || '').toLowerCase().trim();
      const value = String(prop.attr_value || '').trim();

      if (!name || !value) return;

      // Match against standard keys with aliases
      for (const [standardKey, aliases] of Object.entries(standardKeys)) {
        if (aliases.some(alias => name.includes(alias))) {
          specs[standardKey] = value;
          break;
        }
      }
    });

    return specs;
  }

  /**
   * Phase 1B: Extract min/max price range from SKU variants
   * Returns object with min/max or undefined if insufficient data
   */
  private extractSkuPriceRange(
    skuList: any[]
  ): {
    minPrice: number;
    maxPrice: number;
  } | null {
    if (!Array.isArray(skuList) || skuList.length === 0) return null;

    const prices = skuList
      .map(sku => {
        const priceStr = String(
          sku.sku_sale_price ?? sku.sku_price ?? sku.offer_price ?? '0'
        );
        return parseFloat(priceStr.replace(',', '.')) || 0;
      })
      .filter(p => p > 0);

    if (prices.length === 0) return null;

    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    };
  }

  /**
   * Phase 1D: Consolidate images from multiple AliExpress fields
   */
  private consolidateImageGallery(
    product: any
  ): { images: string[]; mainImage: string } {
    const imageSet = new Set<string>();

    // Primary main image (from different possible sources)
    const primaryFields = [
      product.product_main_image_url,
      product.imageUrl,
      product.image_url,
      product.preview_image_url,
    ];
    
    primaryFields.forEach(field => {
      if (typeof field === 'string' && field.trim() && field.startsWith('http')) {
        imageSet.add(field);
      }
    });

    // Gallery/secondary images (multiple sources)
    const galleryFields = [
      product.product_small_image_urls,
      product.all_images,
      product.image_urls,
      product.images,
      product.second_level_image_url,
      product.first_level_image_url,
      product.other_image_urls,
    ];

    galleryFields.forEach(field => {
      if (Array.isArray(field)) {
        field.forEach(url => {
          if (typeof url === 'string' && url.trim() && url.startsWith('http')) {
            imageSet.add(url);
          }
        });
      } else if (typeof field === 'string' && field.trim() && field.startsWith('http')) {
        imageSet.add(field);
      }
    });

    // Convert to array, filter valid URLs, limit to 15
    const validImages = Array.from(imageSet)
      .filter(url => url && url.length > 0)
      .slice(0, 15);

    const mainImage = validImages[0] || '';

    return {
      images: validImages,
      mainImage,
    };
  }

  private async scrapeAliExpressPage(url: string): Promise<{
    description?: string;
    specs?: Record<string, string>;
    images?: string[];
    mainImage?: string;
  }> {
    if (!url || !url.startsWith('http')) {
      return {};
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8,de;q=0.7',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {};
      }

      const html = await response.text();
      if (!html || html.length < 200) {
        return {};
      }

      const $ = loadHtml(html);
      const specs: Record<string, string> = {};
      const images: string[] = [];

      let description = $('meta[property="og:description"]').attr('content')
        || $('meta[name="description"]').attr('content')
        || '';

      const metaImage = $('meta[property="og:image"]').attr('content')
        || $('meta[property="og:image:secure_url"]').attr('content')
        || '';

      if (metaImage && metaImage.startsWith('http')) {
        images.push(metaImage);
      }

      $('script[type="application/ld+json"]').each((_, el) => {
        const jsonText = $(el).text();
        if (!jsonText) return;

        try {
          const parsed = JSON.parse(jsonText);
          const candidates = Array.isArray(parsed) ? parsed : [parsed];
          candidates.forEach((entry) => {
            const product = entry?.['@type'] === 'Product'
              ? entry
              : entry?.['@graph']?.find((item: any) => item?.['@type'] === 'Product');

            if (!product) return;

            const brand = typeof product.brand === 'string'
              ? product.brand
              : product.brand?.name;
            if (brand) specs.brand = String(brand);

            if (product.sku) specs.sku = String(product.sku);
            if (product.mpn) specs.mpn = String(product.mpn);
            if (product.model) specs.model = String(product.model);

            const productImages = product.image;
            if (Array.isArray(productImages)) {
              productImages
                .filter((img) => typeof img === 'string' && img.startsWith('http'))
                .forEach((img) => images.push(img));
            } else if (typeof productImages === 'string' && productImages.startsWith('http')) {
              images.push(productImages);
            }

            if (!description && product.description) {
              description = String(product.description);
            }
          });
        } catch {
          return;
        }
      });

      const dedupedImages = Array.from(new Set(images)).slice(0, 15);

      return {
        description: description || undefined,
        specs: Object.keys(specs).length > 0 ? specs : undefined,
        images: dedupedImages.length > 0 ? dedupedImages : undefined,
        mainImage: dedupedImages[0],
      };
    } catch {
      return {};
    }
  }

  /**
   * Phase 1E: Extract minimum available quantity across SKUs
   */
  private getMinimumAvailableQuantity(skuList: any[]): number | undefined {
    if (!Array.isArray(skuList) || skuList.length === 0) return undefined;

    const quantities = skuList
      .map(sku => {
        const qty = parseInt(
          String(sku.sku_available_quantity || sku.availability || '0')
        );
        return qty > 0 ? qty : 0;
      })
      .filter(q => q > 0);

    return quantities.length > 0
      ? Math.min(...quantities)
      : undefined;
  }

  private async recordDiscardedItem(params: {
    source: string;
    type: 'product' | 'deal' | 'unknown';
    reason: string;
    reasonCode: string;
    item?: Partial<RawProduct> & { title?: string };
    query?: string;
    categoryPath?: string;
  }): Promise<void> {
    try {
      const now = new Date().toISOString();
      const item = params.item || {};
      await adminDb.collection('import_discarded').add({
        source: params.source,
        type: params.type,
        reason: params.reason,
        reasonCode: params.reasonCode,
        title: item.title || '',
        imageUrl: item.imageUrl || '',
        price: item.price ?? null,
        originalPrice: item.originalPrice ?? null,
        currency: item.currency || null,
        sourceProductId: item.sourceProductId || null,
        sourceUrl: item.sourceUrl || null,
        merchantName: item.merchantName || null,
        query: params.query || null,
        categoryPath: params.categoryPath || null,
        jobId: this.jobId,
        createdAt: now,
      });
    } catch (err) {
      this.addLog('warn', 'Nie udało się zapisać odfiltrowanego importu', err);
    }
  }

  private mapConvertiserOfferToRawProduct(offer: any): RawProduct | null {
    try {
      const title = offer.title || offer.product_title || offer.name || offer.product_name || '';
      if (!title) return null;

      const imageUrl = offer.logo_thumbnail || offer.logo || offer.image || offer.image_url || offer.product_image || this.getFallbackImageUrl();
      const previewUrl =
        offer.tracking_link ||
        offer.tracking_url ||
        offer.affiliate_url ||
        offer.aff_link ||
        offer.preview_url ||
        offer.offer_display_url ||
        offer.url ||
        '';

      const parsePrice = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        const str = String(value);
        const match = str.match(/[\d.,]+/);
        return match ? parseFloat(match[0].replace(',', '.')) : 0;
      };

      const price = parsePrice(offer.sale_price || offer.price || offer.current_price || offer.offer_price);
      let originalPrice = parsePrice(offer.original_price || offer.regular_price || offer.list_price || offer.old_price);
      const discountValue = parsePrice(
        offer.discount_value ||
        offer.discount_amount ||
        offer.saving ||
        offer.savings ||
        offer.cashback_value
      );
      let discountPercent = parsePrice(
        offer.discount_percent ||
        offer.discountPercentage ||
        offer.percent_off ||
        offer.rebate_percent
      );
      if (discountPercent > 0 && discountPercent <= 1) {
        discountPercent = Math.round(discountPercent * 100);
      }
      if (originalPrice > 0 && price > 0 && originalPrice < price) {
        this.addLog('warn', 'Convertiser: oryginalna cena wygląda na różnicę (mniejsza od bieżącej) - pomijam');
        originalPrice = 0;
      }
      if (!discountPercent && originalPrice > price && price > 0) {
        discountPercent = Math.round(100 - (price / originalPrice) * 100);
      }
      if (!originalPrice && discountValue > 0 && price > 0) {
        originalPrice = price + discountValue;
      }
      if (discountPercent && !originalPrice && price > 0) {
        originalPrice = Math.round((price / (1 - discountPercent / 100)) * 100) / 100;
      }

      const stripHtml = (value: any): string => {
        if (!value) return '';
        return String(value)
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const couponCodeRaw =
        offer.coupon_code ||
        offer.couponCode ||
        offer.code ||
        offer.promo_code ||
        offer.voucher_code ||
        offer.discount_code ||
        '';
      const couponCode = String(couponCodeRaw || '').trim() || undefined;

      const toIsoDate = (value: any): string | undefined => {
        if (!value) return undefined;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'number') return new Date(value).toISOString();
        const parsed = Date.parse(String(value));
        return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
      };

      const expiryDate = toIsoDate(
        offer.expiry_date ||
        offer.expiration_date ||
        offer.valid_until ||
        offer.valid_to ||
        offer.ends_at ||
        offer.end_date
      );

      const rawConditions = offer.terms || offer.conditions || offer.condition || offer.rules;
      const conditions = Array.isArray(rawConditions)
        ? rawConditions
            .map((c: any) => stripHtml(c))
            .filter(Boolean)
        : stripHtml(rawConditions || '')
            .split(/\n|\r|•|;|\|/g)
            .map((c) => c.trim())
            .filter(Boolean);
      const freeShipping = Boolean(offer.free_shipping || offer.freeShipping || offer.shipping_free || offer.shipping_cost === 0);
      const minOrderValue = parsePrice(offer.min_order_value || offer.minimum_order_value || offer.minimum_purchase);
      const limitPerUser = parsePrice(offer.limit_per_user || offer.max_per_user || offer.user_limit);
      const requiresMembership = offer.requires_membership || offer.membership || offer.membership_required;

      const descriptionRaw = offer.description || offer.product_description || offer.excerpt || offer.short_description || '';
      let description = stripHtml(descriptionRaw);
      if (!description) {
        const pieces: string[] = [];
        if (typeof discountPercent === 'number' && discountPercent > 0) {
          pieces.push(`Zniżka ${discountPercent}%`);
        }
        if (couponCode) {
          pieces.push(`Kod: ${couponCode}`);
        }
        if (conditions.length > 0) {
          pieces.push(conditions.join(' • '));
        }
        description = pieces.join(' • ');
      }
      const specsFromTitle = extractDimensionsFromTitle(title);
      const specsFromDesc = description ? extractDimensionsFromTitle(description) : {};
      const mergedSpecs = { ...specsFromTitle, ...specsFromDesc };

      const domainRegex = /\b[a-z0-9-]+\.(pl|com|net|org|eu|store|shop|co|io|de|fr|it|es|cz|sk|uk)\b/i;
      const isOfferOnly = domainRegex.test(title) && !/\d/.test(title);

      return {
        title,
        description,
        imageUrl,
        price,
        originalPrice: originalPrice > price ? originalPrice : undefined,
        currency: 'PLN',
        shippingCost: 0,
        shippingDays: 0,
        sourceProductId: String(
          offer.uuid ||
          offer.offer_uuid ||
          offer.offer_id ||
          offer.id ||
          ''
        ),
        sourceUrl: previewUrl,
        merchantName: offer.title || offer.advertiser_name || 'Convertiser',
        merchantRating: 0,
        specs: mergedSpecs,
        discountPercent: typeof discountPercent === 'number' && discountPercent > 0 ? discountPercent : undefined,
        couponCode,
        expiryDate,
        conditions: conditions.length > 0 ? conditions : undefined,
        freeShipping,
        minOrderValue: minOrderValue > 0 ? minOrderValue : undefined,
        limitPerUser: limitPerUser > 0 ? limitPerUser : undefined,
        requiresMembership: requiresMembership ? String(requiresMembership) : undefined,
        isOfferOnly,
        rating: 0,
        ratingCount: 0,
        images: [imageUrl],
        offerMeta: {
          promotionType: 'offer',
          terms: stripHtml(offer.terms || '') || undefined,
          previewUrl: previewUrl || undefined,
          hasCoupons: Boolean(offer.has_coupons || couponCode),
        },
      } as RawProduct;
    } catch {
      return null;
    }
  }

  /**
   * Build a list of category query strings by walking the 3-level tree in Firestore.
   * Each entry is formatted as `main/sub/subsub` (falls back to `main/sub` when no sub-sub exists).
   */
  static async buildCategoryQueries(rootCategorySlug?: string): Promise<string[]> {
    const queries: string[] = [];

    try {
      const mainCategories = [] as Array<{ id: string; slug: string }>;

      if (rootCategorySlug) {
        const mainDoc = await adminDb.collection('categories').doc(rootCategorySlug).get();
        if (mainDoc.exists) {
          const data = mainDoc.data() as any;
          mainCategories.push({ id: mainDoc.id, slug: data?.slug || mainDoc.id });
        }
      } else {
        const mainSnapshot = await adminDb.collection('categories').get();
        mainSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          mainCategories.push({ id: docSnap.id, slug: data?.slug || docSnap.id });
        });
      }

      for (const main of mainCategories) {
        const subSnapshot = await adminDb.collection(`categories/${main.id}/subcategories`).get();
        for (const subDoc of subSnapshot.docs) {
          const subData = subDoc.data() as any;
          const subSlug = subData?.slug || subDoc.id;

          const subSubSnapshot = await adminDb.collection(`categories/${main.id}/subcategories/${subDoc.id}/subcategories`).get();

          if (subSubSnapshot.empty) {
            // Base path for subcategory
            queries.push(`${main.slug}/${subSlug}`);
            // Expand with sub-level import keywords to iterate more targets
            const subKeywords: string[] = Array.isArray(subData?.importKeywords) ? subData.importKeywords : [];
            for (const kw of subKeywords) {
              const normKw = (kw || '').trim();
              if (normKw) queries.push(`${main.slug}/${subSlug}/${normKw}`);
            }
            continue;
          }

          subSubSnapshot.forEach((subSubDoc) => {
            const subSubData = subSubDoc.data() as any;
            const subSubSlug = subSubData?.slug || subSubDoc.id;
            // Base path for sub-subcategory
            queries.push(`${main.slug}/${subSlug}/${subSubSlug}`);
            // Also iterate per import keyword to widen coverage
            const keywords: string[] = Array.isArray(subSubData?.importKeywords) ? subSubData.importKeywords : [];
            for (const kw of keywords) {
              const normKw = (kw || '').trim();
              if (normKw) queries.push(`${main.slug}/${subSlug}/${subSubSlug}/${normKw}`);
            }
          });
        }
      }

      return Array.from(new Set(queries));
    } catch (error) {
      console.error('[Harvester] Failed to build category queries', error);
      return [];
    }
  }

  /**
   * Log an entry to the job
   */
  private addLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    details?: any
  ) {
    // Serialize details to plain object (avoid Error instances, etc.)
    let serializedDetails: any = undefined;
    if (details !== undefined) {
      if (details instanceof Error) {
        serializedDetails = { message: details.message, stack: details.stack };
      } else if (typeof details === 'object' && details !== null) {
        try {
          serializedDetails = JSON.parse(JSON.stringify(details));
        } catch {
          serializedDetails = String(details);
        }
      } else {
        serializedDetails = details;
      }
    }

    this.logs.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      details: serializedDetails,
    });
    console.log(`[${level.toUpperCase()}] ${message}`, details || '');
  }

  /**
   * Check if job is still active (not paused/cancelled)
   */
  private async isJobActive(): Promise<boolean> {
    try {
      const doc = await adminDb.collection('harvester_jobs').doc(this.jobId).get();
      if (!doc.exists) return true;
      const status = doc.data()?.status;
      return status === 'running';
    } catch (e) {
      console.error('[Harvester] Failed to check job status', e);
      return true; // Keep running on temporary DB error
    }
  }

  /**
   * Update job record in Firestore
   * Limits logs to last 200 entries to avoid Firestore 1MB document size limit
   */
  private async updateJobRecord(job: HarvesterJob): Promise<void> {
    const jobRef = adminDb.collection('harvester_jobs').doc(this.jobId);
    
    // Limit logs to prevent Firestore 1MB document size limit
    // Keep only last 200 entries (approximately 800KB with details)
    const logsToSave = job.logs.slice(-200);
    
    await jobRef.set(
      {
        status: job.status,
        source: job.source,
        query: job.query,
        maxResults: job.maxResults,
        productsFound: job.productsFound,
        productsCreated: job.productsCreated,
        dealsCreated: job.dealsCreated,
        dealsLinked: job.dealsLinked,
        duplicatesSkipped: job.duplicatesSkipped,
        errors: job.errors,
        currentCategory: job.currentCategory,
        totalCategories: job.totalCategories,
        processedCategories: job.processedCategories,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        lastUpdatedAt: job.lastUpdatedAt,
        logs: logsToSave,
      },
      { merge: true }
    );
  }

  /**
   * Run a function with a timeout (per category protection)
   */
  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Przekroczono limit czasu (${timeoutMs} ms) dla: ${label}`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private toLocalizedText(value: string): LocalizedText {
    const safe = String(value || '').trim();
    return {
      pl: safe,
      en: safe,
      de: safe,
    };
  }

  private normalizeSpecs(specs: any): Record<string, string> {
    if (!specs) return {};
    if (Array.isArray(specs)) {
      const mapped: Record<string, string> = {};
      specs.forEach((item) => {
        const key = String(item?.key || item?.name || '').trim();
        const value = String(item?.value || '').trim();
        if (key && value) mapped[key] = value;
      });
      return mapped;
    }
    if (typeof specs === 'object') {
      const mapped: Record<string, string> = {};
      Object.entries(specs).forEach(([key, value]) => {
        const k = String(key || '').trim();
        const v = String(value || '').trim();
        if (k && v) mapped[k] = v;
      });
      return mapped;
    }
    return {};
  }

  private async findProductByIdentity(identityHash: string): Promise<ProductCore | null> {
    if (!identityHash) return null;

    const matchSnap = await adminDb
      .collection('identity_matches')
      .where('combinedHash', '==', identityHash)
      .limit(1)
      .get();

    if (matchSnap.empty) return null;
    const match = matchSnap.docs[0].data() as IdentityMatch;
    if (!match?.productId) return null;

    const productSnap = await adminDb.collection('product_cores').doc(match.productId).get();
    if (!productSnap.exists) return null;

    return {
      id: productSnap.id,
      ...(productSnap.data() as ProductCore),
    } as ProductCore;
  }

  private async findProductByIdentifiers(identifiers: {
    ean?: string;
    gtin?: string;
    upc?: string;
    mpn?: string;
  }): Promise<ProductCore | null> {
    const checks: Array<{ field: string; value?: string }> = [
      { field: 'metadata.identifiers.ean', value: identifiers.ean },
      { field: 'metadata.identifiers.gtin', value: identifiers.gtin },
      { field: 'metadata.identifiers.upc', value: identifiers.upc },
      { field: 'metadata.identifiers.mpn', value: identifiers.mpn },
    ];

    for (const check of checks) {
      if (!check.value) continue;
      const normalized = normalizeProductIdentifier(check.value);
      if (!normalized) continue;

      const snap = await adminDb
        .collection('product_cores')
        .where(check.field, '==', normalized)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        return {
          id: doc.id,
          ...(doc.data() as ProductCore),
        } as ProductCore;
      }
    }

    return null;
  }

  private prepareIdentityMatch(
    combinedHash: string,
    productId: string,
    source: string,
    title: string,
    imageUrl: string,
    sourceProductId?: string
  ) {
    const titleHash = calculateTitleHash(title || productId);
    const primaryImageHash = calculateImageHash(imageUrl || '');
    const identityMatchRef = adminDb.collection('identity_matches').doc();
    const identityMatchData: IdentityMatch = {
      id: identityMatchRef.id,
      titleHash,
      primaryImageHash,
      combinedHash,
      productId,
      source,
      sourceProductId,
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    };

    return { identityMatchData, identityMatchRef };
  }

  private async prepareProductCore(
    sourceProduct: RawProduct,
    identityHash: string,
    source: string,
    categoryInfo: {
      mainCategorySlug: string;
      subCategorySlug: string;
      subSubCategorySlug?: string;
    }
  ) {
    const now = new Date().toISOString();
    const title = String(sourceProduct.title || '').trim();
    const description = String(sourceProduct.description || '').trim();
    const shortDescription = description || title;
    const images = Array.isArray(sourceProduct.images) && sourceProduct.images.length > 0
      ? sourceProduct.images
      : (sourceProduct.imageUrl ? [sourceProduct.imageUrl] : []);
    const primaryImage = images[0] || this.getFallbackImageUrl();
    const specs = this.normalizeSpecs(sourceProduct.specs);

    const identifiers = {
      ean: sourceProduct.ean ? normalizeProductIdentifier(sourceProduct.ean) : undefined,
      gtin: sourceProduct.gtin ? normalizeProductIdentifier(sourceProduct.gtin) : undefined,
      upc: sourceProduct.upc ? normalizeProductIdentifier(sourceProduct.upc) : undefined,
      mpn: sourceProduct.mpn ? normalizeProductIdentifier(sourceProduct.mpn) : undefined,
      sku: sourceProduct.sku ? normalizeProductIdentifier(sourceProduct.sku) : undefined,
    };

    const productRef = adminDb.collection('product_cores').doc();
    const productData: ProductCore = {
      id: productRef.id,
      identityHash,
      title: this.toLocalizedText(title || 'Brak tytulu'),
      shortDescription: this.toLocalizedText(shortDescription || 'Brak opisu'),
      fullDescription: this.toLocalizedText(description || shortDescription || ''),
      specs,
      mainCategorySlug: categoryInfo.mainCategorySlug,
      subCategorySlug: categoryInfo.subCategorySlug,
      subSubCategorySlug: categoryInfo.subSubCategorySlug,
      imageUrl: primaryImage,
      images: images.length > 0 ? images : [primaryImage],
      primaryImageHash: calculateImageHash(primaryImage),
      videoUrl: sourceProduct.videoUrl,
      reviewsSummary: this.toLocalizedText('Brak podsumowania opinii'),
      rating: {
        score: Number(sourceProduct.rating || 0),
        count: Number(sourceProduct.ratingCount || 0),
        provider: source === 'aliexpress' ? 'aliexpress' : 'mixed',
      },
      bestPrice: {
        amount: Number(sourceProduct.price || 0),
        currency: (sourceProduct.currency as any) || 'PLN',
      },
      bestTotalPrice: Number(sourceProduct.price || 0) + Number(sourceProduct.shippingCost || 0),
      linkedDealIds: [],
      searchTags: Array.from(new Set(
        `${title} ${categoryInfo.mainCategorySlug} ${categoryInfo.subCategorySlug}`
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 12)
      )),
      status: 'pending_approval',
      createdAt: now,
      updatedAt: now,
      metadata: {
        source,
        originalId: sourceProduct.sourceProductId,
        importedAt: now,
        identifiers,
      },
    };

    return { productData, productRef };
  }

  private async prepareDeal(
    productId: string,
    sourceProduct: RawProduct,
    source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser'
  ) {
    const now = new Date().toISOString();
    const dealRef = adminDb.collection('deals').doc();

    const priceAmount = Number(sourceProduct.price || 0);
    const shippingCost = Number(sourceProduct.shippingCost || 0);
    const originalPrice = Number(sourceProduct.originalPrice || 0);
    const discountAmount = originalPrice > priceAmount ? originalPrice - priceAmount : 0;
    const discountPercent = discountAmount > 0
      ? Math.round((discountAmount / originalPrice) * 100)
      : undefined;

    const dealData: DealM6 = {
      id: dealRef.id,
      productId,
      productCoreId: productId,
      price: {
        amount: priceAmount,
        currency: (sourceProduct.currency as any) || 'PLN',
      },
      originalPrice: originalPrice > 0 ? originalPrice : undefined,
      discount: discountAmount > 0 ? { amount: discountAmount, percentage: discountPercent } : undefined,
      discountPercent: discountPercent,
      shipping: {
        cost: shippingCost,
        timeDays: Number(sourceProduct.shippingDays || 0) || 7,
        method: 'Standard',
      },
      source,
      affiliateLink: sourceProduct.sourceUrl || '',
      affiliateUrl: sourceProduct.sourceUrl || '',
      dealUrl: sourceProduct.sourceUrl || '',
      merchantName: sourceProduct.merchantName,
      merchantRating: sourceProduct.merchantRating,
      title: this.toLocalizedText(sourceProduct.title || ''),
      description: sourceProduct.description ? this.toLocalizedText(sourceProduct.description) : undefined,
      dealType: sourceProduct.couponCode ? 'coupon' : (discountPercent ? 'sale' : 'regular'),
      couponCode: sourceProduct.couponCode,
      stockStatus: 'in_stock',
      stockLevel: (sourceProduct as any).offerMeta?.minimumAvailableQuantity,
      isActive: true,
      priceHistory: [
        {
          date: now.substring(0, 10),
          price: priceAmount,
          currency: (sourceProduct.currency as any) || 'PLN',
        },
      ],
      voteCount: 0,
      temperature: 0,
      commentsCount: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      sourceProductId: sourceProduct.sourceProductId,
      sourceUrl: sourceProduct.sourceUrl || '',
    };

    return { dealData, dealRef };
  }

  private async batchUpdateProductBestPrices(productIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    let batch = adminDb.batch();
    let batchCount = 0;

    for (const productId of uniqueIds) {
      const dealsSnap = await adminDb
        .collection('deals')
        .where('productId', '==', productId)
        .get();

      if (dealsSnap.empty) {
        this.addLog('warn', `Brak ofert do przeliczenia bestPrice dla produktu: ${productId}`);
        continue;
      }

      const deals = dealsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as DealM6),
      }));

      const bestDeal = deals.reduce((best, current) => {
        const bestPrice = Number(best.price?.amount || 0) + Number(best.shipping?.cost || 0);
        const currentPrice = Number(current.price?.amount || 0) + Number(current.shipping?.cost || 0);
        return currentPrice < bestPrice ? current : best;
      });

      const bestTotalPrice = Number(bestDeal.price?.amount || 0) + Number(bestDeal.shipping?.cost || 0);
      const bestCurrency = (bestDeal.price?.currency as any) || 'PLN';

      const productRef = adminDb.collection('product_cores').doc(productId);
      batch.update(productRef, {
        bestPrice: {
          amount: bestTotalPrice,
          currency: bestCurrency,
        },
        bestTotalPrice: bestTotalPrice,
        bestDealId: bestDeal.id,
        linkedDealIds: deals.map((deal) => deal.id),
        updatedAt: new Date().toISOString(),
      });

      batchCount += 1;
      if (batchCount >= 450) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  /**
   * Main entry point: Harvest products from a source
   * Returns the harvester job with results
   * 
   * @param source - API source (aliexpress, amazon, allegro)
   * @param query - Search query or category slug (e.g., 'phones', 'phones/flagship' for sub-categories)
   * @param maxResults - Maximum products to fetch
   * @param categories - Optional: Iterate through multiple categories/sub-categories
   * @param autoBrowse - Auto-browse entire catalog (Convertiser only)
   */
  async harvestProducts(
    source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser',
    query: string,
    maxResults: number = 50,
    categories?: string[], // e.g., ['phones/flagship', 'phones/budget', 'tablets/android']
    isTreeMode: boolean = false, // True when harvesting from category tree
    convertiserMode?: 'products' | 'offers', // Convertiser: fetch products or offers
    autoBrowse: boolean = false // Convertiser: fetch entire catalog without keywords
  ): Promise<HarvesterJob> {
    const jobStartTime = new Date().toISOString();
    
    // For Convertiser: NEVER use category tree mode - use simple query only
    // Moderator will manually categorize products in admin UI
    let queries: string[];
    if (autoBrowse && source === 'convertiser') {
      queries = ['__AUTO_BROWSE__'];
    } else {
      const useSimpleQuery = source === 'convertiser' || !isTreeMode;
      queries = (useSimpleQuery || !categories || categories.length === 0) ? [query] : categories;
    }
    const processedCategoriesLog: HarvesterJob['processedCategories'] = [];
    
    const modeDesc = source === 'convertiser' 
      ? 'simple-query (moderator categorizes)' 
      : (isTreeMode ? 'category-tree' : 'single');
    this.addLog('info', `Starting harvest job: source=${source}, mode=${modeDesc}, queries=${queries.join(', ')}, maxResults=${maxResults}`);

    // Initialize job record immediately (so UI can poll for status)
    const initialJob: HarvesterJob = {
      id: this.jobId,
      status: 'running',
      source,
      query: queries.join(', '),
      maxResults,
      productsFound: 0,
      productsCreated: 0,
      dealsCreated: 0,
      dealsLinked: 0,
      duplicatesSkipped: 0,
      errors: [],
      currentCategory: queries[0] || '',
      totalCategories: queries.length,
      processedCategories: [],
      startedAt: jobStartTime,
      lastUpdatedAt: jobStartTime,
      logs: this.logs,
    };
    await this.updateJobRecord(initialJob);

    let productsFound = 0;
    let productsCreated = 0;
    let dealsCreated = 0;
    let dealsLinked = 0;
    let duplicatesSkipped = 0;
    const errors: HarvesterJob['errors'] = [];
    let processedCount = 0; // Counter for periodic updates
    let lastProgressUpdate = Date.now();
    const progressUpdateIntervalMs = 5000;
    const categoryAttempts = new Map<string, number>();
    const processedCategorySet = new Set<string>();
    const maxCategoryAttempts = 2; // 1 retry per category
    const categoryTimeoutMs = 120_000; // 120s timeout per category
    const dealsToRefine: string[] = [];
    const productsToRefine: string[] = [];
    let lastDealRefinerAt = 0;
    const dealRefinerBatchSize = 50;
    const dealRefinerMinIntervalMs = 30_000;

    try {
      // Iterate through all provided queries/categories
      for (const currentQuery of queries) {
        if (processedCategorySet.has(currentQuery)) {
          this.addLog('warn', `Pomijam zduplikowaną kategorię: ${currentQuery}`);
          processedCategoriesLog.push({
            category: currentQuery,
            count: 0,
            status: 'skipped',
          });
          continue;
        }

        let categoryCompleted = false;
        let categoryProductsCreated = 0; // Local counter for this category

        while (!categoryCompleted) {
          const attempt = (categoryAttempts.get(currentQuery) || 0) + 1;
          categoryAttempts.set(currentQuery, attempt);

          if (attempt > maxCategoryAttempts) {
            this.addLog('warn', `Przekroczono limit prób dla kategorii: ${currentQuery}`);
            processedCategoriesLog.push({
              category: currentQuery,
              count: categoryProductsCreated,
              status: 'skipped',
            });
            processedCategorySet.add(currentQuery);
            break;
          }

          // Check if we should stop
          if (!(await this.isJobActive())) {
            this.addLog('warn', 'Job stopped externally (paused/cancelled)');
            return {
              id: this.jobId,
              status: 'paused',
              source,
              query: queries.join(', '),
              maxResults,
              productsFound,
              productsCreated,
              dealsCreated,
              dealsLinked,
              duplicatesSkipped,
              errors,
              currentCategory: currentQuery,
              totalCategories: queries.length,
              processedCategories: processedCategoriesLog,
              startedAt: jobStartTime,
              lastUpdatedAt: new Date().toISOString(),
              logs: this.logs,
            };
          }

          const categoryStartTime = Date.now();
          this.addLog('info', `Processing query/category: ${currentQuery} (attempt ${attempt}/${maxCategoryAttempts})`);

          // Update current category in status
          await this.updateJobRecord({
            id: this.jobId,
            status: 'running',
            source,
            query: queries.join(', '),
            maxResults,
            productsFound,
            productsCreated,
            dealsCreated,
            dealsLinked,
            duplicatesSkipped,
            errors,
            currentCategory: currentQuery,
            totalCategories: queries.length,
            processedCategories: processedCategoriesLog,
            startedAt: jobStartTime,
            lastUpdatedAt: new Date().toISOString(),
            logs: this.logs,
          });

          const productsToRecalculate = new Set<string>();

          try {
            await this.runWithTimeout(async () => {
          // Step 1: Fetch products from source API
          // For tree mode: extract category name from path (e.g., 'electronics/phones/flagship' -> 'flagship')
          const searchTerm = isTreeMode 
            ? currentQuery.split('/').pop() || currentQuery 
            : currentQuery;
            
          const sourceProducts = await this.fetchFromSource(source, searchTerm, maxResults, isTreeMode, convertiserMode);
          
          // For category-tree mode: Filter by rating/quality (top products only)
          let filteredProducts = sourceProducts;
          if (isTreeMode && !autoBrowse && sourceProducts.length > 0) {
            filteredProducts = this.filterTopQualityProducts(sourceProducts, Math.ceil(maxResults * 0.6));

            const keptIds = new Set(filteredProducts.map((p) => p.sourceProductId || p.title));
            const discarded = sourceProducts.filter((p) => !keptIds.has(p.sourceProductId || p.title));

            await Promise.all(
              discarded.map((item) =>
                this.recordDiscardedItem({
                  source,
                  type: 'product',
                  reason: 'Odrzucone przez filtr jakości (rating/oceny).',
                  reasonCode: 'quality_filter',
                  item,
                  query: currentQuery,
                  categoryPath: currentQuery,
                })
              )
            );
          }
          
          productsFound += sourceProducts.length;
          this.addLog('info', `Fetched ${sourceProducts.length} products from ${source} for "${currentQuery}", using ${filteredProducts.length} after quality filter`);

          // Step 1.5: Batch AI categorization for Convertiser (optimize token costs)
          if (source === 'convertiser' && filteredProducts.length > 0) {
            try {
              this.addLog('info', `Running batch AI categorization for ${filteredProducts.length} Convertiser products...`);
              
              // Get all available categories once
              const { getAllCategories, getSubcategories, getSubSubcategories } = await import('@/lib/data-admin');
              const mainCats = await getAllCategories();
              const availableCategories: any[] = [];
              
              for (const main of mainCats) {
                const subs = await getSubcategories(main.id);
                for (const sub of subs) {
                  const subSubs = await getSubSubcategories(main.id, sub.id);
                  if (subSubs.length === 0) {
                    availableCategories.push({
                      mainSlug: main.slug,
                      mainName: main.name,
                      subSlug: sub.slug,
                      subName: sub.name,
                    });
                  } else {
                    for (const subSub of subSubs) {
                      availableCategories.push({
                        mainSlug: main.slug,
                        mainName: main.name,
                        subSlug: sub.slug,
                        subName: sub.name,
                        subSubSlug: subSub.slug,
                        subSubName: subSub.name,
                      });
                    }
                  }
                }
              }
              
              // Batch assign categories
              const { batchAssignCategories } = await import('@/ai/flows/convertiser-auto-category');
              const batchResults = await batchAssignCategories({
                products: filteredProducts.map((p, idx) => ({
                  id: String(idx),
                  title: p.title,
                  description: p.description,
                })),
                availableCategories,
              });
              
              // Cache results in filteredProducts for later use
              batchResults.forEach((result, idx) => {
                (filteredProducts[idx] as any).__categoryAssignment = result.assignment;
              });
              
              this.addLog('info', `✅ Batch categorization complete for ${batchResults.length} products`);
            } catch (batchErr) {
              this.addLog('warn', `Batch categorization failed: ${batchErr instanceof Error ? batchErr.message : 'Unknown error'}`);
              // Continue without categories - will use uncategorized fallback
            }
          }

          // Step 2: Process each product (create or link) in batches
          const chunks = chunkArray(filteredProducts, 500); // Firestore batch limit
          this.addLog('info', `Processing ${filteredProducts.length} products in ${chunks.length} batches.`);

          for (const chunk of chunks) {
            const batch = adminDb.batch();
            const productsToRecalculate = new Set<string>();
            const newProductsForCache = [];

            for (const sourceProduct of chunk) {
              try {
                // PRIORITY 1: Check for existing product by standard identifiers (EAN/GTIN/UPC/MPN)
                let existingProduct = null;
                let identityHash = '';
                
                // Type-safe access to identifiers
                const productEan = sourceProduct.ean;
                const productGtin = sourceProduct.gtin;
                const productUpc = sourceProduct.upc;
                const productMpn = sourceProduct.mpn;
                
                if (productEan || productGtin || productUpc || productMpn) {
                  existingProduct = await this.findProductByIdentifiers({
                    ean: productEan,
                    gtin: productGtin,
                    upc: productUpc,
                    mpn: productMpn,
                  });
                  
                  if (existingProduct) {
                    this.addLog('info', `Found existing product by identifier (EAN/GTIN): ${existingProduct.id}`);
                  }
                }
                
                // PRIORITY 2: Fallback to identity hash (title + image)
                if (!existingProduct) {
                  identityHash = calculateIdentityHash(
                    sourceProduct.title,
                    sourceProduct.imageUrl
                  );
                  existingProduct = await this.findProductByIdentity(identityHash);
                  
                  if (existingProduct) {
                    this.addLog('info', `Found existing product by identity hash: ${existingProduct.id}`);
                  }
                }

                if (existingProduct) {
                  // Existing product: Create new Deal
                  this.addLog(
                    'info',
                    `Found existing product ${existingProduct.id}, creating new deal`
                  );

                  if (!existingProduct.id || typeof existingProduct.id !== 'string') {
                    throw new Error('Existing product missing valid id');
                  }

                  const { dealData, dealRef } = await this.prepareDeal(existingProduct.id, sourceProduct, source);
                  batch.set(dealRef, dealData);
                  dealsCreated++;
                  dealsToRefine.push(dealRef.id);

                  // Add deal to moderation queue for admin review
                  try {
                    await addToModerationQueue(dealRef.id, 'deal', 'import', 'harvester', 'high');
                    this.addLog('info', `Deal ${dealRef.id} added to moderation queue`);
                  } catch (err) {
                    this.addLog('warn', `Failed to add deal ${dealRef.id} to moderation queue`, err);
                  }

                  // Mark for best price recalculation (batch later)
                  productsToRecalculate.add(existingProduct.id);
                  dealsLinked++;
                } else {
                  // New product: Create ProductCore + Deal
                  this.addLog('info', `Creating new product for: ${sourceProduct.title}`);

                  // Parse category hierarchy from query (e.g., 'electronics/phones/flagship')
                  let categoryInfo: any;
                  
                  if (source === 'convertiser') {
                    const cachedAssignment = (sourceProduct as any).__categoryAssignment;
                    if (cachedAssignment) {
                      categoryInfo = {
                        mainCategorySlug: cachedAssignment.mainCategorySlug,
                        subCategorySlug: cachedAssignment.subCategorySlug,
                        subSubCategorySlug: cachedAssignment.subSubCategorySlug,
                      };
                      this.addLog('info', `✅ Using batch-assigned category: ${categoryInfo.mainCategorySlug}/${categoryInfo.subCategorySlug}`);
                    } else {
                      this.addLog('warn', 'Batch categorization result missing, using uncategorized');
                      categoryInfo = {
                        mainCategorySlug: 'uncategorized',
                        subCategorySlug: 'uncategorized',
                      };
                    }
                  } else {
                    if (currentQuery.includes('/')) {
                      const categoryParts = currentQuery.split('/');
                      categoryInfo = {
                        mainCategorySlug: categoryParts[0] || 'uncategorized',
                        subCategorySlug: categoryParts[1] || 'uncategorized',
                        subSubCategorySlug: categoryParts[2],
                      };
                    } else {
                      categoryInfo = {
                        mainCategorySlug: 'uncategorized',
                        subCategorySlug: 'uncategorized',
                      };
                    }
                  }

                  const { productData, productRef } = await this.prepareProductCore(
                    sourceProduct,
                    identityHash,
                    source,
                    categoryInfo
                  );
                  batch.set(productRef, productData);
                  const productId = productRef.id;
                  productsCreated++;
                  categoryProductsCreated++;
                  productsToRefine.push(productId);

                  // Create associated deal
                  const { dealData, dealRef } = await this.prepareDeal(
                    productId,
                    sourceProduct,
                    source
                  );
                  batch.set(dealRef, dealData);
                  const dealId = dealRef.id;
                  dealsCreated++;
                  dealsToRefine.push(dealId);

                  // Add deal to moderation queue for admin review
                  try {
                    await addToModerationQueue(dealId, 'deal', 'import', 'harvester', 'high');
                    this.addLog('info', `Deal ${dealId} added to moderation queue`);
                  } catch (err) {
                    this.addLog('warn', `Failed to add deal ${dealId} to moderation queue`, err);
                  }

                  // Mark for best price recalculation (batch later)
                  productsToRecalculate.add(productId);

                  // Record identity match for future lookups
                  const { identityMatchData, identityMatchRef } = this.prepareIdentityMatch(
                    identityHash,
                    productId,
                    source,
                    sourceProduct.title,
                    sourceProduct.imageUrl,
                    sourceProduct.sourceProductId
                  );
                  batch.set(identityMatchRef, identityMatchData);
                }

                // Periodic update: Update job status co 5 produktów
                processedCount++;
                const now = Date.now();
                if (processedCount % 20 === 0 || now - lastProgressUpdate >= progressUpdateIntervalMs) { // Throttled updates
                  if (!(await this.isJobActive())) {
                    this.addLog('warn', 'Job stopped externally (paused/cancelled)');
                    // Don't commit the batch if job is stopped.
                    return {
                      id: this.jobId,
                      status: 'paused',
                      source,
                      query: queries.join(', '),
                      maxResults,
                      productsFound,
                      productsCreated,
                      dealsCreated,
                      dealsLinked,
                      duplicatesSkipped,
                      errors,
                      currentCategory: currentQuery,
                      totalCategories: queries.length,
                      processedCategories: processedCategoriesLog,
                      startedAt: jobStartTime,
                      lastUpdatedAt: new Date().toISOString(),
                      logs: this.logs,
                    };
                  }

                  await this.updateJobRecord({
                    id: this.jobId,
                    status: 'running',
                    source,
                    query: queries.join(', '),
                    maxResults,
                    productsFound,
                    productsCreated,
                    dealsCreated,
                    dealsLinked,
                    duplicatesSkipped,
                    errors,
                    currentCategory: currentQuery,
                    totalCategories: queries.length,
                    processedCategories: processedCategoriesLog,
                    startedAt: jobStartTime,
                    lastUpdatedAt: new Date().toISOString(),
                    logs: this.logs,
                  });
                  lastProgressUpdate = now;
                }
              } catch (err) {
                this.addLog(
                  'error',
                  `Failed to process product: ${sourceProduct.title}`,
                  err
                );
                errors.push({
                  productId: sourceProduct.sourceProductId,
                  message: (err as Error).message,
                  timestamp: new Date().toISOString(),
                });
              }
            }

            this.addLog('info', `Committing batch of ${chunk.length} products.`);
            await batch.commit();
            this.addLog('info', 'Batch committed successfully.');

            // Batch update best prices for this chunk
            if (productsToRecalculate.size > 0) {
              this.addLog('info', `Updating bestPrice for ${productsToRecalculate.size} products in batch.`);
              await this.batchUpdateProductBestPrices(Array.from(productsToRecalculate));
            }

            if (dealsToRefine.length >= dealRefinerBatchSize || Date.now() - lastDealRefinerAt >= dealRefinerMinIntervalMs) {
              const batchIds = dealsToRefine.splice(0, dealRefinerBatchSize);
              if (batchIds.length > 0) {
                lastDealRefinerAt = Date.now();
                this.addLog('info', `Uruchamiam Deal Refiner dla ${batchIds.length} ofert (batch/auto)`);
                startDealRefinerJob(batchIds)
                  .then((result) => {
                    this.addLog('info', `Deal Refiner zakończony (batch/auto): ${result.productsSuccessful} OK, ${result.productsFailed} błędów`);
                  })
                  .catch((err) => {
                    this.addLog('error', 'Deal Refiner nie powiódł się (batch/auto)', err);
                  });
              }
            }
          }

            }, categoryTimeoutMs, currentQuery);

            // Log finished category
            processedCategoriesLog.push({
              category: currentQuery,
              count: categoryProductsCreated,
              status: 'ok',
            });
            processedCategorySet.add(currentQuery);
            const durationSec = Math.round((Date.now() - categoryStartTime) / 1000);
            this.addLog('info', `Category completed: ${currentQuery} (${categoryProductsCreated} products) in ${durationSec}s`);

            // Force update after category finish
            await this.updateJobRecord({
              id: this.jobId,
              status: 'running',
              source,
              query: queries.join(', '),
              maxResults,
              productsFound,
              productsCreated,
              dealsCreated,
              dealsLinked,
              duplicatesSkipped,
              errors,
              currentCategory: currentQuery,
              totalCategories: queries.length,
              processedCategories: processedCategoriesLog,
              startedAt: jobStartTime,
              lastUpdatedAt: new Date().toISOString(),
              logs: this.logs,
            });

            categoryCompleted = true;
          } catch (err) {
            this.addLog('warn', `Category attempt failed: ${currentQuery} (${attempt}/${maxCategoryAttempts})`, err);

            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes('InvalidApiPath')) {
              this.addLog('warn', `Pomijam kategorię z InvalidApiPath: ${currentQuery}`);
              processedCategoriesLog.push({
                category: currentQuery,
                count: categoryProductsCreated,
                status: 'skipped',
              });
              processedCategorySet.add(currentQuery);
              await this.updateJobRecord({
                id: this.jobId,
                status: 'running',
                source,
                query: queries.join(', '),
                maxResults,
                productsFound,
                productsCreated,
                dealsCreated,
                dealsLinked,
                duplicatesSkipped,
                errors,
                currentCategory: currentQuery,
                totalCategories: queries.length,
                processedCategories: processedCategoriesLog,
                startedAt: jobStartTime,
                lastUpdatedAt: new Date().toISOString(),
                logs: this.logs,
              });
              categoryCompleted = true;
              continue;
            }

            if (attempt < maxCategoryAttempts) {
              this.addLog('info', `Retrying category: ${currentQuery}`);
              continue;
            }

            this.addLog('error', `Category processing failed: ${currentQuery}`, err);
            errors.push({
              productId: currentQuery,
              message: (err as Error).message,
              timestamp: new Date().toISOString(),
            });
            processedCategoriesLog.push({
              category: currentQuery,
              count: categoryProductsCreated,
              status: 'error',
            });
            processedCategorySet.add(currentQuery);
            await this.updateJobRecord({
              id: this.jobId,
              status: 'running',
              source,
              query: queries.join(', '),
              maxResults,
              productsFound,
              productsCreated,
              dealsCreated,
              dealsLinked,
              duplicatesSkipped,
              errors,
              currentCategory: currentQuery,
              totalCategories: queries.length,
              processedCategories: processedCategoriesLog,
              startedAt: jobStartTime,
              lastUpdatedAt: new Date().toISOString(),
              logs: this.logs,
            });

            categoryCompleted = true;
          }
        }
      }

      // Step 3: Update job record
      const jobEndTime = new Date().toISOString();
      const job: HarvesterJob = {
        id: this.jobId,
        status: 'completed',
        source,
        query: queries.join(', '),
        maxResults,
        productsFound,
        productsCreated,
        dealsCreated,
        dealsLinked,
        duplicatesSkipped,
        errors,
        currentCategory: queries[queries.length - 1] || '',
        totalCategories: queries.length,
        processedCategories: processedCategoriesLog,
        startedAt: jobStartTime,
        completedAt: jobEndTime,
        lastUpdatedAt: jobEndTime,
        logs: this.logs,
      };

      await this.updateJobRecord(job);

      this.addLog(
        'info',
        `Harvest completed: Created ${productsCreated} products, ${dealsCreated} deals (${dealsLinked} linked to existing products)`
      );

      // Trigger asynchronous Deal Refiner for freshly created deals
      if (dealsToRefine.length > 0) {
        this.addLog('info', `Uruchamiam Deal Refiner dla ${dealsToRefine.length} ofert (async)`);
        startDealRefinerJob(dealsToRefine)
          .then((result) => {
            this.addLog('info', `Deal Refiner zakończony (async): ${result.productsSuccessful} OK, ${result.productsFailed} błędów`);
          })
          .catch((err) => {
            this.addLog('error', 'Deal Refiner nie powiódł się w tle', err);
          });
      }

      if (productsToRefine.length > 0) {
        const refinerJobId = `refiner_${this.jobId}`;
        this.addLog('info', `Uruchamiam AI Refiner dla ${productsToRefine.length} produktów (async)`);
        const productRefiner = new AIRefiner(refinerJobId);
        productRefiner.refineProducts(productsToRefine, 'full_enrichment')
          .then((result) => {
            this.addLog('info', `AI Refiner zakończony (async): ${result.productsSuccessful} OK, ${result.productsFailed} błędów`);
          })
          .catch((err) => {
            this.addLog('error', 'AI Refiner nie powiódł się w tle', err);
          });
      }

      return job;
    } catch (err) {
      this.addLog('error', 'Harvest job failed', err);
      const jobEndTime = new Date().toISOString();

      const job: HarvesterJob = {
        id: this.jobId,
        status: 'failed',
        source,
        query,
        maxResults,
        productsFound,
        productsCreated,
        dealsCreated,
        dealsLinked,
        duplicatesSkipped,
        errors,
        startedAt: jobStartTime,
        completedAt: jobEndTime,
        lastUpdatedAt: jobEndTime,
        logs: this.logs,
      };

      await this.updateJobRecord(job);
      throw err;
    }
  }

  /**
   * Fetch products from source API
   * This is a placeholder - integrate with actual AliExpress/Amazon/Allegro APIs
   */
  private async fetchFromSource(
    source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser',
    searchQuery: string,
    maxResults: number,
    isTreeMode: boolean = false,
    convertiserMode?: 'products' | 'offers'
  ): Promise<
    Array<{
      title: string;
      description?: string;
      imageUrl: string;
      price: number;
      currency: string;
      shippingCost: number;
      shippingDays: number;
      sourceProductId: string;
      sourceUrl: string;
      merchantName?: string;
      merchantRating?: number;
      specs?: Record<string, string>;
      rating?: number;
      ratingCount?: number;
      ean?: string;
      gtin?: string;
      upc?: string;
      mpn?: string;
    }>
  > {
    switch (source) {
      case 'aliexpress':
        return await this.fetchFromAliExpress(searchQuery, maxResults, isTreeMode);
      case 'amazon':
        return await this.fetchFromAmazon(searchQuery, maxResults);
      case 'allegro':
        return await this.fetchFromAllegro(searchQuery, maxResults);
      case 'convertiser':
        const mode = convertiserMode || 'products';
        if (searchQuery === '__AUTO_BROWSE__') {
          return await this.fetchFromConvertiserAutoBrowse(maxResults, mode);
        } else if (mode === 'offers') {
          return await this.fetchFromConvertiserOffers(searchQuery, maxResults);
        } else {
          return await this.fetchFromConvertiser(searchQuery, maxResults);
        }
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }

  /**
   * Filter products to keep only top quality ones by rating/ratingCount
   */
  private filterTopQualityProducts(
    products: any[],
    limit: number
  ): any[] {
    return products
      .filter(p => p.rating && p.rating >= 4.0) // Min 4-star rating
      .sort((a, b) => {
        // Sort by: ratingCount (descending) then rating (descending)
        if (b.ratingCount !== a.ratingCount) {
          return (b.ratingCount || 0) - (a.ratingCount || 0);
        }
        return (b.rating || 0) - (a.rating || 0);
      })
      .slice(0, limit);
  }

  /**
   * Fetch products from AliExpress using real API
   * Integrated with production AliExpress client
   * M6 FIX: Converts USD prices to PLN using NBP exchange rates
   */
  private async fetchFromAliExpress(searchQuery: string, maxResults: number, isTreeMode: boolean = false) {
    try {
      const { createAliExpressClient } = await import('@/integrations/aliexpress/client');
      const client = createAliExpressClient();
      
      this.addLog('info', `Fetching from AliExpress: "${searchQuery}" (treeMode=${isTreeMode})`);
      
      // For tree mode: use higher maxResults to fetch more, then filter by rating
      const fetchSize = isTreeMode ? Math.min(maxResults * 2, 100) : Math.min(maxResults, 50);
      
      const response = await client.searchProducts({
        q: searchQuery,
        limit: fetchSize,
        sort: isTreeMode ? 'rating' : 'price_asc', // For tree mode, sort by rating; otherwise by price
        targetLanguage: 'EN', // Fetch in English for better AI translation
        targetCurrency: 'PLN', // Ensure prices are in PLN
        shipToCountry: 'PL'    // Ensure shipping to Poland
      });
      
      if (!response.success || !response.products) {
        this.addLog('error', `AliExpress search failed: ${response.error?.message || 'Unknown error'}`);
        return [];
      }
      
      this.addLog('info', `Found ${response.products.length} products from AliExpress. Fetching deep details for top items...`);
      
      // DEEP FETCH: Get detailed info (HTML descriptions) for top items
      // Keep small batch to avoid long tail latency and rate limits
      const productsToEnrich = response.products.slice(0, 10);
      
      const detailedProducts = await Promise.all(
        productsToEnrich.map(async (p: any) => {
          try {
            // Only fetch details if we have an ID
            const pid = String(p.item_id || p.product_id || '');
            if (!pid) return p;

            // Fetch details (includes HTML description now)
            const details = await client.getProductDetails({
              productId: pid,
              targetCurrency: 'PLN',
              targetLanguage: 'EN',
              shipToCountry: 'PL'
            });

            if (details) {
              return { ...p, ...details }; // Merge details into product
            }
            return p;
          } catch (e) {
            // Fail silently on detail fetch, keep basic info
            return p;
          }
        })
      );
      
      // Transform to RawProduct format
      return await Promise.all(detailedProducts.map(async (p: any) => {
        const parsePriceNumber = (value: any): number => {
          if (value === null || value === undefined || value === '') return 0;
          const num = Number(String(value).replace(',', '.'));
          return Number.isFinite(num) ? num : 0;
        };

        const getMinSkuPrice = (skuList: any): number => {
          if (!Array.isArray(skuList) || skuList.length === 0) return 0;
          let min = Infinity;
          for (const sku of skuList) {
            const candidate = parsePriceNumber(
              sku?.sku_price ??
              sku?.price ??
              sku?.offer_price ??
              sku?.sale_price ??
              sku?.sku_sale_price
            );
            if (candidate > 0 && candidate < min) {
              min = candidate;
            }
          }
          return min === Infinity ? 0 : min;
        };

        const baseCandidates = [
          p.price?.current,
          p.target_sale_price,
          p.sale_price,
          p.app_sale_price,
        ].map(parsePriceNumber).filter((v) => v > 0);

        let rawPrice = baseCandidates.length > 0 ? Math.min(...baseCandidates) : 0;
        const skuMin = getMinSkuPrice(p.sku_list || p.variants);
        if (skuMin > 0 && (rawPrice === 0 || skuMin < rawPrice)) {
          rawPrice = skuMin;
        }
        const rawOriginal = Number(p.price?.original ?? p.original_price ?? 0);
        const rawCurrency = String(p.price?.currency || p.target_sale_price_currency || 'PLN').toUpperCase();
        const rawShipping = Number(p.shipping?.cost ?? 0);
        const shippingCurrency = String(p.shipping?.currency || rawCurrency || 'PLN').toUpperCase();

        const normalizePrice = async (amount: number, currency: string, label: string) => {
          if (!currency || currency === 'PLN') {
            return { amount, currency: 'PLN' };
          }
          try {
            const pln = await convertToPLN(amount, currency as any);
            return { amount: pln, currency: 'PLN' };
          } catch (e) {
            this.addLog('warn', `AliExpress: nie udało się przeliczyć ${label} z ${currency} na PLN`, e);
            return { amount, currency };
          }
        };

        const priceResult = await normalizePrice(rawPrice, rawCurrency, 'ceny');
        const originalResult = rawOriginal > 0
          ? await normalizePrice(rawOriginal, rawCurrency, 'ceny bazowej')
          : { amount: 0, currency: priceResult.currency };
        const shippingResult = await normalizePrice(rawShipping, shippingCurrency, 'wysyłki');

        const originalPrice = rawOriginal > 0 && originalResult.currency === priceResult.currency
          ? originalResult.amount
          : undefined;

        if (rawOriginal > 0 && originalResult.currency !== priceResult.currency) {
          this.addLog('warn', 'AliExpress: pomijam cenę bazową z inną walutą niż cena główna');
        }

        const parsePercent = (value: any): number | undefined => {
          if (value === null || value === undefined || value === '') return undefined;
          const num = Number(String(value).replace('%', '').trim());
          if (!Number.isFinite(num) || num <= 0) return undefined;
          return num > 0 && num <= 1 ? Math.round(num * 100) : Math.round(num);
        };

        const discountPercent = parsePercent(
          (p.discount_percent ?? p.discount ?? p.discount_rate ?? p.promotion_discount)
        );

        const couponCodeRaw =
          p.coupon_code ||
          p.couponCode ||
          p.promo_code ||
          p.promotion_code ||
          p.voucher_code ||
          '';
        const couponCode = String(couponCodeRaw || '').trim() || undefined;

        const parseAmount = (value: any): number | undefined => {
          if (value === null || value === undefined || value === '') return undefined;
          const match = String(value).match(/[-]?[\d.,]+/);
          if (!match) return undefined;
          const num = Number(match[0].replace(',', '.'));
          return Number.isFinite(num) ? num : undefined;
        };

        const minOrderValue = parseAmount(
          p.coupon_min_spend ||
          p.min_spend ||
          p.min_order_amount ||
          p.min_order_value
        );

        const hasCoupons = Boolean(couponCode || parseAmount(p.coupon_amount || p.coupon_discount || p.coupon_value));

        const scrapeTarget = p.product_detail_url || p.product_url || p.promotion_link || '';
        const shouldScrape = (!p.product_description || !p.product_props) && Boolean(scrapeTarget);
        const scraped = shouldScrape ? await this.scrapeAliExpressPage(scrapeTarget) : {};

        // Phase 1A: Extract specs from title + product properties + SKU
        const specsFromTitle = extractDimensionsFromTitle(p.title || p.product_title || '');
        const specsFromProps = this.extractPropsFromProductProps(p.product_props);
        const skuPriceRange = this.extractSkuPriceRange(p.sku_list);
        
        // Consolidate specs - add fallback to variants/sku_list if no props
        const specs: Record<string, string> = {
          ...specsFromTitle,
          ...specsFromProps,
        };

        if (scraped?.specs) {
          Object.entries(scraped.specs).forEach(([key, value]) => {
            if (!specs[key]) {
              specs[key] = value;
            }
          });
        }
        
        // Fallback: extract specs from variant sizes if available
        if (Object.keys(specs).length === 0 && Array.isArray(p.sku_list) && p.sku_list.length > 0) {
          const firstSku = p.sku_list[0];
          if (firstSku?.sku_code) {
            specs['Wariant'] = firstSku.sku_code;
          }
          if (firstSku?.sku_name) {
            specs['Typ'] = firstSku.sku_name;
          }
        }
        
        // Add price range if multiple variants exist
        if (skuPriceRange && skuPriceRange.minPrice < skuPriceRange.maxPrice) {
          specs.priceRange = `${Math.floor(skuPriceRange.minPrice)}-${Math.floor(skuPriceRange.maxPrice)} PLN`;
        }

        // Phase 1D: Consolidate image gallery from multiple sources
        const consolidated = this.consolidateImageGallery(p);
        const scrapedImages = Array.isArray(scraped?.images) ? scraped.images : [];
        const scrapedMainImage = scraped?.mainImage || '';
        const images = consolidated.images.length > 0 ? consolidated.images : scrapedImages;
        const mainImage = consolidated.mainImage || scrapedMainImage || images[0] || '';
        
        // Fallback image sources if consolidation returns empty
        const fallbackImageUrl = mainImage
          || (Array.isArray(images) && images.length > 0 ? images[0] : '');

        // Phase 1E: Get minimum available quantity across variants
        const minAvailableQty = this.getMinimumAvailableQuantity(p.sku_list || []);

        const finalImages = Array.isArray(images) && images.length > 0
          ? images
          : (fallbackImageUrl ? [fallbackImageUrl] : []);

        return {
          title: p.title || p.product_title || '',
          description: p.product_description || scraped?.description || '', // RAW HTML from Deep Fetch or scrape fallback
          imageUrl: fallbackImageUrl,
          images: finalImages,
          price: priceResult.amount,
          originalPrice,
          currency: priceResult.currency,
          shippingCost: shippingResult.amount,
          shippingDays: p.ship_to_days || 7, // Default estimate
          sourceProductId: String(p.item_id || p.product_id || ''),
          sourceUrl: p.product_url || p.product_detail_url || p.promotion_link || '',
          videoUrl: p.product_video_url || p.video_url || undefined,
          merchantName: p.store_info?.store_name || 'AliExpress',
          merchantRating: p.store_info?.score || 4.0,
          specs,
          discountPercent,
          couponCode,
          freeShipping: p.shipping?.free === true || shippingResult.amount === 0,
          minOrderValue: typeof minOrderValue === 'number' && minOrderValue > 0 ? minOrderValue : undefined,
          offerMeta: hasCoupons || minAvailableQty ? {
            promotionType: 'offer',
            previewUrl: p.promotion_link || p.product_url || undefined,
            hasCoupons: hasCoupons,
            minimumAvailableQuantity: minAvailableQty,
          } : undefined,
          rating: (() => {
            // Robust rating parser handling 0-5 and 0-100 scales
            if (p.rating?.score) return Number(p.rating.score);
            if (p.evaluate_rate) {
              const parsed = parseFloat(String(p.evaluate_rate).replace('%', ''));
              // If likely 0-100 scale (e.g. "95", "4.8/5" parsed as 4.8)
              // Heuristic: If > 5, assumes 0-100 scale -> divide by 20.
              if (!isNaN(parsed)) return parsed > 5 ? parsed / 20 : parsed;
            }
            return 0;
          })(),
          ratingCount: p.rating?.count || p.volume || 0,
          variants: Array.isArray(p.variants) ? p.variants : (p.sku_list || undefined), // Product variants (colors, sizes)
          // Product identifiers (for robust deduplication & SEO)
          sku: p.sku || undefined,
          ean: p.ean || p.barcode || undefined,
          gtin: p.gtin || undefined,
          upc: p.upc || undefined,
          mpn: p.mpn || p.manufacturer_part_number || undefined,
        };
      }));
    } catch (error) {
      this.addLog('error', `AliExpress API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Fetch products from Amazon
   * NOTE: Amazon PA API requires separate account setup
   */
  private async fetchFromAmazon(searchQuery: string, maxResults: number) {
    this.addLog('warn', 'Amazon API not configured - requires PA API credentials');
    // Amazon Product Advertising API integration pending
    return [];
  }

  /**
   * Fetch products from Allegro
   * NOTE: Allegro REST API requires Polish marketplace setup
   */
  private async fetchFromAllegro(searchQuery: string, maxResults: number) {
    this.addLog('warn', 'Allegro API not configured - requires OAuth setup');
    // Allegro REST API integration pending
    return [];
  }

  /**
   * Fetch products from Convertiser
   * Convertiser is an affiliate network with multi-marketplace product discovery
   */
  private async fetchFromConvertiser(searchQuery: string, maxResults: number) {
    try {
      // Check if token is available before importing client
      if (!process.env.CONVERTISER_API_TOKEN) {
        this.addLog('warn', 'Convertiser API token not configured (CONVERTISER_API_TOKEN env var missing)');
        return [];
      }

      const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
      const client = getConvertiserClient();

      this.addLog('info', `Fetching from Convertiser: "${searchQuery}"`);

      // Convertiser has "Search Products" endpoint for product discovery
      // Try v2 first (better data), fallback to v1 if not available
      let response: any;
      try {
        response = await client.searchProductsV2(
          {
            query: searchQuery,
            country: 'PL', // Polish marketplace
          },
          {
            page: 1,
            page_size: Math.min(maxResults, 50),
          }
        );
      } catch (v2Error) {
        this.addLog('warn', `Convertiser v2 API failed: ${v2Error instanceof Error ? v2Error.message : 'Unknown'} - Trying v1`);
        // Fallback to v1
        response = await client.searchProducts(
          {
            query: searchQuery,
            country: 'PL',
          },
          {
            page: 1,
            page_size: Math.min(maxResults, 50),
          }
        );
      }

      // Convertiser v2 returns products in 'data' field, not 'results'
      const products = (response as any).data || response.results || [];

      if (!products || products.length === 0) {
        this.addLog('warn', `Convertiser: No products found for "${searchQuery}"`);
        return [];
      }

      this.addLog('info', `Found ${products.length} products from Convertiser`);

      // Transform Convertiser products to RawProduct format
      // Use Promise.all for async currency conversion
      const rawProducts = await Promise.all(
        products.map(async (product: any) => {
          try {
            const title = product.title || product.name || '';
            if (!title) {
              await this.recordDiscardedItem({
                source: 'convertiser',
                type: 'product',
                reason: 'Brak tytułu produktu w danych źródłowych.',
                reasonCode: 'missing_title',
                item: {
                  title: '',
                  sourceProductId: String(product.id || product.uuid || product.product_id || product.offer_id || product.sku || ''),
                  sourceUrl: product.direct_link || product.link || product.url || '',
                  merchantName: product.offer || product.merchant || product.store_name || 'Convertiser',
                },
                query: searchQuery,
              });
              return null;
            }

            // Convertiser images are in 'images.default' or 'image_link'
            const imageUrl = product.images?.default || product.image_link || product.image_url || '';
            // Skip products without valid image URL (required for identity hash)
            if (!imageUrl || imageUrl.trim() === '') {
              await this.recordDiscardedItem({
                source: 'convertiser',
                type: 'product',
                reason: 'Brak zdjęcia produktu w danych źródłowych.',
                reasonCode: 'missing_image',
                item: {
                  title,
                  sourceProductId: String(product.id || product.sku || ''),
                  sourceUrl: product.direct_link || product.link || product.url || '',
                  merchantName: product.offer || product.merchant || product.store_name || 'Convertiser',
                },
                query: searchQuery,
              });
              return null;
            }

            // Parse price and currency from "PLN 199.99" or "USD 199.99" format
            const parsePriceWithCurrency = (priceStr: string): { amount: number; currency: string } => {
              if (!priceStr) return { amount: 0, currency: 'PLN' };
              const str = String(priceStr);
              // Try to extract currency code (3 letters at start)
              const currencyMatch = str.match(/^([A-Z]{3})\s*([\d.,]+)/);
              if (currencyMatch) {
                return {
                  currency: currencyMatch[1],
                  amount: parseFloat(currencyMatch[2].replace(',', '.')),
                };
              }

              const amountMatch = str.match(/([\d.,]+)/);
              const fallbackAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;
              const fallbackCurrency = String(product.currency || 'PLN').toUpperCase();
              return {
                currency: fallbackCurrency,
                amount: fallbackAmount,
              };
            };

            const priceRaw =
              product.sale_price ||
              product.price ||
              product.current_price ||
              product.offer_price ||
              product.price_value ||
              product.price_amount ||
              '';

            const originalPriceRaw =
              product.original_price ||
              product.regular_price ||
              product.old_price ||
              product.list_price ||
              '';

            const shippingRaw =
              product.shipping_cost ||
              product.shipping_price ||
              product.shipping ||
              '';

            const parsedPrice = parsePriceWithCurrency(priceRaw);
            const parsedOriginal = parsePriceWithCurrency(originalPriceRaw);
            const parsedShipping = parsePriceWithCurrency(shippingRaw);

            const pricePLN = await convertToPLN(parsedPrice.amount, parsedPrice.currency);
            const originalPricePLN = parsedOriginal.amount > 0
              ? await convertToPLN(parsedOriginal.amount, parsedOriginal.currency)
              : 0;
            const shippingPLN = parsedShipping.amount > 0
              ? await convertToPLN(parsedShipping.amount, parsedShipping.currency)
              : 0;

            const description = product.description || product.short_description || '';
            const specs = product.specs || product.attributes || product.parameters || undefined;

            const ratingRaw = product.rating || product.rating_score || product.evaluate_rate || 0;
            const ratingCountRaw = product.rating_count || product.evaluate_count || product.review_count || 0;

            return {
              title,
              description,
              imageUrl,
              price: pricePLN,
              originalPrice: originalPricePLN > pricePLN ? originalPricePLN : undefined,
              currency: 'PLN',
              shippingCost: shippingPLN,
              shippingDays: Number(product.shipping_days || product.delivery_days || 0),
              sourceProductId: String(
                product.id ||
                product.uuid ||
                product.product_id ||
                product.offer_id ||
                product.sku ||
                ''
              ),
              sourceUrl: product.direct_link || product.link || product.url || '',
              merchantName: product.offer || product.merchant || product.store_name || product.brand || 'Convertiser',
              merchantRating: Number(product.merchant_rating || 0),
              specs,
              rating: Number(ratingRaw) || 0,
              ratingCount: Number(ratingCountRaw) || 0,
              images: Array.isArray(product.images)
                ? product.images
                : (product.image_urls || [imageUrl]),
              variants: Array.isArray(product.variants) ? product.variants : (product.sku_list || undefined),
              sku: product.sku || undefined,
              ean: product.ean || product.barcode || undefined,
              gtin: product.gtin || undefined,
              upc: product.upc || undefined,
              mpn: product.mpn || product.manufacturer_part_number || undefined,
            } as RawProduct;
          } catch (error) {
            this.addLog('warn', `Convertiser product parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
          }
        })
      );

      return (rawProducts.filter(Boolean) as RawProduct[]).slice(0, maxResults);
    } catch (error) {
      this.addLog('error', `Convertiser API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Fetch offers from Convertiser (affiliate offers)
   */
  private async fetchFromConvertiserOffers(searchQuery: string, maxResults: number) {
    try {
      if (!process.env.CONVERTISER_API_TOKEN) {
        this.addLog('warn', 'Convertiser API token not configured (CONVERTISER_API_TOKEN env var missing)');
        return [];
      }

      const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
      const client = getConvertiserClient();

      this.addLog('info', `Fetching Convertiser offers: "${searchQuery}"`);

      let response: any;
      try {
        response = await client.findOffers({
          query: searchQuery,
          q: searchQuery,
          country: 'PL',
        });
      } catch (err) {
        this.addLog('warn', `Convertiser offers find failed: ${err instanceof Error ? err.message : 'Unknown'} - falling back to listOffers`);
        response = await client.listOffers(
          { page: 1, page_size: Math.min(maxResults, 50) },
          { country: 'PL' }
        );
      }

      const offers = (response as any).results || (response as any).data || [];
      if (!offers || offers.length === 0) {
        this.addLog('warn', `Convertiser: No offers found for "${searchQuery}"`);
        return [];
      }

      const mapped = offers
        .map((offer: any) => this.mapConvertiserOfferToRawProduct(offer))
        .filter(Boolean) as RawProduct[];

      return mapped.slice(0, maxResults);
    } catch (error) {
      this.addLog('error', `Convertiser offers API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Fetch Convertiser catalog without keyword filtering
   */
  private async fetchFromConvertiserAutoBrowse(maxResults: number, mode: 'products' | 'offers') {
    if (mode === 'offers') {
      return this.fetchFromConvertiserOffers('', maxResults);
    }

    try {
      if (!process.env.CONVERTISER_API_TOKEN) {
        this.addLog('warn', 'Convertiser API token not configured (CONVERTISER_API_TOKEN env var missing)');
        return [];
      }

      const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
      const client = getConvertiserClient();

      this.addLog('info', 'Auto-browse Convertiser catalog (products)');

      let response: any;
      try {
        response = await client.searchProductsV2(
          { country: 'PL' },
          { page: 1, page_size: Math.min(maxResults, 50) }
        );
      } catch (v2Error) {
        this.addLog('warn', `Convertiser v2 auto-browse failed: ${v2Error instanceof Error ? v2Error.message : 'Unknown'} - Trying v1`);
        response = await client.searchProducts(
          { country: 'PL' },
          { page: 1, page_size: Math.min(maxResults, 50) }
        );
      }

      const products = (response as any).data || response.results || [];
      if (!products || products.length === 0) {
        this.addLog('warn', 'Convertiser auto-browse: no products found');
        return [];
      }

      const rawProducts = await Promise.all(
        products.map(async (product: any) => {
          try {
            const title = product.title || product.name || '';
            if (!title) return null;
            const imageUrl = product.images?.default || product.image_link || product.image_url || '';
            if (!imageUrl || imageUrl.trim() === '') return null;

            const parsePriceWithCurrency = (priceStr: string): { amount: number; currency: string } => {
              if (!priceStr) return { amount: 0, currency: 'PLN' };
              const str = String(priceStr);
              const currencyMatch = str.match(/^([A-Z]{3})\s*([\d.,]+)/);
              if (currencyMatch) {
                return {
                  currency: currencyMatch[1],
                  amount: parseFloat(currencyMatch[2].replace(',', '.')),
                };
              }
              const amountMatch = str.match(/([\d.,]+)/);
              const fallbackAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;
              const fallbackCurrency = String(product.currency || 'PLN').toUpperCase();
              return {
                currency: fallbackCurrency,
                amount: fallbackAmount,
              };
            };

            const priceRaw = product.sale_price || product.price || product.current_price || '';
            const parsedPrice = parsePriceWithCurrency(priceRaw);
            const pricePLN = await convertToPLN(parsedPrice.amount, parsedPrice.currency);

            return {
              title,
              description: product.description || product.short_description || '',
              imageUrl,
              price: pricePLN,
              currency: 'PLN',
              shippingCost: 0,
              shippingDays: Number(product.shipping_days || product.delivery_days || 0),
              sourceProductId: String(product.id || product.uuid || product.product_id || product.sku || ''),
              sourceUrl: product.direct_link || product.link || product.url || '',
              merchantName: product.offer || product.merchant || product.store_name || product.brand || 'Convertiser',
              merchantRating: Number(product.merchant_rating || 0),
              specs: product.specs || product.attributes || product.parameters || undefined,
              rating: Number(product.rating || product.rating_score || 0),
              ratingCount: Number(product.rating_count || product.evaluate_count || 0),
              images: Array.isArray(product.images) ? product.images : (product.image_urls || [imageUrl]),
              variants: Array.isArray(product.variants) ? product.variants : (product.sku_list || undefined),
              sku: product.sku || undefined,
              ean: product.ean || product.barcode || undefined,
              gtin: product.gtin || undefined,
              upc: product.upc || undefined,
              mpn: product.mpn || product.manufacturer_part_number || undefined,
            } as RawProduct;
          } catch (error) {
            this.addLog('warn', `Convertiser auto-browse parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
          }
        })
      );

      return (rawProducts.filter(Boolean) as RawProduct[]).slice(0, maxResults);
    } catch (error) {
      this.addLog('error', `Convertiser auto-browse API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
}

/**
 * Helper function to start a new harvester job
 * Creates a SmartHarvester instance and runs it
 */
export async function startHarvesterJob(
  source: string,
  query: string,
  maxResults: number = 50
): Promise<HarvesterJob> {
  const jobId = `harvest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const harvester = new SmartHarvester(jobId);
  return harvester.harvestProducts(
    source as 'aliexpress' | 'amazon' | 'allegro' | 'convertiser',
    query,
    maxResults
  );
}
