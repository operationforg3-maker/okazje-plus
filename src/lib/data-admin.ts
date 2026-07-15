/**
 * Server-only data operations using Firebase Admin SDK
 * Używaj tego modułu tylko w API routes i server-side code
 */

import { adminDb } from '@/lib/firebase-admin';
import { Category, Product, Deal, ProductCore } from '@/lib/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ensureCategoryTranslations } from '@/lib/category-translations';

/**
 * Tworzy kategorię główną w Firestore (Admin SDK)
 */
export async function createCategory(data: { 
  name: string; 
  slug: string; 
  icon?: string; 
  description?: string; 
  sortOrder?: number; 
  accentColor?: string; 
  heroImage?: string; 
}): Promise<string> {
  const ref = adminDb.collection('categories');
  const translations = ensureCategoryTranslations(undefined, data.name, data.description);
  // Idempotent: find existing by slug
  const existing = await ref.where('slug', '==', data.slug).limit(1).get();
  if (!existing.empty) {
    return existing.docs[0].id;
  }
  const docRef = await ref.add({
    ...data,
    translations,
    createdAt: FieldValue.serverTimestamp(),
    sortOrder: data.sortOrder ?? 0,
  });
  return docRef.id;
}

/**
 * Tworzy podkategorię w subkolekcji "subcategories" danej kategorii
 */
export async function createSubcategory(
  categoryId: string, 
  data: { 
    name: string; 
    slug: string; 
    icon?: string; 
    description?: string; 
    sortOrder?: number; 
  }
): Promise<string> {
  const ref = adminDb.collection('categories').doc(categoryId).collection('subcategories');
  const translations = ensureCategoryTranslations(undefined, data.name, data.description);
  // Idempotent: find existing by slug
  const existing = await ref.where('slug', '==', data.slug).limit(1).get();
  if (!existing.empty) {
    return existing.docs[0].id;
  }
  const docRef = await ref.add({
    ...data,
    translations,
    createdAt: FieldValue.serverTimestamp(),
    sortOrder: data.sortOrder ?? 0,
  });
  return docRef.id;
}

/**
 * Tworzy pod-podkategorię w subkolekcji "subcategories" danej podkategorii
 */
export async function createSubSubcategory(
  categoryId: string, 
  subcategoryId: string, 
  data: { 
    name: string; 
    slug: string; 
    icon?: string; 
    description?: string; 
    sortOrder?: number; 
  }
): Promise<string> {
  const ref = adminDb
    .collection('categories')
    .doc(categoryId)
    .collection('subcategories')
    .doc(subcategoryId)
    .collection('subcategories');
  const translations = ensureCategoryTranslations(undefined, data.name, data.description);
  // Idempotent: find existing by slug
  const existing = await ref.where('slug', '==', data.slug).limit(1).get();
  if (!existing.empty) {
    return existing.docs[0].id;
  }
  const docRef = await ref.add({
    ...data,
    translations,
    createdAt: FieldValue.serverTimestamp(),
    sortOrder: data.sortOrder ?? 0,
  });
  return docRef.id;
}

/**
 * Znajdź istniejący produkt po metadata.originalId lub affiliateUrl
 */
export async function findExistingProduct(params: { originalId?: string; affiliateUrl?: string; }): Promise<string | null> {
  const ref = adminDb.collection('products');
  if (params.originalId) {
    const snap = await ref.where('metadata.originalId', '==', params.originalId).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  if (params.affiliateUrl) {
    const snap = await ref.where('affiliateUrl', '==', params.affiliateUrl).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  return null;
}

/**
 * Zaktualizuj podstawowe pola produktu (bez ryzyka nadpisania polach użytkownika)
 */
export async function updateProduct(productId: string, data: Partial<Product>): Promise<void> {
  await adminDb.collection('products').doc(productId).set(data, { merge: true });
}

/**
 * Tworzy produkt w kolekcji "products" (Admin SDK)
 */
export async function createProduct(
  data: Omit<Product, 'id' | 'createdAt'> & { 
    mainCategorySlug: string; 
    subCategorySlug?: string; 
    subSubCategorySlug?: string; 
  }
): Promise<string> {
  const ref = adminDb.collection('products');
  const docRef = await ref.add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    status: data.status || 'approved',
    temperature: 0,
    upvotes: 0,
    downvotes: 0,
    views: 0,
    clicks: 0,
    shares: 0,
    commentsCount: 0,
  });
  return docRef.id;
}

