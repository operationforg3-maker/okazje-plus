import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth-server';
import { createAllegroClient } from '@/integrations/allegro/client';
import { AllegroClientConfig } from '@/integrations/allegro/types';

const allegroConfig: AllegroClientConfig = {
  clientId: process.env.ALLEGRO_APP_KEY || '',
  clientSecret: process.env.ALLEGRO_APP_SECRET || '',
  sandbox: process.env.ALLEGRO_SANDBOX === 'true',
};

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const allowed = await isAdminUser(idToken);
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    const { phrase, minPrice, maxPrice, limit } = body;

    if (!phrase) {
      return NextResponse.json({ error: 'phrase_required' }, { status: 400 });
    }

    // Create Allegro client
    const client = createAllegroClient(allegroConfig);

    // Search for products
    const searchResponse = await client.searchOffers({
      phrase,
      'parameter.price.from': minPrice,
      'parameter.price.to': maxPrice,
      limit: Math.min(limit || 50, 100),
      offset: 0,
    });

    // Transform response
    const products = [
      ...searchResponse.items.promoted,
      ...searchResponse.items.regular,
    ].map(item => ({
      id: item.id,
      name: item.name,
      price: item.sellingMode?.price?.amount || 0,
      currency: item.sellingMode?.price?.currency || 'PLN',
      imageUrl: item.images?.[0]?.url || '',
      itemWebUrl: item.webUrl || '',
      seller: {
        login: item.seller?.login || '',
        feedbackScore: undefined,
      },
      stats: {
        visitsCount: item.stats?.visitsCount || 0,
        watchersCount: item.stats?.watchersCount || 0,
      },
      description: item.shortDescription || '',
    }));

    return NextResponse.json({
      success: true,
      products,
      totalCount: searchResponse.count,
    });
  } catch (error: any) {
    console.error('Allegro search error:', error);
    return NextResponse.json(
      { error: error.message || 'search_failed' },
      { status: 500 }
    );
  }
}
