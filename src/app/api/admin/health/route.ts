import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const session = await requireAdmin();

    const [dealsCountSnap, productsCountSnap, usersCountSnap] = await Promise.all([
      adminDb.collection('deals').count().get(),
      adminDb.collection('product_cores').count().get(),
      adminDb.collection('users').count().get(),
    ]);

    const appKeyConfigured = Boolean(process.env.ALIEXPRESS_APP_KEY);
    const appSecretConfigured = Boolean(process.env.ALIEXPRESS_APP_SECRET);
    const smokeReady = appKeyConfigured && appSecretConfigured;

    return NextResponse.json({
      status: 'ok',
      checkedAt: new Date().toISOString(),
      admin: {
        uid: session.uid,
        role: session.role,
      },
      system: {
        smokeReady,
        aliexpress: {
          appKeyConfigured,
          appSecretConfigured,
        },
      },
      totals: {
        deals: dealsCountSnap.data().count,
        products: productsCountSnap.data().count,
        users: usersCountSnap.data().count,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const unauthorized = message.includes('Unauthorized') || message.includes('Forbidden');
    return NextResponse.json(
      {
        status: 'error',
        message,
      },
      { status: unauthorized ? 403 : 500 }
    );
  }
}
