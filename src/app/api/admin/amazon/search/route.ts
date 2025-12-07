import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth-server';
import { createAmazonClient } from '@/integrations/amazon/client';
import { AmazonClientConfig } from '@/integrations/amazon/types';

const amazonConfig: AmazonClientConfig = {
  region: 'eu-west-1',
  marketplace: 'www.amazon.pl',
};

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const allowed = await isAdminUser(idToken);
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    const { keywords, minPrice, maxPrice, limit } = body;

    if (!keywords) {
      return NextResponse.json({ error: 'keywords_required' }, { status: 400 });
    }

    // Create Amazon client
    const client = createAmazonClient(amazonConfig);

    // Search for products
    const searchResponse = await client.searchProducts({
      keywords,
      minPrice,
      maxPrice,
      limit: Math.min(limit || 50, 10),
      page: 1,
    });

    // Transform response
    const products = searchResponse.products.map(item => ({
      asin: item.asin,
      title: item.title,
      price: {
        current: item.price.current,
        original: item.price.original,
        currency: item.price.currency,
      },
      imageUrls: item.imageUrls,
      productUrl: item.productUrl,
      rating: item.rating,
      merchantInfo: item.merchantInfo,
      description: item.description,
    }));

    return NextResponse.json({
      success: true,
      products,
      totalCount: searchResponse.totalResults,
    });
  } catch (error: any) {
    console.error('Amazon search error:', error);
    return NextResponse.json(
      { error: error.message || 'search_failed' },
      { status: 500 }
    );
  }
}
