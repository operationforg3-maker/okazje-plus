import { adminDb } from '@/lib/firebase-admin';
import { cacheDel } from '@/lib/cache';
import { Category, Subcategory, SubSubcategory } from '@/lib/types';

// Minimal seed type that keeps translation and import keyword metadata
export type CategorySeed = Omit<Category, 'id'> & {
  subcategories?: Array<
    Omit<Subcategory, 'id'> & {
      subcategories?: Array<
        Omit<SubSubcategory, 'id'> & {
          importKeywords?: string[];
          aliexpressKeywords?: string[];
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

// Writes CATEGORY_SEEDS (or any compatible seed list) into Firestore using slug as the document id.
export async function buildCategoriesFromSeeds(seeds: CategorySeed[]): Promise<BuildCategoriesResult> {
  let mainCount = 0;
  let subCount = 0;
  let subSubCount = 0;

  for (const main of seeds) {
    const { slug: mainSlug, legacySlug: legacyMainSlug } = resolveSlug(main.slug, main.translations, main.name);
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
        translations: main.translations ?? {},
        updatedAt: new Date(),
      },
      { merge: true }
    );
    mainCount++;

    const subcategories = main.subcategories ?? [];
    for (const sub of subcategories) {
      const { slug: subSlug, legacySlug: legacySubSlug } = resolveSlug(sub.slug, sub.translations, sub.name);
      if (!subSlug) continue;

      const subRef = mainRef.collection('subcategories').doc(subSlug);
      await subRef.set(
        {
          slug: subSlug,
          legacySlug: legacySubSlug,
          name: sub.name,
          description: sub.description ?? '',
          icon: sub.icon ?? '',
          sortOrder: sub.sortOrder ?? 0,
          translations: sub.translations ?? {},
          importKeywords: (sub as any).importKeywords ?? (sub as any).aliexpressKeywords ?? [],
          updatedAt: new Date(),
        },
        { merge: true }
      );
      subCount++;

      const subSubs = sub.subcategories ?? [];
      for (const subsub of subSubs) {
        const { slug: subSubSlug, legacySlug: legacySubSubSlug } = resolveSlug(subsub.slug, subsub.translations, subsub.name);
        if (!subSubSlug) continue;

        const importKeywordsRaw = (subsub as any).importKeywords ?? (subsub as any).aliexpressKeywords ?? [];
        const importKeywords = Array.isArray(importKeywordsRaw)
          ? importKeywordsRaw.filter(Boolean)
          : [];
        const finalKeywords = importKeywords.length > 0 ? importKeywords : subsub.name ? [subsub.name] : [];

        const subSubRef = subRef.collection('subcategories').doc(subSubSlug);
        await subSubRef.set(
          {
            slug: subSubSlug,
            legacySlug: legacySubSubSlug,
            name: subsub.name,
            description: subsub.description ?? '',
            icon: subsub.icon ?? '',
            sortOrder: subsub.sortOrder ?? 0,
            translations: subsub.translations ?? {},
            importKeywords: finalKeywords,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        subSubCount++;
      }
    }
  }

  await cacheDel('categories:all');

  return {
    mainCount,
    subCount,
    subSubCount,
    total: mainCount + subCount + subSubCount,
  };
}
