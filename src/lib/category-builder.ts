import { adminDb } from '@/lib/firebase-admin';
import { cacheDel } from '@/lib/cache';
import { Category, Subcategory, SubSubcategory } from '@/lib/types';
import { translateContent } from '@/ai/flows/enrichment';

// Minimal seed type that keeps translation and import keyword metadata
export type CategorySeed = Omit<Category, 'id'> & {
  subcategories?: Array<
    Omit<Subcategory, 'id'> & {
      subcategories?: Array<
        Omit<SubSubcategory, 'id'> & {
          importKeywords?: string[];
          aliexpressKeywords?: string[];
          aliexpressCategoryIds?: string[];
          searchKeywords?: string[];
        }
      >;
      importKeywords?: string[];
      aliexpressKeywords?: string[];
    }
  >;
};

export interface BuildCategoriesResult {
  mainCount: number;
  subCount: number;
  subSubCount: number;
  total: number;
}

const REQUIRED_TRANSLATION_LOCALES = ['en', 'de', 'fr', 'es', 'uk'] as const;
const translationCache = new Map<string, Record<string, string>>();

const slugifyEn = (value: string | undefined): string => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
};

const resolveSlug = (seedSlug: string | undefined, translations?: Record<string, { name?: string }>, fallbackName?: string): { slug: string; legacySlug?: string } => {
  const translated = translations?.en?.name;
  const preferred = translated || fallbackName || seedSlug || '';
  const slug = slugifyEn(preferred) || slugifyEn(seedSlug) || slugifyEn(fallbackName);
  const legacySlug = seedSlug && seedSlug !== slug ? seedSlug : undefined;
  return { slug: slug || seedSlug || '', legacySlug };
};

