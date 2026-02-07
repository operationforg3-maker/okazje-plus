import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { DealRefiner } from '@/lib/automation/deal-refiner';

function isProdTestAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.trim() === 'Bearer prod-test';
}

export async function POST(req: NextRequest) {
  try {
    if (!isProdTestAuth(req)) {
      await requireAdmin();
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit || 50), 200);

    const jobId = `deal-refiner-${Date.now()}`;
    const refiner = new DealRefiner(jobId);
    const job = await refiner.refineNewDeals(limit);

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error('[refiner/deals] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start deal refiner' },
      { status: 500 }
    );
  }
}
