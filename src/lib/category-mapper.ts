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

function normalizeTextInput(text: string | string[]): string {
  if (Array.isArray(text)) {
    return normalizeText(text.filter(Boolean).join(' '));
  }
  return normalizeText(text);
}

function extractNameKeywords(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') {
    const names: string[] = [];
    if (value.pl) names.push(value.pl);
    if (value.en) names.push(value.en);
    if (value.de) names.push(value.de);
    return names;
  }
  return [];
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
    const mainKeywords = [
      ...extractNameKeywords(mainData?.name),
      mainSlug,
    ];
    entries.push({ mainSlug, keywords: mainKeywords });

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
      if (Array.isArray(subData?.searchKeywords)) subKeywords.push(...subData.searchKeywords);
      subKeywords.push(...extractNameKeywords(subData?.name));
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
        if (Array.isArray(subSubData?.searchKeywords)) subSubKeywords.push(...subSubData.searchKeywords);
        subSubKeywords.push(...extractNameKeywords(subSubData?.name));
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

export async function matchCategoryByText(text: string | string[]): Promise<{ mainCategorySlug: string; subCategorySlug?: string; subSubCategorySlug?: string } | null> {
  const normalized = normalizeTextInput(text);
  if (!normalized) return null;
  const entries = await loadCategoryKeywordEntries();

  const tokens = new Set(normalized.split(' ').filter(Boolean));
  let bestSub: { entry: CategoryEntry; score: number; matches: number; bestLen: number } | null = null;
  let bestMain: { entry: CategoryEntry; score: number; matches: number; bestLen: number } | null = null;

  for (const entry of entries) {
    let score = 0;
    let matches = 0;
    let bestLen = 0;
    let matchedHasSpace = false;
    for (const rawKw of entry.keywords) {
      const kw = normalizeText(rawKw);
      if (!kw || kw.length < 3) continue;
      if (kw.includes(' ')) {
        if (normalized.includes(kw)) {
          score += Math.min(kw.length, 12);
          matches += 1;
          bestLen = Math.max(bestLen, kw.length);
          matchedHasSpace = true;
        }
      } else if (tokens.has(kw)) {
        score += Math.min(kw.length, 10);
        matches += 1;
        bestLen = Math.max(bestLen, kw.length);
      }
    }

    if (score === 0) continue;

    // Avoid single generic keyword matches (reduce false positives)
    const minSingleLen = entry.subSubSlug ? 6 : entry.subSlug ? 8 : 10;
    if (matches < 2 && !matchedHasSpace && bestLen < minSingleLen) continue;

    if (entry.subSubSlug || entry.subSlug) {
      // Prefer deeper matches (sub-sub > sub)
      score += entry.subSubSlug ? 5 : 2;
      if (!bestSub || score > bestSub.score) bestSub = { entry, score, matches, bestLen };
    } else {
      if (!bestMain || score > bestMain.score) bestMain = { entry, score, matches, bestLen };
    }
  }

  const MIN_SUB_SCORE = 4;
  const MIN_MAIN_SCORE = 6;
  const best = bestSub && bestSub.score >= MIN_SUB_SCORE
    ? bestSub
    : (bestMain && bestMain.score >= MIN_MAIN_SCORE ? bestMain : null);

  if (!best) return null;

  return {
    mainCategorySlug: best.entry.mainSlug,
    subCategorySlug: best.entry.subSlug,
    subSubCategorySlug: best.entry.subSubSlug,
  };
}

export async function validateCategoryPath(
  mainCategorySlug?: string,
  subCategorySlug?: string | null,
  subSubCategorySlug?: string | null
): Promise<boolean> {
  if (!mainCategorySlug || mainCategorySlug === 'uncategorized') return true;
  const mainRef = adminDb.collection('categories').doc(mainCategorySlug);
  const mainSnap = await mainRef.get();
  if (!mainSnap.exists) return false;

  if (!subCategorySlug || subCategorySlug === 'uncategorized') return true;
  const subRef = mainRef.collection('subcategories').doc(subCategorySlug);
  const subSnap = await subRef.get();
  if (!subSnap.exists) return false;

  if (!subSubCategorySlug || subSubCategorySlug === 'uncategorized') return true;
  const subSubRef = subRef.collection('subcategories').doc(subSubCategorySlug);
  const subSubSnap = await subSubRef.get();
  return subSubSnap.exists;
}

export async function ensureProductCategory(productId: string, text: string | string[]): Promise<{ mainCategorySlug: string; subCategorySlug?: string; subSubCategorySlug?: string } | null> {
  const productRef = adminDb.collection('product_cores').doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) return null;
  const data = snap.data() as any;

  const hasCategory = data?.mainCategorySlug && data?.mainCategorySlug !== 'uncategorized';
  if (hasCategory) {
    const isValid = await validateCategoryPath(
      data.mainCategorySlug,
      data.subCategorySlug,
      data.subSubCategorySlug
    );
    if (isValid) {
      return {
        mainCategorySlug: data.mainCategorySlug,
        subCategorySlug: data.subCategorySlug,
        subSubCategorySlug: data.subSubCategorySlug,
      };
    }
  }

  const matched = await matchCategoryByText(text);
  if (!matched) return null;

  await productRef.update({
    mainCategorySlug: matched.mainCategorySlug,
    subCategorySlug: matched.subCategorySlug || null,
    subSubCategorySlug: matched.subSubCategorySlug || null,
    updatedAt: new Date().toISOString(),
  });

  return matched;
}
