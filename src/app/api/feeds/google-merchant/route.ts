import { NextRequest } from 'next/server';
import { getAllApprovedProductsForSitemap } from '@/lib/data-admin';

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';
    
    // Parse locale parameter from URL (e.g. /api/feeds/google-merchant?locale=de)
    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get('locale') || 'pl';
    const locale = SUPPORTED_LOCALES.includes(localeParam as any)
      ? (localeParam as typeof SUPPORTED_LOCALES[number])
      : 'pl';
    
    // Fetch all approved products (up to 50,000) using optimized Admin SDK query
    const products = await getAllApprovedProductsForSitemap(50000);
    
    const itemsXml = products.map((product) => {
      // Get title (prefer requested locale, fallback to PL/EN)
      let title = '';
      if (typeof product.title === 'string') {
        title = product.title;
      } else if (product.title && typeof product.title === 'object') {
        title = product.title[locale] || product.title.pl || product.title.en || 'Produkt';
      } else {
        title = product.name || 'Produkt';
      }
      
      // Get description (prefer requested locale, fallback to PL/EN)
      let description = '';
      if (product.description && typeof product.description === 'object') {
        description = product.description[locale] || product.description.pl || product.description.en || '';
      } else if (typeof product.description === 'string') {
        description = product.description;
      }
      
      if (!description) {
        if (product.shortDescription && typeof product.shortDescription === 'object') {
          description = product.shortDescription[locale] || product.shortDescription.pl || product.shortDescription.en || '';
        } else if (typeof product.shortDescription === 'string') {
          description = product.shortDescription;
        }
      }
      
      const cleanDescription = stripHtml(description) || title;
      
      // Price calculation
      const priceVal = product.bestPrice?.amount || product.bestTotalPrice || 0;
      const currency = product.bestPrice?.currency || 'PLN';
      const formattedPrice = `${priceVal.toFixed(2)} ${currency}`;
      
      // Image resolution
      const image = product.imageUrl || (product.images && product.images[0]) || '';
      
      // Brand resolution
      const brand = product.metadata?.brand || product.specs?.brand || product.specs?.Brand || 'Various';
      
      // Product URL uses the requested locale prefix
      const link = `${baseUrl}/${locale}/products/${product.id}`;
      
      // XML elements
      return `    <item>
      <g:id>${product.id}</g:id>
      <g:title>${escapeXml(title.slice(0, 150))}</g:title>
      <g:description>${escapeXml(cleanDescription.slice(0, 1000))}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(image)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${escapeXml(formattedPrice)}</g:price>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:mpn>${escapeXml(product.id)}</g:mpn>
    </item>`;
    }).join('\n');
    
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Okazje+ - Produkty Google Merchant Center (${locale.toUpperCase()})</title>
    <link>${baseUrl}/${locale}</link>
    <description>Oficjalny feed produktowy dla Google Merchant Center z aktualnymi cenami i dostępnością dla języka ${locale.toUpperCase()}.</description>
    <language>${locale}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Error generating Google Merchant feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
