import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { createAliExpressClient } from '@/integrations/aliexpress/client';

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const client = createAliExpressClient();
    const response = await client.getFeaturedPromos();

    const respResult = response?.resp_result || response?.aliexpress_affiliate_featuredpromo_get_response?.resp_result;
    const respCode = Number(respResult?.resp_code ?? response?.resp_code);

    if (!respResult || respCode !== 200) {
      const errorMsg =
        response?.error_response?.msg ||
        respResult?.resp_msg ||
        'Failed to fetch campaigns from AliExpress';
      return NextResponse.json({ error: errorMsg, details: response }, { status: 500 });
    }

    const rawPromos = respResult?.result?.promos;
    const promos = Array.isArray(rawPromos)
      ? rawPromos
      : (Array.isArray(rawPromos?.promo) ? rawPromos.promo : []);

    return NextResponse.json({
      success: true,
      promos
    });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Unauthorized/Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