/**
 * Tworzy deal w kolekcji "deals" (Admin SDK)
 */
export async function createDeal(
  data: Omit<Deal, 'id' | 'createdAt'>
): Promise<string> {
  const ref = adminDb.collection('deals');
  const docRef = await ref.add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    status: data.status || 'draft',
    temperature: 0,
    upvotes: 0,
    downvotes: 0,
    views: 0,
    clicks: 0,
    shares: 0,
    commentsCount: 0,
  });
  return docRef.id;
}

/**
 * Znajdź istniejący deal po externalOriginalId lub link
 */
export async function findExistingDeal(params: { externalOriginalId?: string; link?: string; }): Promise<string | null> {
  const ref = adminDb.collection('deals');
  if (params.externalOriginalId) {
    const snap = await ref.where('externalOriginalId', '==', params.externalOriginalId).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  if (params.link) {
    const snap = await ref.where('link', '==', params.link).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  return null;
}

export async function updateDeal(dealId: string, data: Partial<Deal>): Promise<void> {
  await adminDb.collection('deals').doc(dealId).set(data, { merge: true });
}

export async function deleteDealDocument(dealId: string): Promise<void> {
  await adminDb.collection('deals').doc(dealId).delete();
}

export async function deleteProductDocument(productId: string): Promise<void> {
  await adminDb.collection('products').doc(productId).delete();
}

/**
 * Usuwa wszystkie produkty z kolekcji "products" (Admin SDK)
 */
async function deleteCollectionDocuments(
  collectionRef: FirebaseFirestore.CollectionReference,
  batchSize = 250
): Promise<number> {
  let deleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) {
      break;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
  }

  return deleted;
}

/**
 * Usuwa wszystkie produkty z kolekcji "products" (Admin SDK)
 */
export async function deleteAllProducts(): Promise<number> {
  const ref = adminDb.collection('products');
  return deleteCollectionDocuments(ref);
}

/**
 * Usuwa wszystkie deale z kolekcji "deals" (Admin SDK)
 */
export async function deleteAllDeals(): Promise<number> {
  const ref = adminDb.collection('deals');
  return deleteCollectionDocuments(ref);
}

/**
 * Usuwa wszystkie ProductCore z kolekcji "product_cores" (Admin SDK)
 */
export async function deleteAllProductCores(): Promise<number> {
  const ref = adminDb.collection('product_cores');
  return deleteCollectionDocuments(ref);
}

/**
 * Usuwa wszystkie wpisy dopasowań tożsamości (identity_matches)
 */
export async function deleteAllIdentityMatches(): Promise<number> {
  const ref = adminDb.collection('identity_matches');
  return deleteCollectionDocuments(ref);
}

/**
 * Usuwa historię zadań harvestera (harvester_jobs)
 */
export async function deleteAllHarvesterJobs(): Promise<number> {
  const ref = adminDb.collection('harvester_jobs');
  return deleteCollectionDocuments(ref);
}

function isDealDocumentValid(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  if (Object.keys(data).length === 0) return false;
  if (typeof data.title !== 'string' || data.title.trim() === '') return false;
  if (typeof data.price !== 'number') return false;
  if (typeof data.image !== 'string' || data.image.trim() === '') return false;
  return true;
}

function isProductDocumentValid(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  if (Object.keys(data).length === 0) return false;
  if (typeof data.name !== 'string' || data.name.trim() === '') return false;
  if (typeof data.price !== 'number') return false;
  if (typeof data.image !== 'string' || data.image.trim() === '') return false;
  return true;
}

async function purgeCollection(
  collectionName: 'deals' | 'products',
  isValid: (data: FirebaseFirestore.DocumentData | undefined) => boolean
): Promise<{ deleted: number; checked: number; skipped: number; }> {
  const snapshot = await adminDb.collection(collectionName).get();
  const invalidDocs = snapshot.docs.filter(doc => !isValid(doc.data()));

  const batchSize = 500;
  for (let i = 0; i < invalidDocs.length; i += batchSize) {
    const batch = adminDb.batch();
    const slice = invalidDocs.slice(i, i + batchSize);
    slice.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  return {
    deleted: invalidDocs.length,
    checked: snapshot.size,
    skipped: snapshot.size - invalidDocs.length,
  };
}

export async function purgeEmptyDeals(): Promise<{ deleted: number; checked: number; skipped: number; }> {
  return purgeCollection('deals', isDealDocumentValid);
}

export async function purgeEmptyProducts(): Promise<{ deleted: number; checked: number; skipped: number; }> {
  return purgeCollection('products', isProductDocumentValid);
}

/**
 * Rekurencyjnie usuwa wszystkie subkolekcje kategorii
 */
async function deleteSubcollections(categoryRef: FirebaseFirestore.DocumentReference): Promise<number> {
  let deletedCount = 0;
  
  // Usuń subcategories
  const subcategoriesSnapshot = await categoryRef.collection('subcategories').get();
  
  for (const subcategoryDoc of subcategoriesSnapshot.docs) {
    // Rekurencyjnie usuń pod-podkategorie
    const subSubcategoriesSnapshot = await subcategoryDoc.ref.collection('subcategories').get();
    const subSubBatch = adminDb.batch();
    
    subSubcategoriesSnapshot.docs.forEach(doc => {
      subSubBatch.delete(doc.ref);
    });
    
    await subSubBatch.commit();
    deletedCount += subSubcategoriesSnapshot.size;
    
    // Usuń subcategory
    await subcategoryDoc.ref.delete();
    deletedCount++;
  }

  // Usuń kafelki kategorii (tiles)
  const tilesSnapshot = await categoryRef.collection('tiles').get();
  if (!tilesSnapshot.empty) {
    const tilesBatch = adminDb.batch();
    tilesSnapshot.docs.forEach(doc => tilesBatch.delete(doc.ref));
    await tilesBatch.commit();
    deletedCount += tilesSnapshot.size;
  }
  
  return deletedCount;
}

/**
 * Usuwa wszystkie kategorie wraz z ich subkolekcjami (Admin SDK)
 */
export async function deleteAllCategories(): Promise<{ categories: number; subcategories: number }> {
  const ref = adminDb.collection('categories');
  const snapshot = await ref.get();
  
  let totalSubcategories = 0;
  
  // Najpierw usuń wszystkie subkolekcje
  for (const categoryDoc of snapshot.docs) {
    const subcategoriesDeleted = await deleteSubcollections(categoryDoc.ref);
    totalSubcategories += subcategoriesDeleted;
  }
  
  const deletedCategories = await deleteCollectionDocuments(ref);
  
  return {
    categories: deletedCategories,
    subcategories: totalSubcategories,
  };
}

/**
 * Loguje wykonanie polecenia AI do kolekcji "aiCommandHistory"
 */
export async function logAiCommand(data: {
  command: string;
  status: 'success' | 'error';
  result: string;
}): Promise<void> {
  await adminDb.collection('aiCommandHistory').add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Pobiera wszystkie kategorie główne z Firestore
 */
export async function getAllCategories(): Promise<Array<{ id: string; name: string; slug: string; icon?: string; sortOrder?: number }>> {
  const snapshot = await adminDb.collection('categories').orderBy('sortOrder', 'asc').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    slug: doc.data().slug,
    icon: doc.data().icon,
    sortOrder: doc.data().sortOrder,
  }));
}

