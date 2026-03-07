import { adminDb } from '@/lib/firebase-admin';
import {
  matchCategoryByExternalIds,
  matchCategoryByText,
  validateCategoryPath,
} from '@/lib/category-mapper';

function toText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts = [obj.pl, obj.en, obj.de, obj.fr, obj.es, obj.uk]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    return parts.join(' ');
  }
  return '';
}

function categoryAliases(originalCategoryName?: string): string[] {
  const text = String(originalCategoryName || '').toLowerCase();
  const aliases: string[] = [];

  if (text.includes('komponenty komputerowe')) {
    aliases.push('computers and laptops');
    aliases.push('computer accessories');
    aliases.push('pc components');
  }

  if (text.includes('komputer i biuro')) {
    aliases.push('computers and laptops');
    aliases.push('office electronics');
  }

  if (text.includes('części do telefonów mobilnych') || text.includes('czesci do telefonow mobilnych')) {
    aliases.push('gsm accessories');
    aliases.push('mobile phone accessories');
    aliases.push('phone parts');
  }

  return aliases;
}

function manualCategoryOverride(originalCategoryName?: string): {
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug?: string;
} | null {
  const text = String(originalCategoryName || '').trim().toLowerCase();
  if (!text) return null;

  const overrides: Record<string, { main: string; sub: string; subSub?: string }> = {
    'inne części i akcesoria pojazdów': {
      main: 'motoryzacja',
      sub: 'czesci-samochodowe',
    },
    'inne czesci i akcesoria pojazdow': {
      main: 'motoryzacja',
      sub: 'czesci-samochodowe',
    },
    'łodzie': {
      main: 'sport-rekreacja',
      sub: 'sporty-wodne',
    },
    'lodzie': {
      main: 'sport-rekreacja',
      sub: 'sporty-wodne',
    },
    'narciarstwo i snowboard': {
      main: 'sport-rekreacja',
      sub: 'sporty-zimowe',
    },
    'biżuteria modowa': {
      main: 'moda-uroda',
      sub: 'bizuteria-zegarki',
    },
    'bizuteria modowa': {
      main: 'moda-uroda',
      sub: 'bizuteria-zegarki',
    },
    'topy i t-shirty': {
      main: 'moda-uroda',
      sub: 'odziez-damska',
    },
  };

  const hit = overrides[text];
  if (!hit) return null;
  return {
    mainCategorySlug: hit.main,
    subCategorySlug: hit.sub,
    subSubCategorySlug: hit.subSub,
  };
}

async function resolveCategoryForProduct(product: any) {
  const metadata = (product?.metadata || {}) as Record<string, any>;

  const externalMatch = await matchCategoryByExternalIds({
    googleCategoryId: Number.isFinite(metadata.googleCategoryId)
      ? Number(metadata.googleCategoryId)
      : undefined,
    aliexpressCategoryId: String(metadata.aliexpressCategoryId || '').trim() || undefined,
  });

  if (externalMatch?.mainCategorySlug) {
    return {
      mainCategorySlug: externalMatch.mainCategorySlug,
      subCategorySlug: externalMatch.subCategorySlug || 'uncategorized',
      subSubCategorySlug: externalMatch.subSubCategorySlug,
      strategy: 'external-id',
    };
  }

  const originalCategoryName = String(metadata.originalCategoryName || '').trim();
  const manual = manualCategoryOverride(originalCategoryName);
  if (manual) {
    return {
      mainCategorySlug: manual.mainCategorySlug,
      subCategorySlug: manual.subCategorySlug,
      subSubCategorySlug: manual.subSubCategorySlug,
      strategy: 'manual-override',
    };
  }

  const aliases = categoryAliases(originalCategoryName);
  const textMatch = await matchCategoryByText([
    toText(product?.title),
    toText(product?.shortDescription),
    toText(product?.fullDescription),
    originalCategoryName,
    ...aliases,
  ]);

  if (textMatch?.mainCategorySlug) {
    return {
      mainCategorySlug: textMatch.mainCategorySlug,
      subCategorySlug: textMatch.subCategorySlug || 'uncategorized',
      subSubCategorySlug: textMatch.subSubCategorySlug,
      strategy: 'keyword',
    };
  }

  return null;
}

