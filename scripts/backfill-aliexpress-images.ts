import 'dotenv/config';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAliExpressClient } from '../src/lib/integrations/aliexpress-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN = !process.argv.includes('--apply');
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 500);
const MIN_IMAGES = Number(process.argv.find((arg) => arg.startsWith('--min-images='))?.split('=')[1] || 2);
const SOURCE_ONLY = process.argv.find((arg) => arg.startsWith('--source='))?.split('=')[1] || 'aliexpress';
const API_CHUNK = 50; // AliExpress detail API hard limit
const WRITE_CHUNK = 400; // Firestore max 500

type DealDoc = QueryDocumentSnapshot<DocumentData>;

type Candidate = {
  dealDoc: DealDoc;
  dealData: DocumentData;
  dealId: string;
  sourceProductId: string;
  productCoreId?: string;
  currentImagesCount: number;
};

function getImagesCountFromDeal(data: DocumentData): number {
  const images = Array.isArray(data.images) ? data.images : [];
  const gallery = Array.isArray(data.gallery) ? data.gallery : [];
  const imageUrl = typeof data.imageUrl === 'string' && data.imageUrl.trim().length > 0 ? 1 : 0;
  return Math.max(images.length, gallery.length, imageUrl);
}

function normalizeUrl(url: unknown): string {
  return String(url || '').trim();
}

function extractImageCandidates(detailProduct: any): string[] {
  const images: string[] = [];
  const push = (value: unknown) => {
    const url = normalizeUrl(value);
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return;
    if (!images.includes(url)) images.push(url);
  };

  push(detailProduct.product_main_image_url);
  push(detailProduct.image_url);
  push(detailProduct.preview_image_url);

  const buckets = [
    detailProduct.product_small_image_urls,
    detailProduct.product_small_image_urls?.string,
    detailProduct.small_images,
    detailProduct.sub_images,
    detailProduct.images,
  ];

  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      for (const item of bucket) {
        if (typeof item === 'string') {
          push(item);
        } else if (item && typeof item === 'object') {
          push((item as any).url);
          push((item as any).imageUrl);
          push((item as any).src);
        }
      }
      continue;
    }

    if (bucket && typeof bucket === 'object') {
      const obj = bucket as Record<string, unknown>;
      // Common AliExpress shape: { string: [...] } or { string: 'url' }
      const nested = obj.string;
      if (Array.isArray(nested)) {
        nested.forEach((entry) => push(entry));
      } else if (typeof nested === 'string') {
        push(nested);
      }

      // Defensive extraction for alternate payload shapes
      push(obj.url);
      push(obj.imageUrl);
      push(obj.src);

      // If object has arbitrary values, scan shallow strings/arrays
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          push(value);
        } else if (Array.isArray(value)) {
          value.forEach((entry) => push(entry));
        }
      }
      continue;
    }

    if (typeof bucket === 'string') {
      const raw = bucket.trim();
      if (!raw) continue;

      if (raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((entry) => push(entry));
          }
        } catch {
          // ignore malformed JSON
        }
      } else {
        raw.split(/[;,]/g).forEach((entry) => push(entry));
      }
    }
  }

  return images;
}

function extractDetailProducts(resp: any): any[] {
  if (!resp || typeof resp !== 'object') return [];

  for (const key of Object.keys(resp)) {
    const payload = (resp as any)[key];
    if (!payload || typeof payload !== 'object') continue;

    if (Array.isArray(payload.products)) return payload.products;
    if (Array.isArray(payload.products_module_dto_list)) return payload.products_module_dto_list;
    if (Array.isArray(payload.result?.products)) return payload.result.products;
    if (Array.isArray(payload.resp_result?.result?.products)) return payload.resp_result.result.products;
    if (Array.isArray(payload.resp_result?.result?.products?.product)) return payload.resp_result.result.products.product;
  }

  return [];
}