/**
 * Pobiera wszystkie subcategories dla danej kategorii
 */
export async function getSubcategories(categoryId: string): Promise<Array<{ id: string; name: string; slug: string; icon?: string; sortOrder?: number }>> {
  const snapshot = await adminDb
    .collection('categories')
    .doc(categoryId)
    .collection('subcategories')
    .orderBy('sortOrder', 'asc')
    .get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    slug: doc.data().slug,
    icon: doc.data().icon,
    sortOrder: doc.data().sortOrder,
  }));
}

/**
 * Pobiera wszystkie sub-subcategories dla danej subcategory
 */
export async function getSubSubcategories(categoryId: string, subcategoryId: string): Promise<Array<{ 
  id: string; 
  name: string; 
  slug: string; 
  icon?: string; 
  sortOrder?: number;
  importKeywords?: string[];
  translations?: { en?: { name: string }; de?: { name: string } };
}>> {
  const snapshot = await adminDb
    .collection('categories')
    .doc(categoryId)
    .collection('subcategories')
    .doc(subcategoryId)
    .collection('subcategories')
    .orderBy('sortOrder', 'asc')
    .get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      slug: data.slug,
      icon: data.icon,
      sortOrder: data.sortOrder,
      importKeywords: data.importKeywords,
      translations: data.translations,
    };
  });
}

/**
 * Pobiera ProductCore by ID (Admin SDK - bypass security rules)
 */
