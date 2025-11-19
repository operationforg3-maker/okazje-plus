import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';
import { Product } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/admin/bulk-import/commit
 * 
 * Saves approved products from preview to Firestore database
 */

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // Check admin role
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { products } = body as { products: any[] };

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 });
    }

    console.log(`[Bulk Commit] Saving ${products.length} products to database`);

    const batch = adminDb.batch();
    let imported = 0;

    for (const previewProduct of products) {
      try {
        const rawProduct = previewProduct._rawProduct;
        const aiMetadata = previewProduct._aiMetadata;
        const finalCategory = previewProduct._finalCategory;

        // Build Product document with required fields
        const productId = adminDb.collection('products').doc().id;
        const productDoc: any = {
          id: productId,
          name: previewProduct.normalizedTitle,
          description: aiMetadata.seo.description,
          longDescription: aiMetadata.seo.description,
          image: rawProduct.image_urls?.[0] || '',
          imageHint: '',
          affiliateUrl: rawProduct.product_url,
          
          // Category (3-level)
          mainCategorySlug: finalCategory.mainSlug,
          subCategorySlug: finalCategory.subSlug,
          subSubCategorySlug: finalCategory.subSubSlug,

          // Pricing
          price: rawProduct.price?.current || 0,
          originalPrice: rawProduct.price?.original,
          discountPercent: rawProduct.discount_percent,
          
          // Gallery
          gallery: (rawProduct.image_urls || []).map((url: string, idx: number) => ({
            url,
            alt: previewProduct.normalizedTitle,
            order: idx,
          })),

          // Rating Card
          ratingCard: {
            average: rawProduct.rating?.score || 0,
            count: rawProduct.rating?.count || 0,
            durability: 0,
            easeOfUse: 0,
            valueForMoney: 0,
            versatility: 0,
          },

          // Import Metadata
          metadata: {
            source: 'aliexpress' as const,
            originalId: rawProduct.item_id,
            importedAt: new Date().toISOString(),
            importedBy: decodedToken.uid,
            merchant: rawProduct.merchant?.name,
          },

          // SEO
          seoKeywords: aiMetadata.seo.keywords || [],
          metaTitle: aiMetadata.seo.metaTitle,
          metaDescription: aiMetadata.seo.metaDescription,

          // AI Metadata
          ai: {
            quality: aiMetadata.quality,
            titleNormalization: aiMetadata.titleNormalization,
            categoryMapping: aiMetadata.categoryMapping,
            seo: aiMetadata.seo,
          },

          // Status & Timestamps
          status: 'approved', // Auto-approve since admin reviewed in preview
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: decodedToken.uid,
          
          // Stats
          viewCount: 0,
          clickCount: 0,
        };

        const productRef = adminDb.collection('products').doc(productId);
        batch.set(productRef, productDoc);
        
        imported++;
      } catch (productError) {
        console.error('[Bulk Commit] Error processing product:', productError);
        // Continue with next product
      }
    }

    // Commit batch
    await batch.commit();

    console.log(`[Bulk Commit] Successfully saved ${imported}/${products.length} products`);

    // TODO: Queue for Typesense indexing

    return NextResponse.json({
      ok: true,
      imported,
      total: products.length,
    });
  } catch (error) {
    console.error('[Bulk Commit Error]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate URL-safe slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
