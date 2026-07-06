import { NextResponse } from 'next/server';
import { scrapeAliExpressProduct } from '@/integrations/aliexpress/scraper';

function extractAliExpressId(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const match = url.pathname.match(/\/item\/(\d+)/) || url.pathname.match(/\/(\d+)\.html/);
    return match ? match[1] : null;
  } catch {
    const match = urlStr.match(/\/item\/(\d+)/) || urlStr.match(/\/(\d+)\.html/);
    return match ? match[1] : null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Brak parametru URL' }, { status: 400 });
  }

  try {
    const aliExpressId = extractAliExpressId(url);
    if (aliExpressId) {
      console.log(`[API Scrape] Scraping AliExpress product ID: ${aliExpressId}`);
      const scraped = await scrapeAliExpressProduct(aliExpressId);
      if (scraped) {
        return NextResponse.json({
          title: scraped.title,
          description: scraped.descriptionHtml || '',
          price: scraped.price,
          originalPrice: scraped.originalPrice,
          image: scraped.mainImage || (scraped.images && scraped.images[0]) || '',
          merchant: scraped.seller?.name || 'AliExpress',
          shippingCost: scraped.shippingCost || 0,
        });
      }
    }

    // Generic scraper fallback
    console.log(`[API Scrape] Performing generic parse for URL: ${url}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Nie udało się pobrać strony: ${res.statusText}` }, { status: 500 });
    }

    const html = await res.text();

    // Simple regex matching for title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i) || html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) || html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Image
    const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || html.match(/<link\s+rel="image_src"\s+href="([^"]+)"/i);
    let image = imgMatch ? imgMatch[1].trim() : '';

    // Merchant / domain
    let merchant = 'Sklep online';
    try {
      const parsedUrl = new URL(url);
      merchant = parsedUrl.hostname.replace('www.', '');
    } catch {}

    // Price extraction try
    let price: number | undefined;
    let originalPrice: number | undefined;

    const priceMatch = html.match(/property="product:price:amount"\s+content="([\d.]+)"/i) || html.match(/itemprop="price"\s+content="([\d.]+)"/i);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }

    return NextResponse.json({
      title,
      description,
      image,
      merchant,
      price,
      originalPrice,
    });
  } catch (err: any) {
    console.error('[API Scrape] Error:', err);
    return NextResponse.json({ error: err.message || 'Wystąpił błąd podczas skanowania oferty.' }, { status: 500 });
  }
}
