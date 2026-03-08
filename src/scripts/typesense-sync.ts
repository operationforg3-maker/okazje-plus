import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import Typesense from 'typesense';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin (reuse logic from seed)
function initFirebaseAdmin() {
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!admin.apps.length) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        } as any),
        projectId: projectIdEnv,
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectIdEnv,
      });
    }
    admin.firestore().settings({ ignoreUndefinedProperties: true });
  }
}

function initTypesenseAdmin() {
  const host = process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST;
  const port = parseInt(process.env.TYPESENSE_PORT || process.env.NEXT_PUBLIC_TYPESENSE_PORT || '443', 10);
  const protocol = process.env.TYPESENSE_PROTOCOL || process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || 'https';
  const apiKey = process.env.TYPESENSE_ADMIN_API_KEY;
  if (!host || !apiKey) {
    throw new Error('Missing Typesense admin config. Set TYPESENSE_HOST, TYPESENSE_PORT, TYPESENSE_PROTOCOL and TYPESENSE_ADMIN_API_KEY');
  }
  return new (Typesense as any).Client({
    nodes: [{ host, port, protocol }],
    apiKey,
    connectionTimeoutSeconds: 5,
  });
}

function toFloat(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value && typeof value === 'object') {
    const maybeAmount = (value as { amount?: unknown }).amount;
    return toFloat(maybeAmount, fallback);
  }
  return fallback;
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Math.round(toFloat(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

async function ensureProductsSchema(client: any) {
  const schema = {
    name: 'products',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'longDescription', type: 'string', optional: true },
      { name: 'image', type: 'string', optional: true },
      { name: 'affiliateUrl', type: 'string', optional: true },
      { name: 'price', type: 'float' },
      { name: 'originalPrice', type: 'float', optional: true },
      { name: 'mainCategorySlug', type: 'string', facet: true },
      { name: 'subCategorySlug', type: 'string', facet: true },
      { name: 'subSubCategorySlug', type: 'string', facet: true, optional: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'ratingCard_average', type: 'float' },
      { name: 'ratingCard_count', type: 'int32', optional: true },
    ],
    default_sorting_field: 'ratingCard_average',
  } as any;

  try {
  await client.collections('products').retrieve();
    // Try to update (Typesense supports partial update of schema in newer versions; if not, ignore)
  } catch {
    await client.collections().create(schema);
  }
}

async function ensureDealsSchema(client: any) {
  const schema = {
    name: 'deals',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'price', type: 'float' },
      { name: 'originalPrice', type: 'float', optional: true },
      { name: 'mainCategorySlug', type: 'string', facet: true },
      { name: 'subCategorySlug', type: 'string', facet: true },
      { name: 'subSubCategorySlug', type: 'string', facet: true, optional: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'temperature', type: 'int32' },
      { name: 'voteCount', type: 'int32', optional: true },
      { name: 'postedBy', type: 'string', optional: true },
    ],
    default_sorting_field: 'temperature',
  } as any;

  try {
    await client.collections('deals').retrieve();
  } catch {
    await client.collections().create(schema);
  }
}

async function fetchApprovedDeals(): Promise<any[]> {
  const db = admin.firestore();
  const snap = await db.collection('deals').where('status', '==', 'approved').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function mapDealForIndex(d: any) {
  return {
    id: d.id,
    title: toText(d.title),
    description: toText(d.description),
    price: toFloat(d.price, 0),
    originalPrice: d.originalPrice,
    mainCategorySlug: toText(d.mainCategorySlug),
    subCategorySlug: toText(d.subCategorySlug),
    subSubCategorySlug: toText(d.subSubCategorySlug),
    status: toText(d.status),
    temperature: toInt(d.temperature, 0),
    voteCount: toInt(d.voteCount, 0),
    postedBy: toText(d.postedBy),
  };
}

async function upsertDeals(client: any, docs: any[]) {
  if (!docs.length) return;
  const chunkSize = 100;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = docs.slice(i, i + chunkSize);
    await client.collections('deals').documents().import(batch, { action: 'upsert' });
  }
}

async function fetchApprovedProducts(): Promise<any[]> {
  const db = admin.firestore();
  const snap = await db.collection('products').where('status', '==', 'approved').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function mapProductForIndex(p: any) {
  return {
    id: p.id,
    name: toText(p.name),
    description: toText(p.description),
    longDescription: toText(p.longDescription),
    image: toText(p.image),
    affiliateUrl: toText(p.affiliateUrl),
    price: toFloat(p.price, 0),
    originalPrice: p.originalPrice,
    mainCategorySlug: toText(p.mainCategorySlug),
    subCategorySlug: toText(p.subCategorySlug),
    subSubCategorySlug: toText(p.subSubCategorySlug),
    status: toText(p.status),
    ratingCard_average: toFloat(p.ratingCard?.average, 0),
    ratingCard_count: toInt(p.ratingCard?.count, 0),
  };
}

async function upsertProducts(client: any, docs: any[]) {
  if (!docs.length) return;
  const chunkSize = 100;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = docs.slice(i, i + chunkSize);
    await client.collections('products').documents().import(batch, { action: 'upsert' });
  }
}

async function main() {
  initFirebaseAdmin();
  const typesense = initTypesenseAdmin();
  await ensureProductsSchema(typesense);
  await ensureDealsSchema(typesense);
  const products = await fetchApprovedProducts();
  const productDocs = products.map(mapProductForIndex);
  await upsertProducts(typesense, productDocs);
  console.log(`Typesense: zsynchronizowano ${productDocs.length} produktów.`);
  const deals = await fetchApprovedDeals();
  const dealDocs = deals.map(mapDealForIndex);
  await upsertDeals(typesense, dealDocs);
  console.log(`Typesense: zsynchronizowano ${dealDocs.length} okazji.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
