import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { getAllCategories, getSubcategories, getSubSubcategories, createProduct, findExistingProduct } from '@/lib/data-admin';
import { fetchProductsFromAliexpress, fetchProductsFromConvertiser } from '@/ai/flows/importerFlow/stageFetch';
import { getAliExpressCategoryIds } from '@/lib/aliexpress-category-mapping';
import type { AliExpressProduct, ImportStageConfig } from '@/ai/flows/importerFlow/types';

type ImporterType = 'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct';

interface RequestBody {
  importerType?: ImporterType;
  maxItemsPerSubcategory?: number;
  maxBatches?: number; // safety limiter
  onlyCategorySlug?: string;
  onlySubcategorySlug?: string;
  onlySubSubcategorySlug?: string;
}

function stageConfig(importerType: ImporterType, maxItems: number): ImportStageConfig {
  return {
    name: 'fetch',
    batchSize: maxItems,
    delayBetweenItems: 50,
    delayBetweenBatches: 300,
    maxRetries: 1,
    importerType,
    maxItemsPerSubcategory: maxItems,
  };
}

function normalizeTitle(title: string): string {
  return (title || '').toString().trim();
}

function toDraftPayload(p: AliExpressProduct, slugs: { main: string; sub: string; subsub: string }, source: 'aliexpress' | 'convertiser') {
  const titleEN = normalizeTitle(p.title || 'Untitled');
  const descEN = (p.description || titleEN).toString();
  const amount = Number(p.price) > 0 ? Number(p.price) : 0;

  return {
    // Legacy fields
    name: titleEN,
    description: descEN,
    longDescription: descEN,
    // New localized
    title: { en: titleEN, pl: titleEN },
    shortDescription: { en: descEN, pl: descEN },
    fullDescription: { en: descEN, pl: descEN },
    // Media / links
    image: p.image,
    imageHint: titleEN,
    affiliateUrl: p.link,
    // Price as SmartPrice-like object
    price: { amount, currency: p.currency || 'PLN', totalPrice: amount, lastUpdated: new Date().toISOString() },
    originalPrice: p.originalPrice,
    discountPercent: p.discount,
    currency: p.currency || 'PLN',
    // Categories (EN slugs per new convention)
    mainCategorySlug: slugs.main,
    subCategorySlug: slugs.sub,
    subSubCategorySlug: slugs.subsub,
    // Meta
    importJobId: null,
    metadata: { source, originalId: p.id },
    status: 'draft' as const,
    ratingCard: { score: 0, count: 0 },
  };
}

async function fetchForBatch(importerType: ImporterType, maxItems: number, batch: {
  categorySlug: string; subcategorySlug: string; subsubcategorySlug: string;
  categoryName: string; subcategoryName: string; subsubcategoryName: string;
}): Promise<AliExpressProduct[]> {
  const cfg = stageConfig(importerType, maxItems);

  if (importerType === 'convertiser') {
    const keywords = [batch.subsubcategorySlug, batch.subcategorySlug].filter(Boolean);
    return fetchProductsFromConvertiser(keywords, cfg);
  }

  if (importerType === 'hot-products' || importerType === 'category-direct') {
    const categoryIds = getAliExpressCategoryIds(batch.categorySlug, batch.subcategorySlug, batch.subsubcategorySlug);
    const kws = categoryIds.length > 0 ? categoryIds : [];
    return fetchProductsFromAliexpress(kws, { ...cfg, importerType: 'hot-products' });
  }

  // keyword-search fallback
  const keywords = [
    `${batch.subsubcategoryName}`,
    `${batch.subcategoryName}`,
    `${batch.subsubcategoryName} ${batch.subcategoryName}`,
    `${batch.subsubcategorySlug}`,
  ].filter(Boolean);
  return fetchProductsFromAliexpress(keywords, cfg);
}

