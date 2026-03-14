/**
 * backfill-missing-translations.ts
 *
 * Uzupełnia brakujące tłumaczenia (pl/en/de/fr/es/uk) w kolekcjach deals i product_cores.
 *
 * Problem:
 *   - Harvester historycznie zapisywał toLocalizedText() z tylko pl/en/de
 *   - Po moderacji (status: approved) deal_refiner nie brał ich pod uwagę
 *   - Wynik: 1366 deali z title={ pl:'...' } i 28 produktów z title={ pl, en, de }
 *
 * Użycie:
 *   Dry-run (domyślny): npm run backfill:translations
 *   Apply:              npm run backfill:translations:apply
 *   Limit batchowy:     ... --limit=200
 *   Tylko deale:        ... --only=deals
 *   Tylko produkty:     ... --only=products
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { translateContent } from '../src/ai/flows/enrichment';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DRY_RUN = !process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] as 'deals' | 'products' | undefined;
const BATCH_SIZE = 400; // Firestore writeBatch max = 500; leave room for safety

const LANGS: Array<'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk'> = ['pl', 'en', 'de', 'fr', 'es', 'uk'];

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
const keyPath = path.resolve('serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Brak serviceAccountKey.json w katalogu głównym projektu');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hasAllLangs(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return LANGS.every((k) => typeof obj[k] === 'string' && String(obj[k]).trim().length > 0);
}

function getBestFallback(value: Record<string, unknown>): { text: string; locale: 'pl' | 'en' | 'de' } {
  for (const locale of ['pl', 'en', 'de'] as const) {
    const v = value[locale];
    if (typeof v === 'string' && v.trim().length > 0) {
      return { text: v.trim(), locale };
    }
  }
  return { text: '', locale: 'pl' };
}

async function translateMissing(
  value: Record<string, unknown>
): Promise<Record<string, string> | null> {
  const { text, locale } = getBestFallback(value);
  if (!text) return null;

  const missingInRecord = LANGS.filter(
    (k) => !value[k] || typeof value[k] !== 'string' || String(value[k]).trim().length === 0
  );
  if (missingInRecord.length === 0) return null;

  // If source locale itself is missing, populate it directly from fallback text.
  const directFill: Record<string, string> = {};
  if (missingInRecord.includes(locale)) {
    directFill[locale] = text;
  }

  const targetLocales = missingInRecord.filter((k) => k !== locale);

  try {
    if (targetLocales.length === 0) {
      return directFill;
    }

    const result = await translateContent({
      text,
      sourceLocale: locale,
      targetLocales,
    });
    return {
      ...directFill,
      ...(result.translations || {}),
    };
  } catch (err) {
    console.warn('[translate] Błąd tłumaczenia, używam fallback:', (err as Error).message?.slice(0, 80));
    // Fallback: copy the best available text (better than empty string)
    return Object.fromEntries(missingInRecord.map((k) => [k, text]));
  }
}

// ---------------------------------------------------------------------------
// Backfill: deals
// ---------------------------------------------------------------------------
async function backfillDeals(): Promise<{ scanned: number; updated: number; skipped: number; errors: number }> {
  console.log('\n=== Deals backfill ===');
  let scanned = 0, updated = 0, skipped = 0, errors = 0;

  // Pobierz deale z niekompletnymi tłumaczeniami (tylko pl lub tylko pl/en/de)
  // Firestore nie ma operatora "pole nie istnieje", więc musimy sprawdzić po stronie klienta
  const statusesToCheck: string[] = ['approved', 'draft', 'pending', 'pending_approval'];
  const allDocs: admin.firestore.QueryDocumentSnapshot[] = [];

  for (const status of statusesToCheck) {
    const snap = await db.collection('deals').where('status', '==', status).limit(LIMIT).get();
    for (const doc of snap.docs) {
      allDocs.push(doc);
    }
    if (allDocs.length >= LIMIT) break;
  }

  console.log(`Pobrano ${allDocs.length} deali do sprawdzenia`);

  // Filtruj te z brakującymi tłumaczeniami
  const toProcess = allDocs.filter((doc) => {
    const d = doc.data();
    return !hasAllLangs(d.title) || !hasAllLangs(d.description);
  });

  console.log(`Wymaga aktualizacji: ${toProcess.length} deali`);

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of toProcess) {
    scanned++;
    const d = doc.data();

    try {
      const updates: Record<string, unknown> = {};
      let changed = false;

      // title
      if (!hasAllLangs(d.title)) {
        const titleObj = typeof d.title === 'object' && d.title ? (d.title as Record<string, unknown>) : { pl: String(d.title || '') };
        const translations = await translateMissing(titleObj);
        if (translations) {
          const mergedTitle = { ...titleObj };
          for (const [lang, text] of Object.entries(translations)) {
            if (text) mergedTitle[lang] = text;
          }
          updates.title = mergedTitle;
          changed = true;
        }
      }

      // description (często brakuje zupełnie — wtedy generujemy z title)
      if (!hasAllLangs(d.description)) {
        const descObj: Record<string, unknown> =
          typeof d.description === 'object' && d.description
            ? (d.description as Record<string, unknown>)
            : {};

        // Jeśli description jest puste, użyj przetłumaczonego title jako bazy
        const sourceForDesc = { ...descObj };
        if (!sourceForDesc.pl && !sourceForDesc.en && !sourceForDesc.de) {
          const titleData = (updates.title as Record<string, unknown>) || d.title;
          if (titleData && typeof titleData === 'object') {
            for (const l of ['pl', 'en', 'de'] as const) {
              const v = (titleData as Record<string, unknown>)[l];
              if (typeof v === 'string' && v.trim()) sourceForDesc[l] = sourceForDesc[l] || v;
            }
          }
        }

        const translations = await translateMissing(sourceForDesc);
        if (translations) {
          const mergedDesc = { ...sourceForDesc };
          for (const [lang, text] of Object.entries(translations)) {
            if (text) mergedDesc[lang] = text;
          }
          updates.description = mergedDesc;
          changed = true;
        }
      }

      if (!changed) {
        skipped++;
        continue;
      }

      updates.updatedAt = new Date().toISOString();
      updates['metadata.translationBackfilledAt'] = new Date().toISOString();

      if (DRY_RUN) {
        const titleKeys = Object.keys((updates.title as object) || {});
        console.log(`[DRY-RUN] deal ${doc.id}: title={${titleKeys.join(',')}}`);
        updated++;
      } else {
        batch.update(doc.ref, updates);
        batchCount++;
        updated++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`Scommitowano batch ${batchCount} deali...`);
          batch = db.batch();
          batchCount = 0;
          // Rate-limit: daj AI API chwilę oddechu
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch (err) {
      errors++;
      console.error(`[ERROR] deal ${doc.id}:`, (err as Error).message?.slice(0, 120));
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`Scommitowano końcowy batch ${batchCount} deali.`);
  }

  return { scanned, updated, skipped, errors };
}

// ---------------------------------------------------------------------------
// Backfill: product_cores
// ---------------------------------------------------------------------------
async function backfillProducts(): Promise<{ scanned: number; updated: number; skipped: number; errors: number }> {
  console.log('\n=== Products backfill ===');
  let scanned = 0, updated = 0, skipped = 0, errors = 0;

  const snap = await db.collection('product_cores').limit(LIMIT).get();
  console.log(`Pobrano ${snap.size} produktów do sprawdzenia`);

  const toProcess = snap.docs.filter((doc) => {
    const d = doc.data();
    return !hasAllLangs(d.title) || !hasAllLangs(d.shortDescription) || !hasAllLangs(d.fullDescription);
  });

  console.log(`Wymaga aktualizacji: ${toProcess.length} produktów`);

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of toProcess) {
    scanned++;
    const d = doc.data();

    try {
      const updates: Record<string, unknown> = {};
      let changed = false;

      for (const field of ['title', 'shortDescription', 'fullDescription'] as const) {
        if (!hasAllLangs(d[field])) {
          const fieldObj =
            typeof d[field] === 'object' && d[field]
              ? (d[field] as Record<string, unknown>)
              : { pl: String(d[field] || '') };

          const translations = await translateMissing(fieldObj);
          if (translations) {
            const merged = { ...fieldObj };
            for (const [lang, text] of Object.entries(translations)) {
              if (text) merged[lang] = text;
            }
            updates[field] = merged;
            changed = true;
          }
        }
      }

      if (!changed) {
        skipped++;
        continue;
      }

      updates.updatedAt = new Date().toISOString();
      updates['metadata.translationBackfilledAt'] = new Date().toISOString();

      if (DRY_RUN) {
        const titleKeys = Object.keys((updates.title as object) || d.title || {});
        console.log(`[DRY-RUN] product ${doc.id}: title={${titleKeys.join(',')}}`);
        updated++;
      } else {
        batch.update(doc.ref, updates);
        batchCount++;
        updated++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`Scommitowano batch ${batchCount} produktów...`);
          batch = db.batch();
          batchCount = 0;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch (err) {
      errors++;
      console.error(`[ERROR] product ${doc.id}:`, (err as Error).message?.slice(0, 120));
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`Scommitowano końcowy batch ${batchCount} produktów.`);
  }

  return { scanned, updated, skipped, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🌍 Backfill brakujących tłumaczeń (pl/en/de/fr/es/uk)`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY-RUN (brak zapisu)' : '✏️  APPLY (zapis do Firestore)'}`);
  console.log(`Limit: ${LIMIT} rekordów na kolekcję`);
  if (ONLY) console.log(`Zakres: tylko ${ONLY}`);
  console.log('---');

  const startTime = Date.now();
  const results: Record<string, { scanned: number; updated: number; skipped: number; errors: number }> = {};

  if (!ONLY || ONLY === 'deals') {
    results.deals = await backfillDeals();
  }
  if (!ONLY || ONLY === 'products') {
    results.products = await backfillProducts();
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Wyniki ===');
  for (const [coll, r] of Object.entries(results)) {
    console.log(`${coll}: sprawdzono=${r.scanned} aktualizacji=${r.updated} pominięto=${r.skipped} błędów=${r.errors}`);
  }
  console.log(`Czas: ${elapsedSec}s`);

  if (DRY_RUN) {
    console.log('\nℹ️  Uruchom z --apply żeby zapisać zmiany do Firestore');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
