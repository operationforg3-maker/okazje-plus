import { adminDb } from '@/lib/firebase-admin';
import {
  matchCategoryByExternalIds,
  matchCategoryByText,
} from '@/lib/category-mapper';
import fs from 'node:fs';
import path from 'node:path';

type FireDoc = Record<string, any>;
type FireEntity = FireDoc & { id: string };

type CategoryNode = {
  slug: string;
  subcategories?: CategoryNode[];
};

type CategoryTreeFile = {
  tree?: CategoryNode[];
};

type ProductFix = {
  id: string;
  updates: Record<string, any>;
  reasons: string[];
};

type DealFix = {
  id: string;
  updates: Record<string, any>;
  reasons: string[];
};

const APPLY = process.argv.includes('--apply');
const ONLY_ALIEXPRESS = !process.argv.includes('--all-sources');
const LIMIT = Number.parseInt(
  (process.argv.find((arg) => arg.startsWith('--limit=')) || '').split('=')[1] || '0',
  10
);

function loadCategoryIndex() {
  const inputPath = process.env.CATEGORY_TREE_PATH || 'category-tree-seo-extended.json';
  const absolutePath = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);

  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as CategoryTreeFile;
  const tree = Array.isArray(parsed.tree) ? parsed.tree : [];

  const validMain = new Set<string>();
  const validSubByMain = new Map<string, Set<string>>();
  const validSubSubByPath = new Map<string, Set<string>>();

  for (const main of tree) {
    validMain.add(main.slug);
    const subSet = new Set<string>();

    for (const sub of main.subcategories || []) {
      subSet.add(sub.slug);
      const key = `${main.slug}::${sub.slug}`;
      validSubSubByPath.set(
        key,
        new Set((sub.subcategories || []).map((node) => node.slug))
      );
    }

    validSubByMain.set(main.slug, subSet);
  }

  return { validMain, validSubByMain, validSubSubByPath };
}

const categoryIndex = loadCategoryIndex();

function isValidCategoryPath(
  mainCategorySlug?: string | null,
  subCategorySlug?: string | null,
  subSubCategorySlug?: string | null
): boolean {
  if (!mainCategorySlug || mainCategorySlug === 'uncategorized') return true;
  if (!categoryIndex.validMain.has(mainCategorySlug)) return false;

  if (!subCategorySlug || subCategorySlug === 'uncategorized') return true;
  const validSub = categoryIndex.validSubByMain.get(mainCategorySlug);
  if (!validSub || !validSub.has(subCategorySlug)) return false;

  if (!subSubCategorySlug || subSubCategorySlug === 'uncategorized') return true;
  const key = `${mainCategorySlug}::${subCategorySlug}`;
  const validSubSub = categoryIndex.validSubSubByPath.get(key);
  if (!validSubSub || validSubSub.size === 0) return true;
  return validSubSub.has(subSubCategorySlug);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object') {
    const candidate = (value as { amount?: unknown }).amount;
    return toNumber(candidate);
  }
  return 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function asText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.pl, obj.en, obj.de, ...Object.values(obj)]
      .filter((v) => typeof v === 'string')
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (candidates.length > 0) return candidates[0];
  }
  return '';
}

function localized(value: unknown, locale: string): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const direct = obj[locale];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const fallback = [obj.pl, obj.en, obj.de]
      .find((entry) => typeof entry === 'string' && String(entry).trim().length > 0);
    if (typeof fallback === 'string') return fallback.trim();
  }
  return '';
}

function buildSearchTags(product: FireDoc): string[] {
  const rawParts = [
    localized(product.title, 'pl'),
    localized(product.title, 'en'),
    localized(product.shortDescription, 'pl'),
    localized(product.fullDescription, 'pl'),
    ...Object.keys((product.specs || {}) as Record<string, string>),
    ...Object.values((product.specs || {}) as Record<string, string>),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = rawParts
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && token.length <= 32);

  return Array.from(new Set(tokens)).slice(0, 30);
}

function buildSeoDescription(product: FireDoc): string {
  const title = localized(product.title, 'pl') || localized(product.title, 'en') || 'Produkt';
  const description =
    localized(product.description, 'pl') ||
    localized(product.fullDescription, 'pl') ||
    localized(product.shortDescription, 'pl') ||
    localized(product.description, 'en') ||
    localized(product.fullDescription, 'en');

  const base = description || `Sprawdź najlepsze oferty na ${title} i porównaj ceny.`;
  return base.length > 160 ? `${base.slice(0, 157)}...` : base;
}