const dedupeKeywords = (items: string[]): string[] => {
  const normalized = items
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const ensureImportKeywords = (
  rawKeywords: unknown,
  fallbackEn?: string,
  fallbackPl?: string
): string[] => {
  const raw = Array.isArray(rawKeywords)
    ? rawKeywords.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  if (raw.length > 0) {
    return dedupeKeywords(raw);
  }

  return dedupeKeywords([fallbackEn || '', fallbackPl || '']);
};

const translateText = async (
  text: string,
  targetLocales: string[]
): Promise<Record<string, string>> => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText || targetLocales.length === 0) return {};

  const cacheKey = `${normalizedText}::${targetLocales.slice().sort().join(',')}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey) as Record<string, string>;
  }

  try {
    const result = await translateContent({
      text: normalizedText,
      sourceLocale: 'pl',
      targetLocales,
    });
    const translations = result?.translations || {};
    translationCache.set(cacheKey, translations);
    return translations;
  } catch {
    const fallback: Record<string, string> = {};
    translationCache.set(cacheKey, fallback);
    return fallback;
  }
};

const enrichTranslations = async (
  baseName: string,
  baseDescription: string | undefined,
  existing?: Record<string, { name?: string; description?: string }>
): Promise<Record<string, { name?: string; description?: string }>> => {
  const translations: Record<string, { name?: string; description?: string }> = {
    ...(existing || {}),
    pl: {
      name: baseName,
      description: baseDescription || existing?.pl?.description,
    },
  };

  const missingNameLocales = REQUIRED_TRANSLATION_LOCALES.filter(
    (locale) => !translations[locale]?.name
  );

  if (missingNameLocales.length > 0) {
    const translatedNames = await translateText(baseName, [...missingNameLocales]);
    for (const locale of missingNameLocales) {
      translations[locale] = {
        ...(translations[locale] || {}),
        name: translatedNames[locale] || translations[locale]?.name,
      };
    }
  }

  if (baseDescription) {
    const missingDescriptionLocales = REQUIRED_TRANSLATION_LOCALES.filter(
      (locale) => !translations[locale]?.description
    );

    if (missingDescriptionLocales.length > 0) {
      const translatedDescriptions = await translateText(baseDescription, [...missingDescriptionLocales]);
      for (const locale of missingDescriptionLocales) {
        translations[locale] = {
          ...(translations[locale] || {}),
          description: translatedDescriptions[locale] || translations[locale]?.description,
        };
      }
    }
  }

  for (const locale of REQUIRED_TRANSLATION_LOCALES) {
    const existingLocale = translations[locale] || {};
    translations[locale] = {
      name: existingLocale.name || baseName,
      description: baseDescription
        ? (existingLocale.description || baseDescription)
        : existingLocale.description,
    };
  }

  return translations;
};

// Writes CATEGORY_SEEDS (or any compatible seed list) into Firestore using slug as the document id.
export async function buildCategoriesFromSeeds(seeds: CategorySeed[]): Promise<BuildCategoriesResult> {
  let mainCount = 0;
  let subCount = 0;
  let subSubCount = 0;

  for (const main of seeds) {
    const mainTranslations = await enrichTranslations(main.name, main.description, main.translations);
    const { slug: mainSlug, legacySlug: legacyMainSlug } = resolveSlug(main.slug, mainTranslations, main.name);
    if (!mainSlug) continue;

    const mainRef = adminDb.collection('categories').doc(mainSlug);
    await mainRef.set(
      {
        id: mainSlug,
        slug: mainSlug,
        legacySlug: legacyMainSlug,
        name: main.name,
        description: main.description ?? '',
        icon: main.icon ?? '📂',
        sortOrder: main.sortOrder ?? 0,
        translations: mainTranslations,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    mainCount++;

    const subcategories = main.subcategories ?? [];
    for (const sub of subcategories) {
      const subTranslations = await enrichTranslations(sub.name, sub.description, sub.translations);
      const { slug: subSlug, legacySlug: legacySubSlug } = resolveSlug(sub.slug, subTranslations, sub.name);
      if (!subSlug) continue;

      const subEnName = subTranslations?.en?.name || sub.name;
      const subImportKeywords = ensureImportKeywords(
        (sub as any).importKeywords ?? (sub as any).aliexpressKeywords,
        subEnName,
        sub.name
      );

      const subRef = mainRef.collection('subcategories').doc(subSlug);
      await subRef.set(
        {
          slug: subSlug,
          legacySlug: legacySubSlug,
          name: sub.name,
          description: sub.description ?? '',
          icon: sub.icon ?? '',
          sortOrder: sub.sortOrder ?? 0,
          translations: subTranslations,
          importKeywords: subImportKeywords,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      subCount++;

      const subSubs = sub.subcategories ?? [];
      for (const subsub of subSubs) {
        const subSubTranslations = await enrichTranslations(subsub.name, subsub.description, subsub.translations);
        const { slug: subSubSlug, legacySlug: legacySubSubSlug } = resolveSlug(subsub.slug, subSubTranslations, subsub.name);
        if (!subSubSlug) continue;

        const subSubEnName = subSubTranslations?.en?.name || subsub.name;
        const finalKeywords = ensureImportKeywords(
          (subsub as any).importKeywords ?? (subsub as any).aliexpressKeywords,
          subSubEnName,
          subsub.name
        );

        // NEW: AliExpress category IDs
        const aliexpressCategoryIds = (subsub as any).aliexpressCategoryIds ?? [];

        // NEW: Generate searchKeywords from EN translation + importKeywords
        const enName = subSubEnName || '';
        const searchKeywords = [
          enName,
          ...finalKeywords,
        ].filter(Boolean);
        const uniqueSearchKeywords = dedupeKeywords(searchKeywords);

        const subSubRef = subRef.collection('subcategories').doc(subSubSlug);
        await subSubRef.set(
          {
            slug: subSubSlug,
            legacySlug: legacySubSubSlug,
            name: subsub.name,
            description: subsub.description ?? '',
            icon: subsub.icon ?? '',
            sortOrder: subsub.sortOrder ?? 0,
            translations: subSubTranslations,
            importKeywords: finalKeywords,
            aliexpressCategoryIds,
            searchKeywords: uniqueSearchKeywords,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        subSubCount++;
      }
    }
  }

  await cacheDel('categories:all');
  await cacheDel('categories:all:v2');

  return {
    mainCount,
    subCount,
    subSubCount,
    total: mainCount + subCount + subSubCount,
  };
}
