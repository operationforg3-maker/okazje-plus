import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { AIRefiner } from '@/lib/automation/refiner';
import { ProductCore } from '@/lib/types';

/**
 * POST /api/admin/products/approve
 * Approve a draft product and trigger AI refinement
 * 
 * Body: { productIds: string[] }
 * 
 * Flow:
 * 1. Fetch draft product(s)
 * 2. Change status to pending_approval
 * 3. Trigger AIRefiner for enrichment
 * 4. AIRefiner will update product with refined content
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productIds } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds array required' },
        { status: 400 }
      );
    }

    const productCoresRef = adminDb.collection('product_cores');
    const results = {
      approved: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each product
    for (const productId of productIds) {
      try {
        // Fetch product
        const docSnap = await productCoresRef.doc(productId).get();
        if (!docSnap.exists) {
          results.failed++;
          results.errors.push(`Product ${productId} not found`);
          continue;
        }

        const product = docSnap.data() as ProductCore;

        // Only approve draft products
        if (product.status !== 'draft') {
          results.failed++;
          results.errors.push(
            `Product ${productId} status is '${product.status}', not 'draft'`
          );
          continue;
        }

        // 1. Update status to pending_approval
        await productCoresRef.doc(productId).update({
          status: 'pending_approval',
          updatedAt: new Date().toISOString(),
        });

        // 2. Trigger AIRefiner
        try {
          const refiner = new AIRefiner(
            `manual-approve-${productId}`
          );

          // Perform enrichment
          const enriched = await refiner.enrichSingleProduct(product);

          // Update product with enriched content
          await productCoresRef.doc(productId).update({
            ...enriched,
            updatedAt: new Date().toISOString(),
          });

          results.approved++;
        } catch (refinerError) {
          // Even if refiner fails, product is now pending_approval
          // Admin can retry manually
          console.error(
            `Refiner failed for product ${productId}:`,
            refinerError
          );
          results.approved++; // Still count as approved since status changed
          results.errors.push(
            `Product ${productId} approved but refiner failed: ${(refinerError as Error).message}`
          );
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Error approving ${productId}: ${(error as Error).message}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Approved ${results.approved}/${productIds.length} products`,
      results,
    });
  } catch (error) {
    console.error('Error approving products:', error);
    return NextResponse.json(
      { error: 'Failed to approve products', details: (error as Error).message },
      { status: 500 }
    );
  }
}
