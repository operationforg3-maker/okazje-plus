import { adminDb } from '@/lib/firebase-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';

export interface EnsureAliExpressProfilesOptions {
  enabled?: boolean;
  maxItemsPerRun?: number;
  deduplicationStrategy?: 'skip' | 'update' | 'create_new' | 'ai_merge';
  defaultStatus?: 'draft' | 'approved';
  createdBy?: string;
  dryRun?: boolean;
  updateQueries?: boolean; // Option to update queries of existing profiles
}

export interface EnsureAliExpressProfilesResult {
  totalTargets: number;
  existingProfiles: number;
  createdProfiles: number;
  updatedProfiles: number;
  skippedProfiles: number;
}

const DEFAULT_MAX_ITEMS = 200;

function toSearchQuery(input: {
  importKeywords?: string[];
  englishName?: string;
  fallbackName: string;
}): string {
  // 1. If we have importKeywords, prefer the first keyword (typically the English translation)
  const fromKeywords = Array.isArray(input.importKeywords)
    ? input.importKeywords.filter((v) => typeof v === 'string' && v.trim().length > 0)
    : [];

  if (fromKeywords.length > 0) {
    return fromKeywords[0].trim();
  }

  // 2. Otherwise, prefer the English name if present
  if (typeof input.englishName === 'string' && input.englishName.trim().length > 0) {
    return input.englishName.trim();
  }

  // 3. Fallback to Polish name
  return input.fallbackName.trim();
}

function mappingKey(main: string, sub: string, subSub?: string): string {
  return `${main}::${sub}::${subSub || ''}`;
}

export async function ensureAliExpressImportProfilesCoverage(
  options: EnsureAliExpressProfilesOptions = {}
): Promise<EnsureAliExpressProfilesResult> {
  const enabled = options.enabled ?? true;
  const maxItemsPerRun = Number.isFinite(options.maxItemsPerRun)
    ? Math.max(10, Number(options.maxItemsPerRun))
    : DEFAULT_MAX_ITEMS;
  const deduplicationStrategy = options.deduplicationStrategy || 'skip';
  const defaultStatus = options.defaultStatus || 'approved';
  const createdBy = options.createdBy || 'system';
  const dryRun = options.dryRun ?? false;
  const updateQueries = options.updateQueries ?? false;

  const existingSnapshot = await adminDb
    .collection('importProfiles')
    .where('vendorId', '==', 'aliexpress')
    .get();

  const existingMap = new Map<string, any>();
  for (const docSnap of existingSnapshot.docs) {
    const data = docSnap.data() as any;
    const key = mappingKey(
      String(data?.mapping?.targetMainCategory || ''),
      String(data?.mapping?.targetSubCategory || ''),
      data?.mapping?.targetSubSubCategory ? String(data.mapping.targetSubSubCategory) : ''
    );
    if (key !== '::::') {
      existingMap.set(key, { ref: docSnap.ref, data });
    }
  }

  const categories = await getAllCategories();

  let totalTargets = 0;
  let createdProfiles = 0;
  let updatedProfiles = 0;
  let skippedProfiles = 0;

  for (const main of categories) {
    const subcategories = await getSubcategories(main.id);

    for (const sub of subcategories) {
      const subSubcategories = await getSubSubcategories(main.id, sub.id);

      if (subSubcategories.length > 0) {
        for (const subSub of subSubcategories) {
          totalTargets += 1;

          const key = mappingKey(main.slug, sub.slug, subSub.slug);
          const existing = existingMap.get(key);

          const targetQuery = toSearchQuery({
            importKeywords: subSub.importKeywords,
            englishName: subSub.translations?.en?.name,
            fallbackName: subSub.name,
          });

          if (existing) {
            if (updateQueries && existing.data?.filters?.searchQuery !== targetQuery) {
              console.log(`[Import Profiles Bootstrap] Updating query for ${key}: "${existing.data?.filters?.searchQuery}" -> "${targetQuery}"`);
              if (!dryRun) {
                await existing.ref.update({
                  'filters.searchQuery': targetQuery,
                  updatedAt: new Date().toISOString(),
                });
              }
              updatedProfiles += 1;
            }
            skippedProfiles += 1;
            continue;
          }

          if (!dryRun) {
            const now = new Date().toISOString();
            await adminDb.collection('importProfiles').add({
              vendorId: 'aliexpress',
              name: `AliExpress Auto: ${main.name} / ${sub.name} / ${subSub.name}`,
              enabled,
              filters: {
                searchQuery: targetQuery,
                categoryFilter: subSub.slug,
              },
              mapping: {
                targetMainCategory: main.slug,
                targetSubCategory: sub.slug,
                targetSubSubCategory: subSub.slug,
                defaultStatus,
              },
              deduplicationStrategy,
              maxItemsPerRun,
              createdAt: now,
              updatedAt: now,
              createdBy,
            });
          }

          createdProfiles += 1;
        }
      } else {
        totalTargets += 1;

        const key = mappingKey(main.slug, sub.slug, sub.slug);
        const existing = existingMap.get(key);

        const targetQuery = sub.name; // Use subcategory name directly

        if (existing) {
          if (updateQueries && existing.data?.filters?.searchQuery !== targetQuery) {
            console.log(`[Import Profiles Bootstrap] Updating query for ${key}: "${existing.data?.filters?.searchQuery}" -> "${targetQuery}"`);
            if (!dryRun) {
              await existing.ref.update({
                'filters.searchQuery': targetQuery,
                updatedAt: new Date().toISOString(),
              });
            }
            updatedProfiles += 1;
          }
          skippedProfiles += 1;
          continue;
        }

        if (!dryRun) {
          const now = new Date().toISOString();
          await adminDb.collection('importProfiles').add({
            vendorId: 'aliexpress',
            name: `AliExpress Auto: ${main.name} / ${sub.name}`,
            enabled,
            filters: {
              searchQuery: targetQuery,
              categoryFilter: sub.slug,
            },
            mapping: {
              targetMainCategory: main.slug,
              targetSubCategory: sub.slug,
              targetSubSubCategory: sub.slug,
              defaultStatus,
            },
            deduplicationStrategy,
            maxItemsPerRun,
            createdAt: now,
            updatedAt: now,
            createdBy,
          });
        }

        createdProfiles += 1;
      }
    }
  }

  return {
    totalTargets,
    existingProfiles: existingSnapshot.size,
    createdProfiles,
    updatedProfiles,
    skippedProfiles,
  };
}
