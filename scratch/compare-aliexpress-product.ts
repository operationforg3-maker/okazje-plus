import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { adminDb } from '../src/lib/firebase-admin';
import { createAliExpressClient } from '../src/integrations/aliexpress/client';
import { load as loadHtml } from 'cheerio';

async function runComparison() {
  console.log('Fetching a sample AliExpress product and deal from Firestore...');
  
  // Find a product with source = aliexpress
  const dealsSnap = await adminDb.collection('deals')
    .where('source', '==', 'aliexpress')
    .limit(1)
    .get();

  if (dealsSnap.empty) {
    console.error('No AliExpress deals found in database.');
    return;
  }

  const dealDoc = dealsSnap.docs[0];
  const deal = dealDoc.data();
  const productId = deal.productId || deal.productCoreId;

  const productSnap = await adminDb.collection('product_cores').doc(productId).get();
  const product = productSnap.exists ? productSnap.data() : null;

  console.log(`\n=== FIRESTORE DATA ===`);
  console.log(`Product Core ID: ${productId}`);
  console.log(`Deal ID: ${dealDoc.id}`);
  console.log(`Source Product ID (AliExpress): ${deal.sourceProductId}`);
  console.log(`Title: ${JSON.stringify(deal.title)}`);
  console.log(`Price: ${JSON.stringify(deal.price)}`);
  console.log(`Original Price: ${deal.originalPrice}`);
  console.log(`Shipping: ${JSON.stringify(deal.shipping)}`);
  console.log(`Seller Info (Deal): ${JSON.stringify(deal.seller)}`);
  console.log(`Seller Info (Product): ${JSON.stringify(product?.seller)}`);
  console.log(`Logistics Info (Product): ${JSON.stringify(product?.logistics)}`);
  console.log(`Attributes (Product): ${JSON.stringify(product?.attributes)}`);
  console.log(`Source URL: ${deal.sourceUrl}`);

  const aliId = String(deal.sourceProductId);

  // Initialize AliExpress client
  console.log(`\n=== FETCHING LIVE DATA FROM ALIEXPRESS API ===`);
  try {
    const client = createAliExpressClient();
    const apiDetails = await client.getProductDetails({ productId: aliId });
    const apiProduct = apiDetails?.resp_result?.result?.products?.product?.[0];
    
    if (apiProduct) {
      console.log('Successfully fetched from API!');
      console.log(`API Product ID: ${apiProduct.product_id}`);
      console.log(`API Target Sale Price: ${apiProduct.target_sale_price} ${apiProduct.target_sale_price_currency || 'PLN'}`);
      console.log(`API Target App Sale Price: ${apiProduct.target_app_sale_price}`);
      console.log(`API Original Price: ${apiProduct.original_price}`);
      console.log(`API Discount: ${apiProduct.discount}%`);
      console.log(`API Ship to Days: ${apiProduct.ship_to_days}`);
      console.log(`API Store Info: ${JSON.stringify(apiProduct.store_info)}`);
      console.log(`API Ships From Countries: ${JSON.stringify(apiProduct.ships_from_countries)}`);
      console.log(`API Attributes (product_props): ${JSON.stringify(apiProduct.product_props?.product_prop?.slice(0, 5))}`);
    } else {
      console.warn('API returned empty or error response:', JSON.stringify(apiDetails));
    }

    console.log('\nFetching logistics info via Logistics API...');
    const logistics = await client.getLogisticsInfo(aliId, 'PL', 1);
    console.log(`API Logistics Info: ${JSON.stringify(logistics)}`);

  } catch (apiErr: any) {
    console.error('AliExpress API fetch failed:', apiErr.message || apiErr);
  }

  console.log(`\n=== FETCHING LIVE DATA FROM ALIEXPRESS HTML ===`);
  const url = deal.sourceUrl || `https://www.aliexpress.com/item/${aliId}.html`;
  console.log(`Scraping URL: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8,de;q=0.7',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`HTML fetch failed: HTTP ${response.status}`);
    } else {
      const html = await response.text();
      console.log(`Received HTML (${html.length} bytes).`);
      
      const $ = loadHtml(html);
      
      // Look for title
      const pageTitle = $('title').text();
      console.log(`HTML Page Title: ${pageTitle}`);

      // Try parsing JSON LD
      let ldProductFound = false;
      $('script[type="application/ld+json"]').each((_, el) => {
        const text = $(el).text();
        if (!text) return;
        try {
          const parsed = JSON.parse(text);
          const entries = Array.isArray(parsed) ? parsed : [parsed];
          for (const entry of entries) {
            const prod = entry?.['@type'] === 'Product' ? entry : entry?.['@graph']?.find((item: any) => item?.['@type'] === 'Product');
            if (prod) {
              ldProductFound = true;
              console.log('Found schema.org Product in JSON-LD!');
              console.log(`- Title: ${prod.name}`);
              console.log(`- Image: ${prod.image}`);
              console.log(`- Offers: ${JSON.stringify(prod.offers)}`);
              console.log(`- Brand: ${JSON.stringify(prod.brand)}`);
            }
          }
        } catch {}
      });

      if (!ldProductFound) {
        console.log('No schema.org Product found in JSON-LD.');
      }

      // Check for common scripts containing details
      console.log('Searching page scripts for structured variables...');
      let runParamsFound = false;
      $('script').each((_, el) => {
        const js = $(el).text();
        if (js.includes('window.runParams') || js.includes('window._initialData')) {
          runParamsFound = true;
          console.log(`Found a script containing initial data/runParams! Length: ${js.length} chars.`);
          if (js.includes('window.runParams')) {
            console.log('- Script contains: window.runParams');
          }
          if (js.includes('window._initialData')) {
            console.log('- Script contains: window._initialData');
          }
        }
      });

      if (!runParamsFound) {
        console.log('No initial data variables script found.');
      }
    }
  } catch (htmlErr: any) {
    console.error('HTML fetch failed:', htmlErr.message || htmlErr);
  }
}

runComparison();