export async function getProductCoreAdmin(productId: string): Promise<ProductCore | null> {
  try {
    const docRef = adminDb.collection('product_cores').doc(productId);
    let docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      const lowercasedId = productId.toLowerCase();
      const querySnap = await adminDb.collection('product_cores')
        .where('idLowercase', '==', lowercasedId)
        .limit(1)
        .get();
      if (!querySnap.empty) {
        docSnap = querySnap.docs[0];
      } else {
        // Fallback to slug search
        const normalizedId = productId.replace(/-+$/, '');
        const idsToTry = normalizedId !== productId ? [productId, normalizedId] : [productId];
        for (const slugCandidate of idsToTry) {
          const slugQueries = await Promise.all([
            adminDb.collection('product_cores').where('slug.pl', '==', slugCandidate).limit(1).get(),
            adminDb.collection('product_cores').where('slug.en', '==', slugCandidate).limit(1).get(),
            adminDb.collection('product_cores').where('slug', '==', slugCandidate).limit(1).get()
          ]);
          for (const res of slugQueries) {
            if (!res.empty) {
              docSnap = res.docs[0];
              break;
            }
          }
          if (docSnap.exists) break;
        }
      }
    }

    if (!docSnap.exists) return null;
    
    const data = docSnap.data();
    if (!data) return null;

    // Map timestamps from Firestore Timestamp to string/ISO if needed, 
    // but ProductCore interface usually expects strings or any.
    // For safety, let's assume direct mapping or minimal conversion.
    const productData = {
      ...data,
      id: docSnap.id,
      createdAt: (data.createdAt && typeof data.createdAt.toDate === 'function') 
         ? data.createdAt.toDate().toISOString() 
         : (data.createdAt || new Date().toISOString()),
      updatedAt: (data.updatedAt && typeof data.updatedAt.toDate === 'function')
         ? data.updatedAt.toDate().toISOString()
         : (data.updatedAt || new Date().toISOString()),
      // Ensure specific fields if needed
    } as ProductCore;
    
    // Explicitly stringify any remaining non-serializable fields if needed, 
    // but usually only Timestamps cause issues.
    return JSON.parse(JSON.stringify(productData)); // Crude but effective deep-sanitize for Server->Client
  } catch (error) {
    console.error('Error fetching ProductCore (Admin):', error);
    return null;
  }
}

/**
 * M6: Get ProductCore with all linked Deals (Admin SDK)
 */
export async function getProductWithDealsAdmin(productId: string): Promise<{ product: ProductCore; deals: any[] } | null> {
  try {
    const product = await getProductCoreAdmin(productId);
    if (!product) return null;

    // Fetch Deals linked to this productCore
    const dealsSnap = await adminDb
      .collection('deals')
      .where('productCoreId', '==', product.id)
      .get();
      
    // Admin sees ALL deals (including draft/expired), filtering should happen in UI if needed
    const deals = dealsSnap.docs.map(doc => {
       const d = doc.data();
       return {
         ...d,
         id: doc.id,
         // Convert Timestamps to ISO strings for serialization if they are Timestamp objects
         createdAt: (d.createdAt && typeof d.createdAt.toDate === 'function') 
            ? d.createdAt.toDate().toISOString() 
            : (d.createdAt || new Date().toISOString()),
         updatedAt: (d.updatedAt && typeof d.updatedAt.toDate === 'function') 
            ? d.updatedAt.toDate().toISOString() 
            : (d.updatedAt || new Date().toISOString()),
       };
    });

    return JSON.parse(JSON.stringify({ product, deals }));
  } catch (error) {
     console.error('Error fetching Product+Deals (Admin):', error);
     return null;
  }
}

/**
 * Get all approved ProductCore documents with specific fields for sitemap/feed generation.
 * Avoids loading heavy fullDescription fields to optimize memory and transfer.
 */
export async function getAllApprovedProductsForSitemap(limitCount = 5000): Promise<any[]> {
  try {
    const snap = await adminDb
      .collection('product_cores')
      .where('status', '==', 'approved')
      .select(
        'title',
        'description',
        'shortDescription',
        'imageUrl',
        'images',
        'status',
        'bestPrice',
        'bestTotalPrice',
        'rating',
        'searchTags',
        'specs',
        'attributes',
        'metadata',
        'mainCategorySlug',
        'subCategorySlug',
        'subSubCategorySlug',
        'updatedAt'
      )
      .limit(limitCount)
      .get();

    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error('Error in getAllApprovedProductsForSitemap:', err);
    return [];
  }
}

