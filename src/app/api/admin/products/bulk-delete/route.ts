import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { deleteAllProducts } from '@/lib/data-admin';

/**
 * POST /api/admin/products/bulk-delete
 * Body: { confirmation: 'DELETE_ALL_PRODUCTS' }
 * Requires: Admin auth (Bearer <idToken>)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await checkAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== 'DELETE_ALL_PRODUCTS') {
      return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 });
    }

    const deleted = await deleteAllProducts();
    return NextResponse.json({ success: true, deleted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bulk delete failed' }, { status: 500 });
  }
}
