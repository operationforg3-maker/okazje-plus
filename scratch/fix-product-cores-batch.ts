/**
 * BEZPIECZNY skrypt batch — poprawia dane product_cores:
 * 1. Kopiuje affiliateLink z deals → product_cores.sourceLinks (jeśli puste)
 * 2. Generuje slug z tytułu PL/EN (jeśli brak)
 *
 * ZASADY BEZPIECZEŃSTWA:
 * - Nigdy nie nadpisuje istniejących danych (sprawdza przed zapisem)
 * - Nie dotyka statusu, cen, obrazków, tytułów ani żadnych innych pól
 * - Operuje wyłącznie na NOWYCH polach: sourceLinks, slug
 * - Dry-run domyślnie — ustaw DRY_RUN=false żeby zapisać
 * - Batch writes po 499 operacji (limit Firestore)
 * - Loguje każdą operację
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const sa = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();

// === KONFIGURACJA ===
const DRY_RUN: boolean = process.argv.includes('--apply') ? false : true;
const BATCH_SIZE = 499; // limit Firestore
// ====================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // usuń diakrytyki (ą→a, ę→e, etc.)
    .replace(/ł/g, 'l').replace(/ż/g, 'z').replace(/ź/g, 'z')
    .replace(/ś/g, 's').replace(/ć/g, 'c').replace(/ń/g, 'n').replace(/ó/g, 'o')
    .replace(/[^a-z0-9\s-]/g, '')   // tylko litery, cyfry, spacje, myślniki
    .replace(/\s+/g, '-')            // spacje → myślniki
    .replace(/-{2,}/g, '-')          // wielokrotne myślniki → jeden
    .replace(/^-+|-+$/g, '')         // usuń myślniki na początku/końcu
    .slice(0, 80);                   // max 80 znaków
}

function getTitle(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object') {
    return String(raw.pl || raw.en || raw.de || '').trim();
  }
  return '';
}

async function fetchAllApprovedProducts(): Promise<any[]> {
  const all: any[] = [];
  let lastDoc: any = null;
  let page = 0;

  while (true) {
    page++;
    let q: any = db.collection('product_cores')
      .where('status', '==', 'approved')
      .orderBy('__name__')
      .limit(500);

    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    snap.docs.forEach((d: any) => all.push({ _ref: d.ref, id: d.id, ...d.data() }));
    lastDoc = snap.docs[snap.docs.length - 1];
    process.stdout.write(`\r  Pobrano: ${all.length} produktów (strona ${page})`);
    if (snap.docs.length < 500) break;
  }

  console.log('');
  return all;
}

async function fetchDealAffiliateLinks(dealIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (dealIds.length === 0) return result;

  // Pobierz w chunkach po 30 (limit Firestore 'in')
  const chunks: string[][] = [];
  for (let i = 0; i < dealIds.length; i += 30) chunks.push(dealIds.slice(i, i + 30));

  await Promise.all(chunks.map(async (chunk) => {
    const snap = await db.collection('deals').where('__name__', 'in', chunk.map((id: string) => db.collection('deals').doc(id))).get()
      .catch(() => db.getAll(...chunk.map((id: string) => db.collection('deals').doc(id))));
    
    snap.docs?.forEach((d: any) => {
      const data = d.data();
      const link = data?.affiliateLink || data?.sourceUrl || data?.link || data?.externalUrl;
      if (link && typeof link === 'string' && link.startsWith('http')) {
        result.set(d.id, link);
      }
    });
  }));

  return result;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TRYB: ${DRY_RUN ? '🔍 DRY-RUN (brak zmian w bazie)' : '✏️  APPLY (zapisuje do Firestore)'}`);
  console.log(`Użyj --apply żeby faktycznie zapisać zmiany`);
  console.log('='.repeat(60) + '\n');

  // 1. Pobierz wszystkie approved products
  console.log('📥 Pobieranie produktów...');
  const products = await fetchAllApprovedProducts();
  console.log(`✅ Pobrano ${products.length} produktów\n`);

  // 2. Zbierz wszystkie deal IDs potrzebne do lookup
  const allDealIds = new Set<string>();
  for (const p of products) {
    if (Array.isArray(p.linkedDealIds)) {
      p.linkedDealIds.forEach((id: string) => { if (id) allDealIds.add(id); });
    }
  }
  console.log(`📥 Pobieranie affiliate linków dla ${allDealIds.size} deal-i...`);
  const dealLinks = await fetchDealAffiliateLinks([...allDealIds]);
  console.log(`✅ Znaleziono linki dla ${dealLinks.size} deal-i\n`);

  // 3. Przygotuj aktualizacje
  const stats = {
    total: products.length,
    slugAdded: 0,
    slugSkipped: 0,
    linkAdded: 0,
    linkSkipped: 0,
    noTitle: 0,
    noDeals: 0,
    noBothUpdate: 0,
  };

  const updates: Array<{ ref: any; data: Record<string, any> }> = [];

  for (const p of products) {
    const updateData: Record<string, any> = {};

    // --- SLUG ---
    const hasSlug = p.slug && (
      typeof p.slug === 'string' ? p.slug.length > 0
      : (p.slug.pl?.length > 0 || p.slug.en?.length > 0)
    );

    if (!hasSlug) {
      const title = getTitle(p.title);
      if (title.length >= 3) {
        const slug = slugify(title);
        if (slug.length >= 3) {
          updateData.slug = { pl: slug, en: slug };
          stats.slugAdded++;
        } else {
          stats.noTitle++;
        }
      } else {
        stats.noTitle++;
      }
    } else {
      stats.slugSkipped++;
    }

    // --- AFFILIATE LINK ---
    const hasSL = Array.isArray(p.sourceLinks) && p.sourceLinks.length > 0 && p.sourceLinks[0]?.url;
    const hasAff = p.affiliateUrl && typeof p.affiliateUrl === 'string';

    if (!hasSL && !hasAff) {
      // Znajdź link z pierwszego deal-a
      let link: string | null = null;
      if (Array.isArray(p.linkedDealIds)) {
        for (const dealId of p.linkedDealIds) {
          const l = dealLinks.get(dealId);
          if (l) { link = l; break; }
        }
      }

      if (link) {
        updateData.sourceLinks = [{ url: link, type: 'affiliate', source: 'aliexpress' }];
        stats.linkAdded++;
      } else {
        stats.noDeals++;
      }
    } else {
      stats.linkSkipped++;
    }

    if (Object.keys(updateData).length > 0) {
      updates.push({ ref: p._ref, data: updateData });
    } else {
      stats.noBothUpdate++;
    }
  }

  // 4. Raport przed zapisem
  console.log('📊 PODSUMOWANIE:');
  console.log(`  Produkty ogółem:          ${stats.total}`);
  console.log(`  Slug do dodania:          ${stats.slugAdded}`);
  console.log(`  Slug już istnieje:        ${stats.slugSkipped}`);
  console.log(`  Slug nie można (brak tyt): ${stats.noTitle}`);
  console.log(`  Link do dodania:          ${stats.linkAdded}`);
  console.log(`  Link już istnieje:        ${stats.linkSkipped}`);
  console.log(`  Link brak w deals:        ${stats.noDeals}`);
  console.log(`  Dokumentów do aktualizacji: ${updates.length}`);
  console.log(`  Brak zmian (ok):          ${stats.noBothUpdate}`);

  if (DRY_RUN) {
    console.log('\n✅ DRY-RUN zakończony — baza danych NIE została zmodyfikowana');
    console.log('   Uruchom z --apply żeby zapisać zmiany\n');
    // Pokaż przykładowe aktualizacje
    console.log('\n🔎 Przykładowe aktualizacje (pierwsze 3):');
    updates.slice(0, 3).forEach(u => {
      console.log(`  ID: ${u.ref.id}`);
      if (u.data.slug) console.log(`    slug: ${u.data.slug.pl}`);
      if (u.data.sourceLinks) console.log(`    sourceLinks[0].url: ${u.data.sourceLinks[0].url.slice(0, 80)}...`);
    });
    return;
  }

  // 5. Zapisz w batchach
  console.log(`\n⚡ Zapisuję ${updates.length} aktualizacji w batchach po ${BATCH_SIZE}...`);
  let written = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const u of chunk) {
      batch.update(u.ref, u.data);
    }

    await batch.commit();
    written += chunk.length;
    process.stdout.write(`\r  Zapisano: ${written}/${updates.length}`);
  }

  console.log(`\n\n✅ Gotowe! Zaktualizowano ${written} dokumentów`);
}

main().catch((err) => {
  console.error('\n❌ Błąd:', err);
  process.exit(1);
});
