import { adminDb } from '@/lib/firebase-admin';

type CategoryEntry = {
  mainSlug: string;
  subSlug?: string;
  subSubSlug?: string;
  keywords: string[];
};

let cachedEntries: CategoryEntry[] | null = null;
let cachedAt = 0;

const CACHE_TTL_MS = 60_000; // 60s

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadCategoryKeywordEntries(): Promise<CategoryEntry[]> {
  const now = Date.now();
  if (cachedEntries && now - cachedAt < CACHE_TTL_MS) return cachedEntries;

  const entries: CategoryEntry[] = [];

  const mainSnap = await adminDb.collection('categories').get();
  for (const mainDoc of mainSnap.docs) {
    const mainData = mainDoc.data() as any;
    const mainSlug = mainData?.slug || mainDoc.id;

    // Base entry for main level (fallback)
    entries.push({ mainSlug, keywords: [mainData?.name || mainSlug] });

    const subSnap = await adminDb
      .collection('categories')
      .doc(mainDoc.id)
      .collection('subcategories')
      .get();

    for (const subDoc of subSnap.docs) {
      const subData = subDoc.data() as any;
      const subSlug = subData?.slug || subDoc.id;
      const subKeywords: string[] = [];
      if (Array.isArray(subData?.importKeywords)) subKeywords.push(...subData.importKeywords);
      if (subData?.translations?.en?.name) subKeywords.push(subData.translations.en.name);
      entries.push({ mainSlug, subSlug, keywords: subKeywords.length ? subKeywords : [subData?.name || subSlug] });

      const subSubSnap = await adminDb
        .collection('categories')
        .doc(mainDoc.id)
        .collection('subcategories')
        .doc(subDoc.id)
        .collection('subcategories')
        .get();

      for (const subSubDoc of subSubSnap.docs) {
        const subSubData = subSubDoc.data() as any;
        const subSubSlug = subSubData?.slug || subSubDoc.id;
        const subSubKeywords: string[] = [];
        if (Array.isArray(subSubData?.importKeywords)) subSubKeywords.push(...subSubData.importKeywords);
        if (subSubData?.translations?.en?.name) subSubKeywords.push(subSubData.translations.en.name);
        entries.push({ mainSlug, subSlug, subSubSlug, keywords: subSubKeywords.length ? subSubKeywords : [subSubData?.name || subSubSlug] });
      }
    }
  }

  // Normalize and dedupe keywords
  cachedEntries = entries.map(e => ({
    mainSlug: e.mainSlug,
    subSlug: e.subSlug,
    subSubSlug: e.subSubSlug,
    keywords: Array.from(new Set((e.keywords || []).map(normalizeText))).filter(Boolean),
  }));
  cachedAt = now;
  return cachedEntries!;
}

export async function matchCategoryByText(text: string): Promise<{ mainCategorySlug: string; subCategorySlug?: string; subSubCategorySlug?: string } | null> {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const entries = await loadCategoryKeywordEntries();

  let best: { entry: CategoryEntry; score: number } | null = null;
  for (const entry of entries) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (kw && normalized.includes(kw)) score += Math.min(kw.length, 8); // weight by keyword length a bit
    }
    // Prefer deeper matches (sub-sub > sub > main)
    if (entry.subSubSlug) score += 5;
    else if (entry.subSlug) score += 2;

    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  if (!best) return null;

  return {
    mainCategorySlug: best.entry.mainSlug,
    subCategorySlug: best.entry.subSlug,
    subSubCategorySlug: best.entry.subSubSlug,
  };
}

export async function ensureProductCategory(productId: string, title: string): Promise<{ mainCategorySlug: string; subCategorySlug?: string; subSubCategorySlug?: string } | null> {
  const productRef = adminDb.collection('product_cores').doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) return null;
  const data = snap.data() as any;

  const hasCategory = data?.mainCategorySlug && data?.mainCategorySlug !== 'uncategorized';
  if (hasCategory) {
    return {
      mainCategorySlug: data.mainCategorySlug,
      subCategorySlug: data.subCategorySlug,
      subSubCategorySlug: data.subSubCategorySlug,
    };
  }

  const matched = await matchCategoryByText(title);
  if (!matched) return null;

  await productRef.update({
    mainCategorySlug: matched.mainCategorySlug,
    subCategorySlug: matched.subCategorySlug || null,
    subSubCategorySlug: matched.subSubCategorySlug || null,
    updatedAt: new Date().toISOString(),
  });

  return matched;
}
