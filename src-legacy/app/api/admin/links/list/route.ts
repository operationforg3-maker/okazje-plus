import { NextRequest, NextResponse } from 'next/server';

// GET /api/admin/links/list - załaduj linki
export async function GET(req: NextRequest) {
  try {
    // TODO: Załaduj linki z Firestore/affiliateLinks collection
    // Policz statystyki

    const mockLinks = [
      {
        id: 'link1',
        url: 'https://aliexpress.com/item/123456',
        productId: 'prod1',
        platform: 'aliexpress',
        status: 'active',
        httpCode: 200,
        responseTime: 245,
        lastChecked: new Date().toISOString(),
        source: 'import_aliexpress',
      },
      {
        id: 'link2',
        url: 'https://allegro.pl/listing/456789',
        productId: 'prod2',
        platform: 'allegro',
        status: 'dead',
        httpCode: 404,
        responseTime: 150,
        lastChecked: new Date().toISOString(),
        source: 'import_allegro',
      },
    ];

    const stats = {
      total: mockLinks.length,
      active: mockLinks.filter(l => l.status === 'active').length,
      dead: mockLinks.filter(l => l.status === 'dead').length,
      slow: mockLinks.filter(l => l.status === 'slow').length,
      checking: 0,
      unknown: mockLinks.filter(l => l.status === 'unknown').length,
      lastRun: new Date().toISOString(),
    };

    return NextResponse.json({
      links: mockLinks,
      stats,
    });
  } catch (error) {
    console.error('❌ Błąd w links/list:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
