import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { startRefinerJob } from '@/lib/automation/refiner';
import { ProductCore } from '@/lib/types';

/**
 * POST /api/admin/products/approve
 * Approve draft product(s) to pending_approval and trigger asynchronous AI refinement
 * 
 * Body: { productIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

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

    // 1. Fetch products in parallel
    const docs = await Promise.all(
      productIds.map(async (id) => {
        try {
          const snap = await productCoresRef.doc(id).get();
          return { id, snap, error: null };
        } catch (e) {
          return { id, snap: null, error: (e as Error).message };
        }
      })
    );

    const validProducts: { id: string; data: ProductCore }[] = [];

    for (const item of docs) {
      if (item.error || !item.snap || !item.snap.exists) {
        results.failed++;
        results.errors.push(`Produkt ${item.id} nie został odnaleziony`);
        continue;
      }

      const data = item.snap.data() as ProductCore;
      if (data.status !== 'draft') {
        results.failed++;
        results.errors.push(`Produkt ${item.id} ma status '${data.status}', a nie 'draft'`);
        continue;
      }

      validProducts.push({ id: item.id, data });
    }

    // 2. Perform fast atomic batch update to pending_approval
    if (validProducts.length > 0) {
      // Chunk batches of up to 450
      const chunkSize = 450;
      for (let i = 0; i < validProducts.length; i += chunkSize) {
        const chunk = validProducts.slice(i, i + chunkSize);
        const batch = adminDb.batch();
        const nowIso = new Date().toISOString();

        for (const p of chunk) {
          batch.update(productCoresRef.doc(p.id), {
            status: 'pending_approval',
            updatedAt: nowIso,
          });
        }
        await batch.commit();
      }

      results.approved = validProducts.length;

      // 3. Trigger AI Refiner in background so HTTP response returns immediately without 504 Gateway Timeout
      const idsToRefine = validProducts.map((p) => p.id);
      startRefinerJob(idsToRefine, 'full_enrichment').catch((err) => {
        console.error('[Approve API] Background AI refinement error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: `Zatwierdzono ${results.approved}/${productIds.length} produktów`,
      results,
    });
  } catch (error: any) {
    console.error('Error approving products:', error);
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to approve products', details: (error as Error).message },
      { status: 500 }
    );
  }
}
