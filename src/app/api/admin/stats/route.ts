import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    // Get counts from Firestore
    const [dealsCount, productsCount, usersCount] = await Promise.all([
      adminDb.collection('deals').count().get(),
      adminDb.collection('products').count().get(),
      adminDb.collection('users').count().get(),
    ]);

    // Get total savings (sum of votes count as proxy for engagement/savings potential)
    const dealsSnapshot = await adminDb.collection('deals')
      .select('vote_count')
      .get();

    const totalSavings = dealsSnapshot.docs.reduce((sum, doc) => {
      const votes = doc.data().vote_count || 0;
      return sum + (votes * 10); // Estimate 10 PLN per vote
    }, 0);

    return NextResponse.json({
      success: true,
      dealsCount: dealsCount.data().count,
      productsCount: productsCount.data().count,
      usersCount: usersCount.data().count,
      totalSavings: totalSavings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Stats API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch stats',
      // Fallback values to avoid breaking the UI
      dealsCount: 0,
      productsCount: 0,
      usersCount: 0,
      totalSavings: 0,
    }, { status: 500 });
  }
}

export const revalidate = 300; // Cache for 5 minutes
