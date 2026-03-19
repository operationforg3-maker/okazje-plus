/**
 * backfill-category-translations.ts
 *
 * Uzupełnia brakujące tłumaczenia kategorii/subkategorii/sub-subkategorii
 * w kolekcji `categories` i podkolekcjach `subcategories`.
 *
 * Użycie:
 *   Dry-run (domyślnie): npx tsx scripts/backfill-category-translations.ts --locales=uk
 *   Apply:                npx tsx scripts/backfill-category-translations.ts --locales=uk --apply
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { translateContent } from '../src/ai/flows/enrichment';

type Locale = 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk';

type TranslationPayload = {
  name?: string;
  description?: string;
};

type TranslationMap = Record<string, TranslationPayload>;

const DRY_RUN = !process.argv.includes('--apply');
const localesArg = process.argv.find((arg) => arg.startsWith('--locales='))?.split('=')[1] || 'uk';
const TARGET_LOCALES = localesArg
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean) as Locale[];

const BATCH_LIMIT = 350;
const SLEEP_MS = 60;

const keyPath = path.resolve('serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Brak serviceAccountKey.json w katalogu projektu');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const translationCache = new Map<string, Record<string, string>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pickSourceText(
  translations: TranslationMap,
  fallbackName?: string,
  fallbackDescription?: string
): { sourceLocale: Locale; name: string; description?: string } {
  for (const locale of ['pl', 'en', 'de'] as const) {
    const name = String(translations?.[locale]?.name || '').trim();
    if (name) {
      const description = String(translations?.[locale]?.description || '').trim() || fallbackDescription;
      return { sourceLocale: locale, name, description };
    }
  }

  const name = String(fallbackName || '').trim();
  return {
    sourceLocale: 'en',
    name,
    description: String(fallbackDescription || '').trim() || undefined,
  };
}

async function translateMissing(
  text: string,
  sourceLocale: Locale,
  targetLocales: Locale[]
): Promise<Record<string, string>> {
  if (!text || targetLocales.length === 0) return {};

  const key = `${sourceLocale}:${text}::${targetLocales.slice().sort().join(',')}`;
  const cached = translationCache.get(key);
  if (cached) return cached;

  try {
    const result = await translateContent({
      text,
      sourceLocale,
      targetLocales,
    });

    const translations = result?.translations || {};
    const normalized: Record<string, string> = {};

    for (const locale of targetLocales) {
      const value = String((translations as Record<string, string>)?.[locale] || '').trim();
      if (value) {
        normalized[locale] = value;
      }
    }

    translationCache.set(key, normalized);
    return normalized;
  } catch (error) {
    console.warn('[translateMissing] Fallback copy due to error:', (error as Error).message?.slice(0, 120));
    const fallback = Object.fromEntries(targetLocales.map((locale) => [locale, text]));
    translationCache.set(key, fallback);
    return fallback;
  }
}

function ensureTranslationMap(input: unknown): TranslationMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return { ...(input as TranslationMap) };
}

async function enrichNodeTranslations(
  translationsInput: unknown,
  fallbackName: string,
  fallbackDescription?: string
): Promise<{ updatedTranslations: TranslationMap; changed: boolean }> {
  const translations = ensureTranslationMap(translationsInput);
  const before = JSON.stringify(translations);

  const source = pickSourceText(translations, fallbackName, fallbackDescription);
  if (!source.name) {
    return { updatedTranslations: translations, changed: false };
  }

  const missingNameLocales = TARGET_LOCALES.filter((locale) => {
    const v = String(translations?.[locale]?.name || '').trim();
    return v.length === 0;
  });

  if (missingNameLocales.length > 0) {
    const translatedNames = await translateMissing(source.name, source.sourceLocale, missingNameLocales);
    for (const locale of missingNameLocales) {
      const translatedName = translatedNames[locale] || source.name;
      translations[locale] = {
        ...(translations[locale] || {}),
        name: translatedName,
      };
    }
  }

  const baseDescription = String(source.description || '').trim();
  if (baseDescription) {
    const missingDescLocales = TARGET_LOCALES.filter((locale) => {
      const v = String(translations?.[locale]?.description || '').trim();
      return v.length === 0;
    });

    if (missingDescLocales.length > 0) {
      const translatedDescriptions = await translateMissing(baseDescription, source.sourceLocale, missingDescLocales);
      for (const locale of missingDescLocales) {
        const translatedDescription = translatedDescriptions[locale] || baseDescription;
        translations[locale] = {
          ...(translations[locale] || {}),
          description: translatedDescription,
        };
      }
    }
  }

  const after = JSON.stringify(translations);
  return { updatedTranslations: translations, changed: before !== after };
}

async function run(): Promise<void> {
  console.log('\n=== Category translation backfill ===');
  console.log('Mode:', DRY_RUN ? 'DRY_RUN' : 'APPLY');
  console.log('Target locales:', TARGET_LOCALES.join(', '));

  const categoriesSnap = await db.collection('categories').get();

  let scanned = 0;
  let updated = 0;
  let batchOps = 0;
  let batch = db.batch();

  const commitBatch = async () => {
    if (DRY_RUN || batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const categoryDoc of categoriesSnap.docs) {
    const categoryData = categoryDoc.data() as Record<string, unknown>;
    scanned += 1;

    const categoryRef = categoryDoc.ref;
    const categoryName = String(categoryData.name || categoryDoc.id);
    const categoryDescription = String(categoryData.description || '');

    const categoryEnriched = await enrichNodeTranslations(
      categoryData.translations,
      categoryName,
      categoryDescription
    );

    if (categoryEnriched.changed) {
      if (DRY_RUN) {
        console.log(`[DRY] category ${categoryDoc.id} -> add locales ${TARGET_LOCALES.join(',')}`);
      } else {
        batch.update(categoryRef, {
          translations: categoryEnriched.updatedTranslations,
          updatedAt: new Date(),
          'metadata.categoryTranslationsBackfilledAt': new Date().toISOString(),
        });
        batchOps += 1;
      }
      updated += 1;
    }

    const subSnap = await categoryRef.collection('subcategories').get();
    for (const subDoc of subSnap.docs) {
      const subData = subDoc.data() as Record<string, unknown>;
      scanned += 1;

      const subName = String(subData.name || subDoc.id);
      const subDescription = String(subData.description || '');

      const subEnriched = await enrichNodeTranslations(
        subData.translations,
        subName,
        subDescription
      );

      if (subEnriched.changed) {
        if (DRY_RUN) {
          console.log(`[DRY] sub ${categoryDoc.id}/${subDoc.id}`);
        } else {
          batch.update(subDoc.ref, {
            translations: subEnriched.updatedTranslations,
            updatedAt: new Date(),
          });
          batchOps += 1;
        }
        updated += 1;
      }

      const subSubSnap = await subDoc.ref.collection('subcategories').get();
      for (const subSubDoc of subSubSnap.docs) {
        const subSubData = subSubDoc.data() as Record<string, unknown>;
        scanned += 1;

        const subSubName = String(subSubData.name || subSubDoc.id);
        const subSubDescription = String(subSubData.description || '');

        const subSubEnriched = await enrichNodeTranslations(
          subSubData.translations,
          subSubName,
          subSubDescription
        );

        if (subSubEnriched.changed) {
          if (DRY_RUN) {
            console.log(`[DRY] subsub ${categoryDoc.id}/${subDoc.id}/${subSubDoc.id}`);
          } else {
            batch.update(subSubDoc.ref, {
              translations: subSubEnriched.updatedTranslations,
              updatedAt: new Date(),
            });
            batchOps += 1;
          }
          updated += 1;
        }

        if (batchOps >= BATCH_LIMIT) {
          await commitBatch();
          await sleep(SLEEP_MS);
        }
      }

      if (batchOps >= BATCH_LIMIT) {
        await commitBatch();
        await sleep(SLEEP_MS);
      }
    }

    if (batchOps >= BATCH_LIMIT) {
      await commitBatch();
      await sleep(SLEEP_MS);
    }
  }

  await commitBatch();

  console.log('\n=== DONE ===');
  console.log(`Scanned nodes: ${scanned}`);
  console.log(`Updated nodes: ${updated}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN' : 'APPLY'}`);
}

run().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
