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
      if (label && value) out.push({ label: String(label), value: String(value) });
    }
  } else if (typeof props === 'string') {
    // "Key: Value; Key2: Value2"
    props.split(/;|\n/).forEach((pair: string) => {
      const [k, v] = pair.split(/:\s*/);
      if (k && v) out.push({ label: k.trim(), value: v.trim() });
    });
  }
  return out;
}

export function mapAliExpressResponseToProduct(raw: any): UniversalProduct {
  const productId = String(raw.product_id || raw.productId || raw.item_id || '');
  const title = String(raw.product_title || raw.title || '').trim();
  const detailsUrl = raw.promotion_link || raw.product_detail_url || raw.productUrl;
  const { main, all } = parseImages(raw);
  const video = raw.product_video_url || raw.productVideoUrl;
  const shipDaysRaw = raw.ship_to_days || raw.deliveryDays;
  const shipDays = typeof shipDaysRaw === 'string' ? parseInt(shipDaysRaw, 10) : shipDaysRaw;
  const currentPLNFloat = parseFloat(String(raw.target_sale_price ?? raw.sale_price ?? '0')) || 0;
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

  const nowIso = new Date().toISOString();
  const priceHistory: z.infer<typeof PriceHistoryEntrySchema>[] = [
    { date: nowIso, price: currentCents, currency: 'PLN' },
  ];

  const candidate: UniversalProduct = {
    externalId: productId,
    source: 'aliexpress',
    sourceUrl: detailsUrl,
    title: { pl: title },
    specifications,
    gallery,
    thumbnail: main,
    price: {
      current: currentCents,
      original: originalCents,
      currency: 'PLN',
      discount,
    },
    logistics: shipDays ? {
      deliveryDays: shipDays,
      isFreeShipping: false,
      shippingCost: 0,
    } : undefined,
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
