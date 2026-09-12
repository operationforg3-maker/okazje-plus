import { adminDb } from '@/lib/firebase-admin';
import { cacheGet, cacheSet } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const BASE_URL = 'https://okazjeplus.pl';
const CHUNK_SIZE = 2500;
const CACHE_KEY = 'sitemap:index:v2';
const CACHE_TTL = 3600; // 1 hour

export async function GET() {
  const cachedXml = await cacheGet(CACHE_KEY);
  if (cachedXml) {
    return new NextResponse(cachedXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  try {
    const [dealsCountSnap, productsCountSnap] = await Promise.all([
      adminDb.collection('deals').where('status', '==', 'approved').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
    ]);

    const totalDeals = dealsCountSnap.data().count || 0;
    const totalProducts = productsCountSnap.data().count || 0;

    const dealsChunks = Math.max(1, Math.ceil(totalDeals / CHUNK_SIZE));
    const productsChunks = Math.max(1, Math.ceil(totalProducts / CHUNK_SIZE));

    const sitemaps: string[] = [
      `  <sitemap>\n    <loc>${BASE_URL}/sitemap/0.xml</loc>\n  </sitemap>`,
    ];

    for (let i = 1; i <= dealsChunks; i++) {
      sitemaps.push(`  <sitemap>\n    <loc>${BASE_URL}/sitemap/deals-${i}.xml</loc>\n  </sitemap>`);
    }

    for (let i = 1; i <= productsChunks; i++) {
      sitemaps.push(`  <sitemap>\n    <loc>${BASE_URL}/sitemap/products-${i}.xml</loc>\n  </sitemap>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('\n')}
</sitemapindex>`;

    await cacheSet(CACHE_KEY, xml, CACHE_TTL);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    // Fallback static sitemap index if Firestore query fails
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE_URL}/sitemap/0.xml</loc></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap/deals-1.xml</loc></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap/products-1.xml</loc></sitemap>
</sitemapindex>`;

    return new NextResponse(fallbackXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }
}
