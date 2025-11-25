/**
 * Server-only data operations using Firebase Admin SDK
 * Używaj tego modułu tylko w API routes i server-side code
 */

import { adminDb } from '@/lib/firebase-admin';
import { Category, Product, Deal } from '@/lib/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

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
  const docRef = await ref.add({
    ...data,
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
  const docRef = await ref.add({
    ...data,
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
  
  const docRef = await ref.add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    sortOrder: data.sortOrder ?? 0,
  });
  return docRef.id;
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
 * Usuwa wszystkie produkty z kolekcji "products" (Admin SDK)
 */
export async function deleteAllProducts(): Promise<number> {
  const ref = adminDb.collection('products');
  const snapshot = await ref.get();
  
  const batch = adminDb.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  return snapshot.size;
}

/**
 * Usuwa wszystkie deale z kolekcji "deals" (Admin SDK)
 */
export async function deleteAllDeals(): Promise<number> {
  const ref = adminDb.collection('deals');
  const snapshot = await ref.get();
  
  const batch = adminDb.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  return snapshot.size;
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
  
  // Następnie usuń główne kategorie
  const batch = adminDb.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  
  return {
    categories: snapshot.size,
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
