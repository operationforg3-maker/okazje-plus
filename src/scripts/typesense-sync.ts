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
      { name: 'price', type: 'float', optional: true },
      { name: 'originalPrice', type: 'float', optional: true },
      { name: 'mainCategorySlug', type: 'string', facet: true },
      { name: 'subCategorySlug', type: 'string', facet: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'ratingCard_average', type: 'float', optional: true },
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
      { name: 'price', type: 'float', optional: true },
      { name: 'originalPrice', type: 'float', optional: true },
      { name: 'mainCategorySlug', type: 'string', facet: true },
      { name: 'subCategorySlug', type: 'string', facet: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'temperature', type: 'int32', optional: true },
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
    title: d.title,
    description: d.description,
    price: d.price,
    originalPrice: d.originalPrice,
    mainCategorySlug: d.mainCategorySlug,
    subCategorySlug: d.subCategorySlug,
    status: d.status,
    temperature: d.temperature,
    voteCount: d.voteCount,
    postedBy: d.postedBy,
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
    name: p.name,
    description: p.description,
    longDescription: p.longDescription,
    image: p.image,
    affiliateUrl: p.affiliateUrl,
    price: p.price,
    originalPrice: p.originalPrice,
    mainCategorySlug: p.mainCategorySlug,
    subCategorySlug: p.subCategorySlug,
    status: p.status,
    ratingCard_average: p.ratingCard?.average,
    ratingCard_count: p.ratingCard?.count,
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
