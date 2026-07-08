import { NextResponse } from 'next/server';
import { getAliExpressProductDetailsDirect } from '@/integrations/aliexpress/details';
import { requireModerator } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    await requireModerator();
  } catch (authError: any) {
    const isForbidden = authError.message?.includes('Forbidden');
    return NextResponse.json(
      { error: authError.message || 'Unauthorized' },
      { status: isForbidden ? 403 : 401 }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id') 
    || url.searchParams.get('itemId') 
    || url.searchParams.get('productId') 
    || '';

  if (!id) {
    return NextResponse.json({ error: 'missing_id', message: 'Provide id, itemId, or productId parameter' }, { status: 400 });
  }

  try {
    const result = await getAliExpressProductDetailsDirect(id);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('AliExpress item proxy failed:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e.message || e) }, { status: 500 });
  }
}
