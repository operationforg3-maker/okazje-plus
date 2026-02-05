import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const productSnap = await adminDb
      .collection('product_cores')
      .where('metadata.harvesterJobId', '==', jobId)
      .count()
      .get();

    const dealSnap = await adminDb
      .collection('deals')
      .where('metadata.harvesterJobId', '==', jobId)
      .count()
      .get();

    return NextResponse.json({
      success: true,
      jobId,
      productsInDb: productSnap.data().count,
      dealsInDb: dealSnap.data().count,
    });
  } catch (error: any) {
    console.error('[Harvester Verify API] Error:', error);
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Unauthorized/Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
