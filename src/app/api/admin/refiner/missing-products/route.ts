import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { startRefinerJob } from '@/lib/automation/refiner';

function isProdTestAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.trim() === 'Bearer prod-test';
}

function needsLocalization(value: any): boolean {
  if (!value || typeof value !== 'object') return true;
  const pl = String(value.pl || '').trim();
  const en = String(value.en || '').trim();
  const de = String(value.de || '').trim();
  return !pl || !en || !de;
}

export async function POST(req: NextRequest) {
  try {
    if (!isProdTestAuth(req)) {
      await requireAdmin();
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit || 25), 100);
    const fetchLimit = Math.min(Number(body?.fetchLimit || 200), 500);

    const snapshot = await adminDb
      .collection('product_cores')
      .where('status', '==', 'approved')
      .orderBy('updatedAt', 'desc')
      .limit(fetchLimit)
      .get();

    const productIds: string[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() as any;
      const description = data.description || data.fullDescription;
      if (needsLocalization(description)) {
        productIds.push(doc.id);
      }
      if (productIds.length >= limit) break;
    }

    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No product cores require localization',
        productIds: [],
      });
    }

    const job = await startRefinerJob(productIds, 'full_enrichment');

    return NextResponse.json({
      success: true,
      productIds,
      job,
    });
  } catch (error: any) {
    console.error('[refiner/missing-products] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start refiner job' },
      { status: 500 }
    );
  }
}