function getProductIdFromDetailItem(item: any): string {
  return String(item?.product_id || item?.id || item?.item_id || '').trim();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function loadCandidates(db: ReturnType<typeof getFirestore>): Promise<Candidate[]> {
  const snap = await db.collection('deals').where('source', '==', SOURCE_ONLY).limit(LIMIT).get();

  const candidates: Candidate[] = [];

  for (const doc of snap.docs) {
    const dealData = doc.data();
    const count = getImagesCountFromDeal(dealData);

    if (count >= MIN_IMAGES) continue;

    const sourceProductId = String(
      dealData.sourceProductId || dealData.metadata?.originalId || ''
    ).trim();
    if (!sourceProductId) continue;

    candidates.push({
      dealDoc: doc,
      dealData,
      dealId: doc.id,
      sourceProductId,
      productCoreId: String(dealData.productCoreId || '').trim() || undefined,
      currentImagesCount: count,
    });
  }

  return candidates;
}

async function main() {
  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error('Brak serviceAccountKey.json w katalogu repo');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }

  const db = getFirestore();
  const client = getAliExpressClient();

  console.log('🖼️  Backfill zdjęć AliExpress');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`Source: ${SOURCE_ONLY}`);
  console.log(`Limit: ${LIMIT}`);
  console.log(`Min images required: ${MIN_IMAGES}`);

  const candidates = await loadCandidates(db);
  console.log(`Kandydatów do naprawy: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nic do zrobienia.');
    return;
  }

  const idSet = Array.from(new Set(candidates.map((c) => c.sourceProductId)));
  const idChunks = chunkArray(idSet, API_CHUNK);

  const detailByProductId = new Map<string, any>();
  let apiErrors = 0;

  for (const chunk of idChunks) {
    try {
      const detailResponse = await client.getAffiliateProductDetails(chunk);
      const detailProducts = extractDetailProducts(detailResponse);
      for (const item of detailProducts) {
        const id = getProductIdFromDetailItem(item);
        if (id) detailByProductId.set(id, item);
      }
    } catch (err: any) {
      apiErrors++;
      console.warn(`API chunk failed (${chunk.length} ids): ${err?.message || err}`);
    }
  }

  console.log(`Detail response mapped for ${detailByProductId.size} produktów (API errors: ${apiErrors})`);

  let updatedDeals = 0;
  let updatedProducts = 0;
  let skippedNoDetail = 0;
  let skippedNoImages = 0;

  let batch = db.batch();
  let writes = 0;
  const touchedProducts = new Set<string>();

  for (const candidate of candidates) {
    const detail = detailByProductId.get(candidate.sourceProductId);
    if (!detail) {
      skippedNoDetail++;
      continue;
    }

    const images = extractImageCandidates(detail);
    if (images.length < MIN_IMAGES) {
      skippedNoImages++;
      continue;
    }

    const now = new Date().toISOString();
    const primary = images[0];

    const dealUpdate: Record<string, unknown> = {
      imageUrl: primary,
      images,
      gallery: images,
      updatedAt: now,
      'metadata.imageBackfillSource': 'aliexpress.affiliate.productdetail.get',
      'metadata.imageBackfilledAt': now,
    };

    if (DRY_RUN) {
      updatedDeals++;
    } else {
      batch.update(candidate.dealDoc.ref, dealUpdate);
      writes++;
      updatedDeals++;
    }

    if (candidate.productCoreId && !touchedProducts.has(candidate.productCoreId)) {
      touchedProducts.add(candidate.productCoreId);
      const productRef = db.collection('product_cores').doc(candidate.productCoreId);
      const productSnap = await productRef.get();

      if (productSnap.exists) {
        const productData = productSnap.data() || {};
        const currentCount = Array.isArray(productData.images) ? productData.images.length : (productData.imageUrl ? 1 : 0);

        if (currentCount < images.length) {
          const productUpdate: Record<string, unknown> = {
            imageUrl: primary,
            images,
            updatedAt: now,
            'metadata.imageBackfillSource': 'aliexpress.affiliate.productdetail.get',
            'metadata.imageBackfilledAt': now,
          };

          if (DRY_RUN) {
            updatedProducts++;
          } else {
            batch.update(productRef, productUpdate);
            writes++;
            updatedProducts++;
          }
        }
      }
    }

    if (!DRY_RUN && writes >= WRITE_CHUNK) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
      // Small throttle for Firestore/API stability
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  if (!DRY_RUN && writes > 0) {
    await batch.commit();
  }

  console.log('\n=== PODSUMOWANIE ===');
  console.log(`updatedDeals=${updatedDeals}`);
  console.log(`updatedProducts=${updatedProducts}`);
  console.log(`skippedNoDetail=${skippedNoDetail}`);
  console.log(`skippedNoImages=${skippedNoImages}`);
  console.log(`apiErrors=${apiErrors}`);
}

main().catch((err) => {
  console.error('FATAL:', err?.message || err);
  process.exit(1);
});
