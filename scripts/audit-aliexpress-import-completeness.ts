import 'dotenv/config';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAliExpressClient } from '../src/lib/integrations/aliexpress-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 1000);
const STRICT = process.argv.includes('--strict');
const SAMPLE = Number(process.argv.find((arg) => arg.startsWith('--sample='))?.split('=')[1] || 0);
const API_CHUNK = 50;

const LANGS = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

type DealDoc = QueryDocumentSnapshot<DocumentData>;

type Candidate = {
  dealId: string;
  sourceProductId: string;
  productCoreId?: string;
  dealData: DocumentData;
  dealRef: DealDoc;
};

type IssueCode =
  | 'missing_source_product_id'
  | 'missing_detail_api_record'
  | 'missing_images_while_available'
  | 'missing_price_while_available'
  | 'missing_link_while_available'
  | 'missing_shipping_fields'
  | 'missing_localized_title'
  | 'missing_localized_description'
  | 'product_missing_images_while_available';

type Issue = {
  dealId: string;
  productCoreId?: string;
  sourceProductId?: string;
  code: IssueCode;
  detail?: string;
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function getImageCount(data: any): number {
  const images = Array.isArray(data?.images) ? data.images.length : 0;
  const gallery = Array.isArray(data?.gallery) ? data.gallery.length : 0;
  const imageUrl = typeof data?.imageUrl === 'string' && data.imageUrl.trim().length > 0 ? 1 : 0;
  return Math.max(images, gallery, imageUrl);
}

function hasAllLangs(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return LANGS.every((lang) => typeof v[lang] === 'string' && String(v[lang]).trim().length > 0);
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

function getDetailImageCount(item: any): number {
  const main = typeof item?.product_main_image_url === 'string' && item.product_main_image_url.trim() ? 1 : 0;
  const smallImages = item?.product_small_image_urls?.string;
  const small = Array.isArray(smallImages)
    ? smallImages.filter((v: unknown) => typeof v === 'string' && String(v).trim().length > 0).length
    : 0;
  return main + small;
}

async function loadCandidates(db: ReturnType<typeof getFirestore>): Promise<Candidate[]> {
  const snap = await db.collection('deals').where('source', '==', 'aliexpress').limit(LIMIT).get();

  let docs = snap.docs;
  if (SAMPLE > 0 && SAMPLE < docs.length) {
    docs = docs.slice(0, SAMPLE);
  }

  return docs.map((doc) => {
    const data = doc.data();
    const sourceProductId = String(data.sourceProductId || data.metadata?.originalId || '').trim();
    const productCoreId = String(data.productCoreId || '').trim() || undefined;

    return {
      dealId: doc.id,
      sourceProductId,
      productCoreId,
      dealData: data,
      dealRef: doc,
    };
  });
}

async function main() {
  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error('Brak serviceAccountKey.json');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }

  const db = getFirestore();
  const client = getAliExpressClient();

  const candidates = await loadCandidates(db);
  const issues: Issue[] = [];

  console.log('🔎 Audit AliExpress import completeness');
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Limit: ${LIMIT}`);
  console.log(`Strict: ${STRICT ? 'ON' : 'OFF'}`);

  const idSet = Array.from(new Set(candidates.map((c) => c.sourceProductId).filter(Boolean)));
  const idChunks = chunkArray(idSet, API_CHUNK);

  const detailMap = new Map<string, any>();
  let apiErrors = 0;

  for (const chunk of idChunks) {
    try {
      const resp = await client.getAffiliateProductDetails(chunk);
      const products = extractDetailProducts(resp);
      for (const p of products) {
        const id = getProductIdFromDetailItem(p);
        if (id) detailMap.set(id, p);
      }
    } catch (err: any) {
      apiErrors++;
      console.warn(`[audit] API chunk error (${chunk.length} ids): ${err?.message || err}`);
    }
  }

  console.log(`Detail API coverage: ${detailMap.size}/${idSet.length} unique sourceProductId`);

  let checkedDeals = 0;
  for (const candidate of candidates) {
    checkedDeals++;

    if (!candidate.sourceProductId) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        code: 'missing_source_product_id',
      });
      continue;
    }

    const detail = detailMap.get(candidate.sourceProductId);
    if (!detail) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        sourceProductId: candidate.sourceProductId,
        code: 'missing_detail_api_record',
      });
      continue;
    }

    const detailImageCount = getDetailImageCount(detail);
    const dealImageCount = getImageCount(candidate.dealData);

    if (detailImageCount >= 2 && dealImageCount < 2) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        sourceProductId: candidate.sourceProductId,
        code: 'missing_images_while_available',
        detail: `detailImages=${detailImageCount}, dealImages=${dealImageCount}`,
      });
    }

    const hasDetailPrice = Number(detail?.target_sale_price || 0) > 0 || Number(detail?.original_price || 0) > 0;
    const hasDealPrice = Number(candidate.dealData?.price?.amount || 0) > 0;
    if (hasDetailPrice && !hasDealPrice) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        sourceProductId: candidate.sourceProductId,
        code: 'missing_price_while_available',
      });
    }

    const hasDetailLink = Boolean(detail?.product_detail_url || detail?.promotion_link);
    const hasDealLink = Boolean(candidate.dealData?.affiliateUrl || candidate.dealData?.sourceUrl || candidate.dealData?.dealUrl);
    if (hasDetailLink && !hasDealLink) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        sourceProductId: candidate.sourceProductId,
        code: 'missing_link_while_available',
      });
    }

    const shipping = candidate.dealData?.shipping;
    const hasShipping = shipping && typeof shipping === 'object' && Number(shipping.timeDays ?? 0) > 0 && typeof shipping.cost === 'number';
    if (!hasShipping) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        sourceProductId: candidate.sourceProductId,
        code: 'missing_shipping_fields',
      });
    }

    if (!hasAllLangs(candidate.dealData?.title)) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        sourceProductId: candidate.sourceProductId,
        code: 'missing_localized_title',
      });
    }

    if (!hasAllLangs(candidate.dealData?.description)) {
      issues.push({
        dealId: candidate.dealId,
        productCoreId: candidate.productCoreId,
        sourceProductId: candidate.sourceProductId,
        code: 'missing_localized_description',
      });
    }

    if (candidate.productCoreId) {
      const productSnap = await db.collection('product_cores').doc(candidate.productCoreId).get();
      if (productSnap.exists) {
        const productData = productSnap.data() || {};
        const productImageCount = getImageCount(productData);
        if (detailImageCount >= 2 && productImageCount < 2) {
          issues.push({
            dealId: candidate.dealId,
            productCoreId: candidate.productCoreId,
            sourceProductId: candidate.sourceProductId,
            code: 'product_missing_images_while_available',
            detail: `detailImages=${detailImageCount}, productImages=${productImageCount}`,
          });
        }
      }
    }
  }

  const byCode = new Map<IssueCode, number>();
  for (const issue of issues) {
    byCode.set(issue.code, (byCode.get(issue.code) || 0) + 1);
  }

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`checkedDeals=${checkedDeals}`);
  console.log(`apiErrors=${apiErrors}`);
  console.log(`totalIssues=${issues.length}`);

  const sortedCodes = Array.from(byCode.entries()).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sortedCodes) {
    console.log(`${code}=${count}`);
  }

  const sampleIssues = issues.slice(0, 20);
  if (sampleIssues.length > 0) {
    console.log('\n=== ISSUE SAMPLE (first 20) ===');
    for (const issue of sampleIssues) {
      console.log(JSON.stringify(issue));
    }
  }

  if (STRICT && (issues.length > 0 || apiErrors > 0)) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('FATAL:', err?.message || err);
  process.exit(1);
});
