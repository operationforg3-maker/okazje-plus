/**
 * Backfill script: set totalPrice = price.amount + shipping.cost for all deals missing this field.
 *
 * Usage:
 *   npx tsx scripts/backfill-total-price.ts           # dry run (preview only)
 *   npx tsx scripts/backfill-total-price.ts --apply   # apply changes
 *   npx tsx scripts/backfill-total-price.ts --apply --limit=1000
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import path from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN = !process.argv.includes('--apply');
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 5000);
const WRITE_CHUNK = 450; // Stay well under Firestore 500/batch limit

// ── Firebase Admin init ────────────────────────────────────────────────────────
const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!getApps().length) {
  initializeApp({ credential: cert(keyPath) });
}
const db = getFirestore();

// ── Helpers ────────────────────────────────────────────────────────────────────
function toNum(value: unknown): number {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function computeTotalPrice(data: Record<string, unknown>): number | null {
  const priceAmount =
    toNum((data.price as any)?.amount) ||
    toNum((data.smartPrice as any)?.amount) ||
    toNum(data.price) ||
    toNum(data.legacyPrice) ||
    0;

  const shippingCost =
    toNum((data.shipping as any)?.cost) ||
    toNum(data.shippingCost) ||
    toNum((data.smartPrice as any)?.shippingCost) ||
    toNum((data.metadata as any)?.shippingDetails?.cost) ||
    0;

  if (priceAmount <= 0) return null; // skip records with no price at all
  return priceAmount + shippingCost;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[backfill-total-price] ${DRY_RUN ? '⚠️  DRY RUN — no writes' : '✅ APPLY mode'}`);
  console.log(`Scanning up to ${LIMIT} deals...\n`);

  const snapshot = await db.collection('deals').limit(LIMIT).get();
  console.log(`Fetched ${snapshot.size} deals.`);

  const toUpdate: Array<{ id: string; totalPrice: number }> = [];
  let skippedNoPrice = 0;
  let alreadyHasTotal = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as Record<string, unknown>;

    if (typeof data.totalPrice === 'number' && isFinite(data.totalPrice)) {
      alreadyHasTotal++;
      continue;
    }

    const computed = computeTotalPrice(data);
    if (computed === null) {
      skippedNoPrice++;
      continue;
    }

    toUpdate.push({ id: docSnap.id, totalPrice: computed });
  }

  console.log(`  Already has totalPrice: ${alreadyHasTotal}`);
  console.log(`  Skipped (no price data): ${skippedNoPrice}`);
  console.log(`  Needs update: ${toUpdate.length}`);

  if (DRY_RUN) {
    console.log('\nSample (first 5):');
    toUpdate.slice(0, 5).forEach(({ id, totalPrice }) =>
      console.log(`  ${id} → totalPrice: ${totalPrice.toFixed(2)}`)
    );
    console.log('\nRe-run with --apply to commit changes.');
    return;
  }

  // Write in chunks of WRITE_CHUNK
  let written = 0;
  for (let i = 0; i < toUpdate.length; i += WRITE_CHUNK) {
    const chunk = toUpdate.slice(i, i + WRITE_CHUNK);
    const batch: WriteBatch = db.batch();
    for (const { id, totalPrice } of chunk) {
      batch.update(db.collection('deals').doc(id), { totalPrice });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  Committed ${written} / ${toUpdate.length}`);
  }

  console.log(`\n✅ Done. Updated ${written} deals with totalPrice.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
