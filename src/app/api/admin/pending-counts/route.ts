import { NextRequest, NextResponse } from 'next/server';
import { requireModerator } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Both moderators and admins can see what needs moderation
    await requireModerator();

    // 1. Count pending products (M6: status 'pending_approval' or legacy 'pending')
    const productsSnapshot = await adminDb.collection('product_cores')
      .where('status', 'in', ['pending', 'pending_approval'])
      .count()
      .get();
      
    // 2. Count pending deals
    const dealsSnapshot = await adminDb.collection('deals')
      .where('status', 'in', ['pending', 'pending_approval'])
      .count()
      .get();
    
    // 3. Count draft products (waiting for enrichment)
    const draftSnapshot = await adminDb.collection('product_cores')
      .where('status', '==', 'draft')
      .count()
      .get();

    return NextResponse.json({
      success: true,
      pendingProducts: productsSnapshot.data().count,
      pendingDeals: dealsSnapshot.data().count,
      draftProducts: draftSnapshot.data().count,
      totalPending: productsSnapshot.data().count + dealsSnapshot.data().count
    });

  } catch (error: any) {
    console.error('[API] Error fetching pending counts:', error);
    
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
