import React from 'react';
import { UXVariantsPlayground } from '@/components/admin/ux-variants-playground';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { searchDeals, searchProducts } from '@/lib/search-server';
import { getAllCategories, getSubcategories } from '@/lib/data-admin';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export default async function UXVariantsPage() {
  // Fetch real data on the server side
  let fetchedDeals = await searchDeals("", { limit: 25, sortBy: 'newest' });
  const realDeals = fetchedDeals
    .filter((d: any) => d.image && d.image !== '/icon_okazjeplus.svg' && !d.image.includes('placeholder'))
    .slice(0, 4);

  let fetchedProducts = await searchProducts("", { limit: 25, sortBy: 'newest' });
  
  if (!fetchedProducts || fetchedProducts.length === 0) {
    try {
      const snap = await adminDb.collection('products').limit(25).get();
      fetchedProducts = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn('Failed to query fallback products collection', e);
    }
  }

  const realProducts = fetchedProducts
    .filter((p: any) => {
      const img = p.imageUrl || p.image || (p.images && p.images[0]);
      return img && img !== '/icon_okazjeplus.svg' && !img.includes('placeholder');
    })
    .slice(0, 4);

  const categoriesData = await getAllCategories();
  
  const realCategories = await Promise.all(
    categoriesData.slice(0, 5).map(async (cat) => {
      const subcats = await getSubcategories(cat.id);
      return {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon || '📁',
        count: 0,
        subcats: subcats.map(s => s.name)
      };
    })
  );

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

  // Safely serialize complex database objects (like Firestore Timestamps) to plain JSON
  const serializedDeals = JSON.parse(JSON.stringify(realDeals));
  const serializedProducts = JSON.parse(JSON.stringify(realProducts));
  const serializedCategories = JSON.parse(JSON.stringify(realCategories));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/20 pb-4">
        <div>
          <h1 className="font-headline text-3xl font-black tracking-tight text-foreground">
            Warianty Interfejsu (UX Playground)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Laboratorium testowe i audytor nowych stylów wizualnych dla Okazje+ (dane rzeczywiste z bazy)
          </p>
        </div>
        <Button asChild>
          <Link href="/new-ux">Uruchom Prototypy Nowego UX</Link>
        </Button>
      </div>

      <UXVariantsPlayground 
        realDeals={serializedDeals}
        realProducts={serializedProducts}
        realCategories={serializedCategories}
        realCounts={realCounts}
      />
    </div>
  );
}