async function resolveCategory(data: FireDoc): Promise<{
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug?: string;
} | null> {
  const metadata = (data.metadata || {}) as Record<string, unknown>;

  const externalAliId =
    String(metadata.aliexpressCategoryId || '').trim() ||
    String((Array.isArray(metadata.aliexpressCategoryIds) ? metadata.aliexpressCategoryIds[0] : '') || '').trim();

  const external = await matchCategoryByExternalIds({
    googleCategoryId: Number.isFinite(Number(metadata.googleCategoryId))
      ? Number(metadata.googleCategoryId)
      : undefined,
    aliexpressCategoryId: externalAliId || undefined,
  });

  if (external?.mainCategorySlug) {
    if (external.mainCategorySlug === 'uncategorized' || external.subCategorySlug === 'uncategorized') {
      return null;
    }
    const valid = isValidCategoryPath(
      external.mainCategorySlug,
      external.subCategorySlug || null,
      external.subSubCategorySlug || null
    );
    if (valid) {
      return {
        mainCategorySlug: external.mainCategorySlug,
        subCategorySlug: external.subCategorySlug || 'uncategorized',
        subSubCategorySlug: external.subSubCategorySlug || undefined,
      };
    }
  }

  const text = [
    asText(data.title),
    asText(data.description),
    asText(data.shortDescription),
    asText(data.fullDescription),
    asText(metadata.originalCategoryName),
    asText(data.mainCategorySlug),
    asText(data.subCategorySlug),
  ]
    .filter(Boolean)
    .join(' ');

  if (!text) return null;

  const textMatch = await matchCategoryByText(text);
  if (!textMatch?.mainCategorySlug) return null;
  if (textMatch.mainCategorySlug === 'uncategorized' || textMatch.subCategorySlug === 'uncategorized') {
    return null;
  }

  const valid = isValidCategoryPath(
    textMatch.mainCategorySlug,
    textMatch.subCategorySlug || null,
    textMatch.subSubCategorySlug || null
  );

  if (!valid) return null;

  return {
    mainCategorySlug: textMatch.mainCategorySlug,
    subCategorySlug: textMatch.subCategorySlug || 'uncategorized',
    subSubCategorySlug: textMatch.subSubCategorySlug || undefined,
  };
}

