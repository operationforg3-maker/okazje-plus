/**
 * AliExpress → Universal Product Schema mapper (Single Source of Truth)
 */
import { z } from 'zod';
import { ProductSchema, GalleryItemSchema, SpecificationSchema, PriceHistoryEntrySchema } from '@/lib/schema';
import { logger } from '@/lib/logging';

export type UniversalProduct = z.infer<typeof ProductSchema>;

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.filter(Boolean) as T[]));
}

function parseImages(raw: any): { main?: string; all: string[] } {
  const main = raw.product_main_image_url || raw.image_url;
  let all: string[] = [];
  const fromAll = raw.all_images || raw.product_small_image_urls || raw.productSmallImageUrls;
  if (typeof fromAll === 'string') {
    all = fromAll.split(/[,;\s]+/).filter(Boolean);
  } else if (Array.isArray(fromAll)) {
    all = fromAll.filter(Boolean);
  }
  const merged = unique([main, ...all]);
  return { main, all: merged };
}

function parseProps(raw: any): Array<z.infer<typeof SpecificationSchema>> {
  const props = raw.product_props || raw.attribute_list || raw.attributeList;
  const out: Array<z.infer<typeof SpecificationSchema>> = [];
  if (!props) return out;
  if (Array.isArray(props)) {
    for (const p of props) {
      const label = p.attrName || p.name || p.key || p.label;
      const value = p.attrValue || p.value || p.val;
      // M6+: Filter out junk keys (IDs, empty values)
      if (label && value && !String(label).toLowerCase().startsWith('id_')) {
        out.push({ label: String(label), value: String(value) });
      }
    }
  } else if (typeof props === 'string') {
    // "Key: Value; Key2: Value2"
    props.split(/;|\n/).forEach((pair: string) => {
      const [k, v] = pair.split(/:\s*/);
      if (k && v && !k.toLowerCase().startsWith('id_')) {
        out.push({ label: k.trim(), value: v.trim() });
      }
    });
  }
  return out;
}

// M6+: Parse attributes (alternative simple key-value format)
function parseAttributes(raw: any): Array<{ name: string; value: string }> {
  const props = raw.product_props || raw.attribute_list || raw.attributeList;
  const out: Array<{ name: string; value: string }> = [];
  if (!props) return out;
  if (Array.isArray(props)) {
    for (const p of props) {
      const name = p.attrName || p.name || p.key || p.label;
      const value = p.attrValue || p.value || p.val;
      if (name && value && !String(name).toLowerCase().startsWith('id_')) {
        out.push({ name: String(name), value: String(value) });
      }
    }
  }
  return out;
}

// M6+: Parse seller info from store_info
function parseSeller(raw: any): any {
  const storeInfo = raw.store_info || raw.storeInfo;
  if (!storeInfo) return undefined;
  
  return {
    name: storeInfo.store_name || storeInfo.storeName || 'Unknown Store',
    score: storeInfo.store_score || storeInfo.score || storeInfo.rating,
    positiveRate: storeInfo.positive_rate || storeInfo.positiveRate,
    storeId: String(storeInfo.store_id || storeInfo.storeId || ''),
    storeUrl: storeInfo.store_url || storeInfo.storeUrl,
  };
}

// M6+: Parse warehouses from ships_from_countries
function parseWarehouses(raw: any): string[] {
  const countries = raw.ships_from_countries || raw.shipsFromCountries;
  if (!countries) return [];
  if (typeof countries === 'string') {
    return countries.split(/[,;\s]+/).filter(Boolean).map(c => c.trim().toUpperCase());
  }
  if (Array.isArray(countries)) {
    return countries.filter(Boolean).map(c => String(c).trim().toUpperCase());
  }
  return [];
}

// M6+: Find best price from SKU list (often lower than main price)
function findBestPriceFromSKU(raw: any): number | null {
  const skuList = raw.sku_list || raw.skuList;
  if (!Array.isArray(skuList) || skuList.length === 0) return null;
  
  let minPrice = Infinity;
  for (const sku of skuList) {
    const price = parseFloat(String(sku.sku_price || sku.price || '0'));
    if (price > 0 && price < minPrice) {
      minPrice = price;
    }
  }
  return minPrice === Infinity ? null : minPrice;
}

