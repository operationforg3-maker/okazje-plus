import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * Test endpoint to fill Firestore with sample products for testing
 * POST /api/admin/test-fill-data
 * 
 * Creates sample products in different categories so they appear in:
 * - /products (catalog page)
 * - /deals (deals section)
 * - Admin Harvester UI
 */

const SAMPLE_PRODUCTS = [
  {
    title: 'Słuchawki Bluetooth 5.0',
    description: 'Bezprzewodowe słuchawki z aktywną redukcją szumów',
    price: 129.99,
    currency: 'PLN',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'akcesoria',
    subSubCategorySlug: 'sluchawki',
    status: 'approved',
    source: 'test',
  },
  {
    title: 'Kabel USB-C 2m',
    description: 'Szybkie ładowanie i transfer danych',
    price: 19.99,
    currency: 'PLN',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'akcesoria',
    subSubCategorySlug: 'kable',
    status: 'approved',
    source: 'test',
  },
  {
    title: 'Smartwatch Fitness',
    description: 'Monitor tętna, licznik kroków, pomiar snu',
    price: 249.99,
    currency: 'PLN',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'smartwatch',
    subSubCategorySlug: 'fitness',
    status: 'approved',
    source: 'test',
  },
  {
    title: 'Power Bank 20000mAh',
    description: 'Szybkie ładowanie dla telefonu i tabletu',
    price: 69.99,
    currency: 'PLN',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'akcesoria',
    subSubCategorySlug: 'power-banki',
    status: 'approved',
    source: 'test',
  },
  {
    title: 'Lampa LED RGB',
    description: 'Inteligentna lampa z pilotem, 16 milionów kolorów',
    price: 99.99,
    currency: 'PLN',
    mainCategorySlug: 'dom-ogrod',
    subCategorySlug: 'oswietlenie',
    subSubCategorySlug: 'lampy-led',
    status: 'approved',
    source: 'test',
  },
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('[Test Fill Data] Starting to populate Firestore with sample products...');

    const results = [];
    for (const product of SAMPLE_PRODUCTS) {
      const docRef = adminDb.collection('products').doc();
      await docRef.set({
        ...product,
        id: docRef.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        votes: 0,
        heat: Math.random() * 100,
        images: [],
        tags: [],
        verified: true,
      });

      results.push({
        id: docRef.id,
        title: product.title,
        status: 'created',
      });

      console.log(`[Test Fill Data] Created: ${product.title}`);
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      results,
      message: `Pomyślnie dodano ${results.length} produktów testowych. Zobaczysz je na https://okazjeplus.pl/pl/products za ~10 sekund (cache).`,
    });
  } catch (error: any) {
    console.error('[Test Fill Data] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check current test products count
 */
export async function GET(req: NextRequest) {
  try {
    const snapshot = await adminDb
      .collection('products')
      .where('source', '==', 'test')
      .get();

    return NextResponse.json({
      success: true,
      testProductsCount: snapshot.size,
      products: snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        status: doc.data().status,
      })),
    });
  } catch (error: any) {
    console.error('[Test Fill Data] GET Error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