export async function POST(req: NextRequest) {
  // Admin auth
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const importerType: ImporterType = body.importerType || 'hot-products';
    const maxItems = Math.max(1, Math.min(body.maxItemsPerSubcategory ?? 10, 100));
    const maxBatches = Math.max(1, Math.min(body.maxBatches ?? 3, 50));
    const onlyCat = body.onlyCategorySlug?.trim();
    const onlySub = body.onlySubcategorySlug?.trim();
    const onlySubSub = body.onlySubSubcategorySlug?.trim();

    // Build batches from categories tree
    const categories = await getAllCategories();
    const batches: Array<{
      categorySlug: string; subcategorySlug: string; subsubcategorySlug: string;
      categoryName: string; subcategoryName: string; subsubcategoryName: string;
    }> = [];

    for (const cat of categories) {
      if (onlyCat && cat.slug !== onlyCat) continue;
      const subs = await getSubcategories(cat.id);
      for (const sub of subs) {
        if (onlySub && sub.slug !== onlySub) continue;
        const subsubs = await getSubSubcategories(cat.id, sub.id);
        if (subsubs.length === 0) {
          if (!onlySubSub) batches.push({
            categorySlug: cat.slug, categoryName: cat.name,
            subcategorySlug: sub.slug, subcategoryName: sub.name,
            subsubcategorySlug: sub.slug, subsubcategoryName: sub.name,
          });
        } else {
          for (const ss of subsubs) {
            if (onlySubSub && ss.slug !== onlySubSub) continue;
            batches.push({
              categorySlug: cat.slug, categoryName: cat.name,
              subcategorySlug: sub.slug, subcategoryName: sub.name,
              subsubcategorySlug: ss.slug, subsubcategoryName: ss.name,
            });
          }
        }
      }
    }

    // Create a simple job document to track this draft run
    const jobRef = adminDb.collection('import_jobs').doc();
    await jobRef.set({
      id: jobRef.id,
      type: 'products',
      mode: 'drafts',
      status: 'running',
      importerType,
      progress: { total: Math.min(batches.length, maxBatches), completed: 0, failed: 0, current: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
      itemsCreated: [],
    });

    // Process limited number of batches synchronously to return quick result
    const toProcess = batches.slice(0, maxBatches);
    const summary = { batches: toProcess.length, fetched: 0, saved: 0, skipped: 0 };

    for (let i = 0; i < toProcess.length; i++) {
      const b = toProcess[i];
      await jobRef.update({ 'progress.current': i, updatedAt: new Date().toISOString() });
      const products = await fetchForBatch(importerType, maxItems, b);
      summary.fetched += products.length;

      let created = 0;
      let skipped = 0;
      for (const p of products) {
        try {
          if (!p?.image?.startsWith('http') || !p?.link?.startsWith('http')) { skipped++; continue; }
          if (!p?.price || Number(p.price) <= 0) { skipped++; continue; }

          const existingId = await findExistingProduct({ originalId: String(p.id), affiliateUrl: p.link });
          if (existingId) { skipped++; continue; }

          const payload = toDraftPayload(p, { main: b.categorySlug, sub: b.subcategorySlug, subsub: b.subsubcategorySlug }, importerType === 'convertiser' ? 'convertiser' : 'aliexpress');
          const newId = await createProduct(payload as any);
          created++;
          await jobRef.update({ itemsCreated: FieldValue.arrayUnion(newId), updatedAt: new Date().toISOString() }).catch(() => {});
        } catch {
          skipped++;
        }
      }

      summary.saved += created;
      summary.skipped += skipped;
      await jobRef.update({
        'progress.completed': i + 1,
        logs: FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          status: 'success',
          batchIndex: i,
          subcategory: `${b.categoryName}/${b.subcategoryName}/${b.subsubcategoryName}`,
          stages: { fetched: products.length, saved: created, skipped },
        }),
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    await jobRef.update({ status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true, jobId: jobRef.id, ...summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch & save drafts' }, { status: 500 });
  }
}
