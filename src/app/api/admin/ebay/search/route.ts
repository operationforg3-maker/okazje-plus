import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth-server';
import { createEbayClient } from '@/integrations/ebay/client';
import { EbayClientConfig } from '@/integrations/ebay/types';

const ebayConfig: EbayClientConfig = {
  clientId: process.env.EBAY_CLIENT_ID || '',
  clientSecret: process.env.EBAY_CLIENT_SECRET || '',
  sandbox: process.env.EBAY_SANDBOX === 'true',
  marketplaceId: 'EBAY_PL',
};

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const allowed = await isAdminUser(idToken);
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    const { q, minPrice, maxPrice, limit } = body;

    if (!q) {
      return NextResponse.json({ error: 'query_required' }, { status: 400 });
    }

    // Create eBay client
    const client = createEbayClient(ebayConfig);

    // Build price filter
    const filters: string[] = [];
    if (minPrice || maxPrice) {
      const min = minPrice || 0;
      const max = maxPrice || 999999;
      filters.push(`price:[${min}..${max}],priceCurrency:PLN`);
    }

    // Search for items
    const searchResponse = await client.searchItems({
      q,
      filter: filters.join('|'),
      limit: Math.min(limit || 50, 200),
      offset: 0,
    });

    // Transform response
    const products = (searchResponse.itemSummaries || []).map(item => ({
      itemId: item.itemId,
      title: item.title,
      image: item.image,
      price: item.price,
      itemWebUrl: item.itemWebUrl,
      seller: item.seller,
      condition: item.condition,
      buyingOptions: item.buyingOptions,
      shippingOptions: item.shippingOptions,
    }));

    return NextResponse.json({
      success: true,
      products,
      totalCount: searchResponse.total,
    });
  } catch (error: any) {
    console.error('eBay search error:', error);
    return NextResponse.json(
      { error: error.message || 'search_failed' },
      { status: 500 }
    );
  }
}
