import { NextResponse } from 'next/server';
import { scrapeAliExpressProduct } from '@/integrations/aliexpress/scraper';

function extractAliExpressId(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const match = url.pathname.match(/\/item\/(\d+)/) || url.pathname.match(/\/(\d+)\.html/) || url.search.match(/[?&]id=(\d+)/) || url.search.match(/[?&]productId=(\d+)/);
    return match ? match[1] : null;
  } catch {
    const match = urlStr.match(/\/item\/(\d+)/) || urlStr.match(/\/(\d+)\.html/) || urlStr.match(/[?&]id=(\d+)/) || urlStr.match(/[?&]productId=(\d+)/);
    return match ? match[1] : null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'Brak parametru URL' }, { status: 400 });
  }

  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    // 1. Sprawdź czy to bezpośredni link z AliExpress ID
    let aliExpressId = extractAliExpressId(targetUrl);

    // 2. Jeśli to krótki link (np. s.click.aliexpress.com, bit.ly, t.co itp.), rozwiąż przekierowanie
    if (!aliExpressId && (targetUrl.includes('s.click.aliexpress.com') || targetUrl.includes('/e/') || targetUrl.length < 40)) {
      try {
        const headRes = await fetch(targetUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (headRes.url) {
          targetUrl = headRes.url;
          aliExpressId = extractAliExpressId(targetUrl);
        }
      } catch (redirectErr) {
        console.warn('[API Scrape] Redirect resolution warning:', redirectErr);
      }
    }

    if (aliExpressId) {
      console.log(`[API Scrape] Scraping AliExpress product ID: ${aliExpressId}`);
      try {
        const scraped = await scrapeAliExpressProduct(aliExpressId);
        if (scraped && scraped.title) {
          return NextResponse.json({
            title: scraped.title,
            description: scraped.descriptionHtml || '',
            price: scraped.price,
            originalPrice: scraped.originalPrice,
            image: scraped.mainImage || (scraped.images && scraped.images[0]) || '',
            merchant: scraped.seller?.name || 'AliExpress',
            shippingCost: scraped.shippingCost || 0,
            resolvedUrl: targetUrl,
            source: 'aliexpress',
          });
        }
      } catch (aliErr) {
        console.warn('[API Scrape] AliExpress specific scraper failed, falling back to html parse:', aliErr);
      }
    }

    // Generic scraper fallback
    console.log(`[API Scrape] Performing generic parse for URL: ${targetUrl}`);
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Nie udało się pobrać strony (HTTP ${res.status}): ${res.statusText}` }, { status: 500 });
    }

    const html = await res.text();

    // 1. JSON-LD parsing (często ma najdokładniejsze dane o cenie i produkcie)
    let ldTitle: string | undefined;
    let ldDescription: string | undefined;
    let ldImage: string | undefined;
    let ldPrice: number | undefined;
    let ldMerchant: string | undefined;

    const ldMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of ldMatches) {
      try {
        const json = JSON.parse(match[1]);
        const items = Array.isArray(json) ? json : (json['@graph'] ? json['@graph'] : [json]);
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
            ldTitle = ldTitle || item.name;
            ldDescription = ldDescription || item.description;
            if (item.image) {
              ldImage = ldImage || (Array.isArray(item.image) ? item.image[0] : (typeof item.image === 'object' ? item.image.url : item.image));
            }
            if (item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              const p = offers.price || offers.lowPrice;
              if (p) ldPrice = parseFloat(String(p).replace(/[^0-9.,]/g, '').replace(',', '.'));
              if (offers.seller?.name) ldMerchant = offers.seller.name;
            }
          }
        }
      } catch (_) {}
    }

    // 2. OpenGraph / Meta matching
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || 
                       html.match(/<title>([^<]+)<\/title>/i);
    let title = ldTitle || (titleMatch ? titleMatch[1].trim() : '');

    // Oczyszczenie typowych przyrostków tytułów typu " - Sklep ABC", " | Allegro.pl"
    title = title.replace(/\s*[-|–]\s*(Allegro|AliExpress|Ceneo|Amazon|Media Expert|RTV Euro AGD).*$/i, '').trim();

    // Description
    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) || 
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = ldDescription || (descMatch ? descMatch[1].trim() : '');

    // Image
    const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) || 
                     html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);
    let image = ldImage || (imgMatch ? imgMatch[1].trim() : '');
    if (image && image.startsWith('//')) {
      image = `https:${image}`;
    }

    // Merchant / domain
    let merchant = ldMerchant || 'Sklep online';
    try {
      const parsedUrl = new URL(targetUrl);
      merchant = ldMerchant || parsedUrl.hostname.replace('www.', '');
    } catch {}

    // Price extraction try
    let price: number | undefined = ldPrice;
    let originalPrice: number | undefined;

    if (!price) {
      const priceMatch = html.match(/property=["']product:price:amount["']\s+content=["']([\d.,]+)["']/i) || 
                         html.match(/itemprop=["']price["']\s+content=["']([\d.,]+)["']/i);
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(',', '.'));
      }
    }

    return NextResponse.json({
      title,
      description,
      image,
      merchant,
      price: price && !isNaN(price) ? price : undefined,
      originalPrice: originalPrice && !isNaN(originalPrice) ? originalPrice : undefined,
      resolvedUrl: targetUrl,
    });
  } catch (err: any) {
    console.error('[API Scrape] Error:', err);
    return NextResponse.json({ error: err.message || 'Wystąpił błąd podczas skanowania oferty.' }, { status: 500 });
  }
}
