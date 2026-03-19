import { getRecommendedProducts } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';
import type { Deal, Product } from '@/lib/types';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date: Date): string {
  return date.toUTCString();
}

async function generateRssFeed() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';
  
  // Fetch latest 50 deals and products
  const [deals, products] = await Promise.all([
    searchDealsTypesense('*', {
      limit: 50,
      sortBy: 'hot',
      statusFilter: 'approved',
    }),
    getRecommendedProducts(50)
  ]);

  // Sort combined items by date
  type FeedItem = { 
    id: string; 
    title: string; 
    description: string; 
    link: string; 
    pubDate: Date;
    category: string;
    image?: string;
  };

  const feedItems: FeedItem[] = [
    ...deals.map((deal: Deal) => ({
      id: deal.id,
      title: typeof deal.title === 'string' ? deal.title : (deal.title?.pl || 'Okazja'),
      description: typeof deal.description === 'string' ? deal.description : (deal.description?.pl || ''),
      link: `${baseUrl}/deals/${deal.id}`,
      pubDate: deal.createdAt ? new Date(deal.createdAt) : new Date(),
      category: 'Okazje',
      image: deal.image
    })),
    ...products.map((product: Product) => {
      // Handle LocalizedText type for product fields
      const productName = typeof product.name === 'string' 
        ? product.name 
        : ((product.name as any)?.pl || 'Produkt');
      const productDesc = typeof product.shortDescription === 'string' 
        ? product.shortDescription 
        : ((product.shortDescription as any)?.pl || (product.fullDescription as any)?.pl || '');
      
      return {
        id: product.id,
        title: productName,
        description: productDesc,
        link: `${baseUrl}/products/${product.id}`,
        pubDate: new Date(), // Product doesn't have createdAt field
        category: 'Produkty',
        image: product.image
      };
    })
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()).slice(0, 50);

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Okazje+ - Najlepsze Okazje i Produkty</title>
    <link>${baseUrl}</link>
    <description>Najnowsze okazje zakupowe, promocje i wyprzedaże w internecie. Odkryj najlepsze ceny produktów i gorące oferty polecane przez społeczność Okazje+.</description>
    <language>pl</language>
    <lastBuildDate>${formatDate(new Date())}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${baseUrl}/Logotyp_okazjePlus.png</url>
      <title>Okazje+</title>
      <link>${baseUrl}</link>
    </image>
${feedItems.map(item => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <description>${escapeXml(item.description.slice(0, 500))}</description>
      <category>${escapeXml(item.category)}</category>
      <pubDate>${formatDate(item.pubDate)}</pubDate>${item.image ? `
      <media:content url="${escapeXml(item.image)}" medium="image"/>` : ''}
    </item>`).join('\n')}
  </channel>
</rss>`;

  return rss;
}

export async function GET() {
  try {
    const feed = await generateRssFeed();
    
    return new Response(feed, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