async function run() {
  const apply = process.argv.includes('--apply');

  console.log(`[backfill] mode=${apply ? 'APPLY' : 'DRY_RUN'}`);
  const snapshot = await adminDb
    .collection('product_cores')
    .where('mainCategorySlug', '==', 'uncategorized')
    .get();

  const docs = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .filter((p) => String(p?.metadata?.source || '') === 'aliexpress');

  console.log(`[backfill] uncategorized aliexpress products=${docs.length}`);

  const now = new Date().toISOString();
  const updates: Array<{
    id: string;
    mainCategorySlug: string;
    subCategorySlug: string;
    subSubCategorySlug?: string;
    strategy: string;
  }> = [];
  const unresolved: Array<{ id: string; title: string; originalCategoryName: string | null }> = [];

  for (const product of docs) {
    const matched = await resolveCategoryForProduct(product);
    if (!matched) {
      unresolved.push({
        id: product.id,
        title: toText(product.title).slice(0, 120),
        originalCategoryName: product?.metadata?.originalCategoryName || null,
      });
      continue;
    }

    const isValid = await validateCategoryPath(
      matched.mainCategorySlug,
      matched.subCategorySlug,
      matched.subSubCategorySlug || null
    );

    if (!isValid) {
      unresolved.push({
        id: product.id,
        title: toText(product.title).slice(0, 120),
        originalCategoryName: product?.metadata?.originalCategoryName || null,
      });
      continue;
    }

    updates.push({
      id: product.id,
      mainCategorySlug: matched.mainCategorySlug,
      subCategorySlug: matched.subCategorySlug,
      subSubCategorySlug: matched.subSubCategorySlug,
      strategy: matched.strategy,
    });
  }

  const byStrategy = updates.reduce<Record<string, number>>((acc, row) => {
    acc[row.strategy] = (acc[row.strategy] || 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        apply,
        scanned: docs.length,
        matched: updates.length,
        unresolved: unresolved.length,
        byStrategy,
        unresolvedSamples: unresolved.slice(0, 20),
      },
      null,
      2
    )
  );

  if (!apply) return;

  let updatedDeals = 0;
  const BATCH_LIMIT = 400;

  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const chunk = updates.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();

    for (const row of chunk) {
      const productRef = adminDb.collection('product_cores').doc(row.id);
      batch.update(productRef, {
        mainCategorySlug: row.mainCategorySlug,
        subCategorySlug: row.subCategorySlug,
        subSubCategorySlug: row.subSubCategorySlug || null,
        updatedAt: now,
        'metadata.categoryBackfilledAt': now,
        'metadata.categoryBackfillStrategy': row.strategy,
      });
    }

    await batch.commit();
  }

  // Keep deal categories aligned with product categories for updated products.
  for (const row of updates) {
    const dealsSnap = await adminDb
      .collection('deals')
      .where('productCoreId', '==', row.id)
      .get();

    if (dealsSnap.empty) continue;

    let localCount = 0;
    let batch = adminDb.batch();

    for (const dealDoc of dealsSnap.docs) {
      const data = dealDoc.data() as any;
      const currentMain = String(data?.mainCategorySlug || '');
      const currentSub = String(data?.subCategorySlug || '');

      if (currentMain !== 'uncategorized' && currentSub !== 'uncategorized') {
        continue;
      }

      batch.update(dealDoc.ref, {
        mainCategorySlug: row.mainCategorySlug,
        subCategorySlug: row.subCategorySlug,
        subSubCategorySlug: row.subSubCategorySlug || null,
        updatedAt: now,
      });
      localCount += 1;

      if (localCount >= BATCH_LIMIT) {
        await batch.commit();
        updatedDeals += localCount;
        localCount = 0;
        batch = adminDb.batch();
      }
    }

    if (localCount > 0) {
      await batch.commit();
      updatedDeals += localCount;
    }
  }

  console.log(
    JSON.stringify(
      {
        apply,
        updatedProducts: updates.length,
        updatedDeals,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error('[backfill] failed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