export function mapAliExpressResponseToProduct(raw: any): UniversalProduct {
  const productId = String(raw.product_id || raw.productId || raw.item_id || '');
  const title = String(raw.product_title || raw.title || '').trim();
  const detailsUrl = raw.promotion_link || raw.product_detail_url || raw.productUrl;
  const { main, all } = parseImages(raw);
  const video = raw.product_video_url || raw.productVideoUrl;
  const shipDaysRaw = raw.ship_to_days || raw.deliveryDays;
  const shipDays = typeof shipDaysRaw === 'string' ? parseInt(shipDaysRaw, 10) : shipDaysRaw;
  
  // M6+: Prefer SKU list price if available (often lower)
  const skuBestPrice = findBestPriceFromSKU(raw);
  const currentPLNFloat = skuBestPrice || parseFloat(String(raw.target_sale_price ?? raw.sale_price ?? '0')) || 0;
  const originalPLNFloat = parseFloat(String(raw.original_price ?? raw.target_original_price ?? '0')) || 0;

  // Convert to integer grosze as required
  const currentCents = Math.round(currentPLNFloat * 100);
  const originalCents = originalPLNFloat ? Math.round(originalPLNFloat * 100) : undefined;
  const discount = raw.discount ? parseInt(String(raw.discount), 10) : (originalCents && originalCents > currentCents
    ? Math.round(((originalCents - currentCents) / originalCents) * 100)
    : undefined);

  // Build gallery: video first if present
  const gallery: z.infer<typeof GalleryItemSchema>[] = [];
  if (video) {
    gallery.push({ url: String(video), type: 'VIDEO', thumbnail: main });
  }
  for (const url of all) {
    if (!url) continue;
    gallery.push({ url: String(url), type: 'IMAGE' });
  }

  const specifications = parseProps(raw);
  const attributes = parseAttributes(raw); // M6+: Alternative attributes format
  const seller = parseSeller(raw); // M6+: Seller trust data
  const warehouses = parseWarehouses(raw); // M6+: Warehouse locations
  const rawShippingCost = parseFloat(String(raw.shipping_cost ?? raw.shipping_price ?? raw.freight_amount ?? 'NaN'));
  const hasShippingCost = Number.isFinite(rawShippingCost) && rawShippingCost >= 0;

  // M6+: Marketing data (sales volume)
  const ordersCount = raw.lastest_volume ? parseInt(String(raw.lastest_volume), 10) : (raw.orders_count ? parseInt(String(raw.orders_count), 10) : 0);
  const marketing = { ordersCount: isNaN(ordersCount) ? 0 : ordersCount };

  const nowIso = new Date().toISOString();
  const priceHistory: z.infer<typeof PriceHistoryEntrySchema>[] = [
    { date: nowIso, price: currentCents, currency: 'PLN' },
  ];

  const candidate: UniversalProduct = {
    externalId: productId,
    source: 'aliexpress',
    sourceUrl: detailsUrl,
    title: { pl: title },
    videoUrl: video || undefined, // M6+: Direct video URL
    specifications,
    attributes, // M6+: Simple key-value attributes
    gallery,
    thumbnail: main,
    price: {
      current: currentCents,
      original: originalCents,
      currency: 'PLN',
      discount,
    },
    logistics: (shipDays || hasShippingCost) ? {
      deliveryDays: shipDays || 7,
      isFreeShipping: hasShippingCost ? rawShippingCost === 0 : false,
      shippingCost: hasShippingCost ? Math.round(rawShippingCost * 100) / 100 : 0,
    } : undefined,
    seller, // M6+: Seller info
    warehouses, // M6+: ['PL', 'CZ', 'CN']
    marketing, // M6+: Social Proof (Orders count)
    priceHistory,
    status: 'draft',
    importedAt: nowIso,
    updatedAt: nowIso,
  };

  const parsed = ProductSchema.safeParse(candidate);
  if (!parsed.success) {
    const messages = parsed.error.issues.map(i => `${i.path.join('.')} - ${i.message}`).join('; ');
    logger.error('AliExpress → ProductSchema validation failed', { messages, productId });
    throw new Error(`ProductSchema validation failed: ${messages}`);
  }
  return parsed.data;
}
