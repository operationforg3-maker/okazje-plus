import React from 'react';
import { FullPagePreviewClient } from './full-page-client';
import { searchDealsTypesense, searchProductsTypesense } from '@/lib/search-server';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export default async function UXFullPageVariantsPage() {
  // Fetch real deals using standard filters
  let fetchedDeals: any[] = [];
  try {
    const dealsSnap = await adminDb.collection('deals')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();
    fetchedDeals = dealsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Failed to fetch deals', e);
  }

  const realDeals = fetchedDeals
    .filter((d: any) => d.image && d.image !== '/icon_okazjeplus.svg' && !d.image.includes('placeholder'))
    .slice(0, 16);

  // Fetch real products
  let fetchedProducts: any[] = [];
  try {
    const productsSnap = await adminDb.collection('product_cores')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();
    fetchedProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Failed to fetch products', e);
  }

  const realProducts = fetchedProducts
    .filter((p: any) => {
      const img = p.imageUrl || p.image || (p.images && p.images[0]);
      return img && img !== '/icon_okazjeplus.svg' && !img.includes('placeholder');
    })
    .slice(0, 16);

  // Construct complete hierarchical category tree (3 levels)
  const cats = await getAllCategories();
  const categoryTree = [] as any[];
  for (const c of cats.slice(0, 10)) {
    const subs = await getSubcategories(c.id);
    const subNodes = [] as any[];
    for (const s of subs) {
      const subsubs = await getSubSubcategories(c.id, s.id);
      subNodes.push({
        id: s.id,
        name: s.name,
        slug: s.slug,
        icon: s.icon || null,
        subcategories: subsubs.map(ss => ({ id: ss.id, name: ss.name, slug: ss.slug }))
      });
    }
    categoryTree.push({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon || '📁',
      subcategories: subNodes
    });
  }

  let realCounts = { products: 120, deals: 340, users: 1800 };
  try {
    const [productsCount, dealsCount, usersCount] = await Promise.all([
      adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
      adminDb.collection('deals').where('status', '==', 'approved').count().get(),
      adminDb.collection('users').count().get()
    ]);
    realCounts = {
      products: productsCount.data().count,
      deals: dealsCount.data().count,
      users: usersCount.data().count
    };
  } catch (e) {
    console.warn('Failed to get server counts, using default values', e);
  }

  // Safely serialize database entities
  const serializedDeals = JSON.parse(JSON.stringify(realDeals));
  const serializedProducts = JSON.parse(JSON.stringify(realProducts));
  const serializedCategoryTree = JSON.parse(JSON.stringify(categoryTree));

  return (
    <FullPagePreviewClient 
      realDeals={serializedDeals}
      realProducts={serializedProducts}
      realCategories={serializedCategoryTree}
      realCounts={realCounts}
    />
  );
}
