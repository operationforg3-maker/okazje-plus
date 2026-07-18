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

function getGoogleProductCategory(main: string, sub?: string, subsub?: string): string {
  const mainLower = (main || '').toLowerCase();
  const subLower = (sub || '').toLowerCase();
  const subsubLower = (subsub || '').toLowerCase();

  if (mainLower.includes('elektronika')) {
    if (subLower.includes('telefony')) return 'Electronics > Communications > Telephony > Mobile Phones';
    if (subLower.includes('komputery')) return 'Electronics > Computers';
    if (subLower.includes('rc') || subsubLower.includes('drony')) return 'Toys & Games > Toys > Radio Control Toys';
    return 'Electronics';
  }
  if (mainLower.includes('dziecko') || mainLower.includes('zabawki')) {
    if (subLower.includes('odziez') || subLower.includes('ubranka')) return 'Apparel & Accessories > Clothing > Baby & Toddler Clothing';
    if (subLower.includes('foteliki')) return 'Baby & Toddler > Baby Transport > Car Seats';
    return 'Toys & Games > Toys';
  }
  if (mainLower.includes('moda') || mainLower.includes('odziez') || mainLower.includes('buty')) {
    if (subLower.includes('buty') || subLower.includes('obuwie')) return 'Apparel & Accessories > Shoes';
    if (subLower.includes('akcesoria')) return 'Apparel & Accessories > Handbags, Wallets & Cases';
    return 'Apparel & Accessories > Clothing';
  }
  if (mainLower.includes('dom') || mainLower.includes('ogrod') || mainLower.includes('kuchnia')) {
    return 'Home & Garden';
  }
  if (mainLower.includes('sport') || mainLower.includes('turystyka')) {
    return 'Sporting Goods';
  }
  if (mainLower.includes('zdrowie') || mainLower.includes('uroda') || mainLower.includes('kosmetyki')) {
    if (subLower.includes('makijaz')) return 'Health & Beauty > Personal Care > Cosmetics > Makeup';
    return 'Health & Beauty > Personal Care';
  }
  if (mainLower.includes('motoryzacja') || mainLower.includes('samochod')) {
    return 'Vehicles & Parts > Vehicle Parts & Accessories';
  }
  if (mainLower.includes('zwierzeta')) {
    return 'Animals & Pet Supplies';
  }
  if (mainLower.includes('ksiazki') || mainLower.includes('media')) {
    return 'Media > Books';
  }
  
  return 'Apparel & Accessories'; // Fallback
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
    
    const itemsXmlArray = products.reduce((acc: string[], product) => {
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
      
      // Image resolution
      const image = product.imageUrl || (product.images && product.images[0]) || '';
      
      // REQUIRED FIELDS CHECK
      if (!title || title === 'Produkt' || !image || !cleanDescription) {
        return acc;
      }
      
      // Price calculation
      // Harvesters might save price in different locations
      let priceVal = 0;
      let currency = 'PLN';

      if (product.bestPrice?.amount > 0) {
        priceVal = product.bestPrice.amount;
        currency = product.bestPrice.currency || 'PLN';
      } else if (product.bestTotalPrice > 0) {
        priceVal = product.bestTotalPrice;
      } else if (product.smartPrice?.amount > 0) {
        priceVal = product.smartPrice.amount;
        currency = product.smartPrice.currency || 'PLN';
      } else if (product.price?.amount > 0) {
        priceVal = product.price.amount;
        currency = product.price.currency || 'PLN';
      } else if (typeof product.price === 'number' && product.price > 0) {
        priceVal = product.price;
      }

      if (priceVal <= 0) {
        return acc; // filter out items with no valid price
      }

      const formattedPrice = `${priceVal.toFixed(2)} ${currency}`;
      
      // Additional images resolution
      const productImages = Array.isArray(product.images) ? product.images : [];
      const additionalImagesXml = productImages
        .slice(1, 11) // Up to 10 additional images
        .filter((img: string) => img && img !== image)
        .map((img: string) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`)
        .join('\n');
      
      // Brand resolution
      const rawBrand = product.metadata?.brand || product.specs?.brand || product.specs?.Brand || product.attributes?.brand || product.attributes?.Brand || '';
      const isGenericBrand = !rawBrand || /various|inne|unknown|generic/i.test(rawBrand.trim());
      const brand = isGenericBrand ? '' : rawBrand.trim();
      
      // Identifiers resolution
      const gtin = product.metadata?.gtin || product.metadata?.ean || product.metadata?.upc || product.metadata?.isbn || '';
      const mpn = product.metadata?.mpn || product.specs?.mpn || product.specs?.MPN || '';
      
      // Google product category resolution
      const googleCategory = getGoogleProductCategory(
        product.mainCategorySlug || '',
        product.subCategorySlug || '',
        product.subSubCategorySlug || ''
      );
      
      // According to Google Merchant Center rules:
      // If we don't have GTIN AND don't have both Brand and MPN, identifier_exists is false.
      // If identifier_exists is false, we should NOT send g:brand or g:mpn unless they are real.
      const hasValidGtin = gtin.length > 0;
      const hasValidMpnAndBrand = mpn.length > 0 && brand.length > 0;
      const identifierExists = hasValidGtin || hasValidMpnAndBrand;
      
      // Age group and gender resolution based on category
      const isKids = (product.mainCategorySlug || '').toLowerCase().includes('dziecko') || (product.mainCategorySlug || '').toLowerCase().includes('zabawki');
      const ageGroup = isKids ? 'kids' : 'adult';
      
      // Product URL uses the requested locale prefix
      const link = `${baseUrl}/${locale}/products/${product.id}`;
      
      // XML elements construction
      let itemXml = `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(title.slice(0, 150))}</g:title>
      <g:description>${escapeXml(cleanDescription.slice(0, 5000))}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(image)}</g:image_link>
${additionalImagesXml ? additionalImagesXml + '\n' : ''}      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${escapeXml(formattedPrice)}</g:price>
      <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>
      <g:identifier_exists>${identifierExists ? 'yes' : 'no'}</g:identifier_exists>
      <g:adult>no</g:adult>
      <g:age_group>${ageGroup}</g:age_group>
      <g:gender>unisex</g:gender>`;

      if (brand) {
        itemXml += `\n      <g:brand>${escapeXml(brand)}</g:brand>`;
      }
      if (gtin) {
        itemXml += `\n      <g:gtin>${escapeXml(gtin)}</g:gtin>`;
      }
      if (mpn && !hasValidGtin) {
        itemXml += `\n      <g:mpn>${escapeXml(mpn)}</g:mpn>`;
      }
      
      // Extract shipping cost
      let shippingCostVal = -1;
      if (product.metadata?.shippingDetails?.cost !== undefined) {
        shippingCostVal = product.metadata.shippingDetails.cost;
      } else if (product.metadata?.shippingCost !== undefined) {
        shippingCostVal = product.metadata.shippingCost;
      } else if (product.metadata?.freeShipping || product.metadata?.shippingDetails?.free) {
        shippingCostVal = 0;
      }
      
      if (shippingCostVal >= 0) {
        itemXml += `\n      <g:shipping>
        <g:country>PL</g:country>
        <g:price>${shippingCostVal.toFixed(2)} ${currency}</g:price>
      </g:shipping>`;
      }

      itemXml += `\n    </item>`;
      acc.push(itemXml);
      return acc;
    }, []);
    
    const itemsXml = itemsXmlArray.join('\n');
    
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