async function buildProductFixes(products: FireDoc[]): Promise<ProductFix[]> {
  const fixes: ProductFix[] = [];

  for (const product of products) {
    const updates: Record<string, any> = {};
    const reasons: string[] = [];

    const main = String(product.mainCategorySlug || '');
    const sub = String(product.subCategorySlug || '');
    const subSub = String(product.subSubCategorySlug || '');

    const categoryValid = isValidCategoryPath(main || undefined, sub || undefined, subSub || undefined);
    const needsCategoryRepair = !categoryValid || !main || !sub || !subSub;

    if (needsCategoryRepair) {
      const resolved = await resolveCategory(product);
      if (resolved) {
        const nextMain = resolved.mainCategorySlug;
        const nextSub = resolved.subCategorySlug;
        const nextSubSub = resolved.subSubCategorySlug || null;
        const currentSubSub = product.subSubCategorySlug || null;
        const changed =
          main !== nextMain ||
          sub !== nextSub ||
          currentSubSub !== nextSubSub;

        if (changed) {
          updates.mainCategorySlug = nextMain;
          updates.subCategorySlug = nextSub;
          updates.subSubCategorySlug = nextSubSub;
          reasons.push('category');
        }
      }
    }

    if (!asText(product.seoTitle)) {
      const title = localized(product.title, 'pl') || localized(product.title, 'en') || 'Produkt';
      updates.seoTitle = `${title} - porownanie cen`;
      reasons.push('seoTitle');
    }

    if (!asText(product.seoDescription)) {
      updates.seoDescription = buildSeoDescription(product);
      reasons.push('seoDescription');
    }

    if (!Array.isArray(product.searchTags) || product.searchTags.length === 0) {
      const tags = buildSearchTags(product);
      if (tags.length > 0) {
        updates.searchTags = tags;
        reasons.push('searchTags');
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      fixes.push({ id: product.id, updates, reasons });
    }
  }

  return fixes;
}

function getDealPriceAmount(deal: FireDoc): number {
  const direct = toNumber(deal.price?.amount);
  if (direct > 0) return direct;
  const numericPrice = toNumber(deal.price);
  if (numericPrice > 0) return numericPrice;
  const legacyPrice = toNumber(deal.legacyPrice);
  if (legacyPrice > 0) return legacyPrice;
  return 0;
}

function getDealShippingAmount(deal: FireDoc): number {
  const shippingObj = toNumber(deal.shipping?.cost);
  if (shippingObj > 0) return shippingObj;
  const direct = toNumber(deal.shippingCost);
  if (direct > 0) return direct;
  const fromPrice = toNumber(deal.price?.shippingCost);
  if (fromPrice > 0) return fromPrice;
  return 0;
}

async function buildDealFixes(deals: FireDoc[], productById: Map<string, FireDoc>): Promise<DealFix[]> {
  const fixes: DealFix[] = [];

  for (const deal of deals) {
    const updates: Record<string, any> = {};
    const reasons: string[] = [];

    const amount = getDealPriceAmount(deal);
    const shipping = getDealShippingAmount(deal);
    const computedTotal = round2(amount + shipping);

    const existingRootTotal = toNumber(deal.totalPrice);
    const existingEmbeddedTotal = toNumber(deal.price?.totalPrice);
    const effectiveExistingTotal = existingRootTotal > 0 ? existingRootTotal : existingEmbeddedTotal;

    if (computedTotal > 0 && (effectiveExistingTotal <= 0 || Math.abs(effectiveExistingTotal - computedTotal) > 0.01)) {
      updates.totalPrice = computedTotal;
      updates.shippingCost = shipping;
      if (deal.price && typeof deal.price === 'object') {
        updates['price.totalPrice'] = computedTotal;
        updates['price.shippingCost'] = shipping;
        updates['price.freeShipping'] = shipping <= 0;
      }
      reasons.push('totalPrice');
    }

    const main = String(deal.mainCategorySlug || '');
    const sub = String(deal.subCategorySlug || '');
    const subSub = String(deal.subSubCategorySlug || '');

    const categoryValid = isValidCategoryPath(main || undefined, sub || undefined, subSub || undefined);
    const needsCategoryRepair = !categoryValid || !main || !sub || !subSub;

    if (needsCategoryRepair) {
      const linkedProductId = String(deal.productCoreId || deal.productId || '');
      const linkedProduct = linkedProductId ? productById.get(linkedProductId) : undefined;

      let resolved: { mainCategorySlug: string; subCategorySlug: string; subSubCategorySlug?: string } | null = null;

      if (linkedProduct) {
        const linkedMain = String(linkedProduct.mainCategorySlug || '');
        const linkedSub = String(linkedProduct.subCategorySlug || '');
        const linkedValid = isValidCategoryPath(
          linkedMain,
          linkedSub,
          linkedProduct.subSubCategorySlug
        );

        if (linkedValid && linkedMain && linkedSub && linkedMain !== 'uncategorized' && linkedSub !== 'uncategorized') {
          resolved = {
            mainCategorySlug: linkedMain,
            subCategorySlug: linkedSub,
            subSubCategorySlug: linkedProduct.subSubCategorySlug,
          };
        }
      }

      if (!resolved) {
        resolved = await resolveCategory(deal);
      }

      if (resolved) {
        const nextMain = resolved.mainCategorySlug;
        const nextSub = resolved.subCategorySlug;
        const nextSubSub = resolved.subSubCategorySlug || null;
        const currentSubSub = deal.subSubCategorySlug || null;
        const changed =
          main !== nextMain ||
          sub !== nextSub ||
          currentSubSub !== nextSubSub;

        if (changed) {
          updates.mainCategorySlug = nextMain;
          updates.subCategorySlug = nextSub;
          updates.subSubCategorySlug = nextSubSub;
          reasons.push('category');
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      fixes.push({ id: deal.id, updates, reasons });
    }
  }

  return fixes;
}

async function commitFixes(collectionName: string, fixes: Array<{ id: string; updates: Record<string, any> }>) {
  const chunkSize = 400;

  for (let i = 0; i < fixes.length; i += chunkSize) {
    const chunk = fixes.slice(i, i + chunkSize);
    const batch = adminDb.batch();

    for (const fix of chunk) {
      const ref = adminDb.collection(collectionName).doc(fix.id);
      batch.update(ref, fix.updates);
    }

    await batch.commit();
  }
}

function sourceIsAliExpress(data: FireDoc): boolean {
  const source = String(data.source || data.metadata?.source || '').toLowerCase();
  return source === 'aliexpress';
}

async function run() {
  console.log(
    `[master-data-backfill] mode=${APPLY ? 'APPLY' : 'DRY_RUN'} onlyAliExpress=${ONLY_ALIEXPRESS} limit=${LIMIT || 'none'}`
  );

  const productsSnap = await adminDb.collection('product_cores').get();
  const allProducts: FireEntity[] = productsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as FireDoc) }));
  const selectedProducts = ONLY_ALIEXPRESS ? allProducts.filter(sourceIsAliExpress) : allProducts;
  const products = LIMIT > 0 ? selectedProducts.slice(0, LIMIT) : selectedProducts;

  const productById = new Map<string, FireDoc>(products.map((p) => [p.id, p]));

  const dealsSnap = await adminDb.collection('deals').get();
  const allDeals: FireEntity[] = dealsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as FireDoc) }));
  const selectedDeals = ONLY_ALIEXPRESS ? allDeals.filter(sourceIsAliExpress) : allDeals;
  const deals = LIMIT > 0 ? selectedDeals.slice(0, LIMIT) : selectedDeals;

  const productFixes = await buildProductFixes(products);
  const dealFixes = await buildDealFixes(deals, productById);

  const summary = {
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    scanned: {
      products: products.length,
      deals: deals.length,
    },
    fixes: {
      products: productFixes.length,
      deals: dealFixes.length,
      productReasons: productFixes.reduce<Record<string, number>>((acc, fix) => {
        for (const reason of fix.reasons) acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {}),
      dealReasons: dealFixes.reduce<Record<string, number>>((acc, fix) => {
        for (const reason of fix.reasons) acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {}),
    },
    samples: {
      products: productFixes.slice(0, 5),
      deals: dealFixes.slice(0, 5),
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) return;

  await commitFixes('product_cores', productFixes);
  await commitFixes('deals', dealFixes);

  console.log(
    JSON.stringify(
      {
        mode: 'APPLY',
        updated: {
          products: productFixes.length,
          deals: dealFixes.length,
        },
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error('[master-data-backfill] failed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
