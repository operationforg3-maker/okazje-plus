import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { requireAdmin } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  try {
    // Verify admin access
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminDb = admin.firestore();
    
    console.log('[Migration] Starting deal category migration...');
    
    // Find all deals without proper categories
    const deals = await adminDb.collection('deals')
      .where('status', '==', 'approved')
      .limit(500)
      .get();
    
    console.log(`[Migration] Found ${deals.size} deals to check`);
    
    let fixed = 0;
    let missing = 0;
    let batch = adminDb.batch();
    let batchCount = 0;
    
    for (const dealDoc of deals.docs) {
      const deal = dealDoc.data();
      const needsFix = !deal.mainCategorySlug || deal.mainCategorySlug === 'uncategorized';
      
      if (needsFix) {
        // Get ProductCore to copy categories
        const productSnap = await adminDb.collection('product_cores').doc(deal.productCoreId).get();
        
        if (productSnap.exists) {
          const product = productSnap.data();
          if (product.mainCategorySlug) {
            batch.update(dealDoc.ref, {
              mainCategorySlug: product.mainCategorySlug,
              subCategorySlug: product.subCategorySlug || 'uncategorized',
              subSubCategorySlug: product.subSubCategorySlug || undefined,
              category: `${product.mainCategorySlug}${product.subCategorySlug ? '/' + product.subCategorySlug : ''}${product.subSubCategorySlug ? '/' + product.subSubCategorySlug : ''}`,
              updatedAt: new Date().toISOString(),
            });
            fixed++;
            batchCount++;
            
            if (batchCount >= 100) {
              await batch.commit();
              batch = adminDb.batch();
              batchCount = 0;
              console.log(`[Migration] Batch committed. Total fixed: ${fixed}`);
            }
          } else {
            missing++;
          }
        } else {
          missing++;
        }
      }
    }
    
    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`[Migration] Complete! Fixed: ${fixed}, Missing: ${missing}`);
    
    return NextResponse.json({ 
      success: true, 
      fixed, 
      missing,
      message: `✅ Fixed ${fixed} deals, ${missing} missing/error`
    });
  } catch (error: any) {
    console.error('[Migration] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Migration failed' 
    }, { status: 500 });
  }
}
