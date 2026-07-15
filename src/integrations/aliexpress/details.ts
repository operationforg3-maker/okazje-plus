import { createAliExpressClient } from './client';
import { scrapeAliExpressProduct } from './scraper';

function extractAttributesFromProps(props: any): Array<{ name: string; value: string }> {
  if (!props) return [];
  
  let propsArray: any[] = [];
  if (Array.isArray(props)) {
    propsArray = props;
  } else if (props && Array.isArray(props.product_prop)) {
    propsArray = props.product_prop;
  } else if (typeof props === 'string') {
    try {
      const parsed = JSON.parse(props);
      propsArray = Array.isArray(parsed) ? parsed : (parsed.product_prop || []);
    } catch {
      return [];
    }
  }

  return propsArray
    .map((prop) => {
      const name = String(prop?.attr_name || prop?.attrName || prop?.name || prop?.key || '').trim();
      const value = String(prop?.attr_value || prop?.attrValue || prop?.value || '').trim();
      return name && value ? { name, value } : null;
    })
    .filter(Boolean) as Array<{ name: string; value: string }>;
}

export async function getAliExpressProductDetailsDirect(id: string) {
  let response: any = null;
  let product: any = null;

  try {
    const client = createAliExpressClient();
    response = await client.getProductDetails({ productId: id });

    // Check for API errors
    if (response && (response as any).error_response) {
      console.warn(`[AliExpress Details API] Error response for ID ${id}:`, (response as any).error_response.msg || 'Unknown error');
    } else {
      const productsList = (response as any)?.resp_result?.result?.products;
      product = Array.isArray(productsList)
        ? productsList[0]
        : (productsList?.product?.[0] || (response as any)?.resp_result?.result?.products?.[0] || (response as any)?.product);
    }
  } catch (apiErr: any) {
    console.warn(`[AliExpress Details Helper] API call failed for ID ${id}, using scraper fallback. Error:`, apiErr.message || apiErr);
  }

  // Call our scraper to get specifications and HTML description
  let scrapedData: any = null;
  try {
    scrapedData = await scrapeAliExpressProduct(id);
  } catch (scrapeErr) {
    console.error(`[AliExpress Details Helper] Scraper failed for ID ${id}:`, scrapeErr);
  }

  if (!product && !scrapedData) {
    throw new Error(`Product details not found for ID: ${id} (Both API and Scraper failed)`);
  }

  const p = product || {};

  // Extract all images
  const allImages: string[] = [];
  const mainImage = p.product_main_image_url || p.image_url || '';
  if (mainImage) allImages.push(mainImage);
  
  // Additional images
  if (p.product_small_image_urls) {
    const smallImgs = Array.isArray(p.product_small_image_urls) 
      ? p.product_small_image_urls 
      : (Array.isArray(p.product_small_image_urls.string) 
          ? p.product_small_image_urls.string 
          : [p.product_small_image_urls]);
    allImages.push(...smallImgs.filter((u: string) => u && !allImages.includes(u)));
  }
  
  // Extract warehouse and delivery info
  const warehouses = Array.isArray(p.ships_from_countries)
    ? p.ships_from_countries
    : (p.ships_from_countries?.string || []);
  const warehouse = warehouses[0] || p.ship_from_country || '';
  const deliveryTime = p.ship_to_days ? `${p.ship_to_days} days` : '';
  
  // Extract variants/SKUs if available
  const variants = p.sku_list || p.aeop_ae_product_s_k_us?.aeop_ae_product_sku || p.skus || [];
  
  // Map product properties to attributes list
  const attributes = extractAttributesFromProps(p.product_props);

  // Normalize specifications object
  const specs: Record<string, string> = {};
  attributes.forEach(attr => {
    specs[attr.name] = attr.value;
  });

  // Merge scraped specifications
  if (scrapedData?.specs) {
    Object.entries(scrapedData.specs).forEach(([k, v]) => {
      if (!specs[k]) {
        specs[k] = v as string;
        attributes.push({ name: k, value: v as string });
      }
    });
  }

  const normalized = {
    id: String(p.product_id || p.item_id || id),
    title: p.product_title || p.title || scrapedData?.title || '',
    descriptionHtml: scrapedData?.descriptionHtml || p.product_description || p.description || p.detail || p.description_html || '',
    images: allImages.length > 0 ? allImages : (scrapedData?.images || []),
    mainImage: mainImage || scrapedData?.mainImage || '',
    price: Number(p.target_sale_price || p.sale_price || p.app_sale_price || scrapedData?.price || 0),
    originalPrice: Number(p.target_original_price || p.original_price || scrapedData?.originalPrice || 0),
    rating: p.evaluate_rate ? parseFloat(p.evaluate_rate) / 20 : (p.product_rating ? Number(p.product_rating) : (scrapedData?.seller?.rating || 0)),
    orders: p.lastest_volume || p.volume || p.orders || 0,
    merchant: p.shop_name || p.store_info?.store_name || p.store_name || p.seller_name || p.shop_name || scrapedData?.seller?.name || '',
    merchantId: p.shop_id || p.store_info?.store_id || null,
    shipping: p.shipping || p.logistics_info || '',
    shippingInfo: {
      warehouse: warehouse || (scrapedData?.shippingDays ? 'CN' : ''),
      deliveryTime: deliveryTime || (scrapedData?.shippingDays ? `${scrapedData.shippingDays} days` : ''),
      freeShipping: p.free_shipping || p.is_free_shipping || (scrapedData?.shippingCost === 0) || false,
      shippingCost: p.shipping_cost || p.shipping_price || scrapedData?.shippingCost || null,
    },
    attributes,
    specs,
    variants: (scrapedData?.variants && scrapedData.variants.length > 0)
      ? scrapedData.variants
      : (Array.isArray(variants) ? variants : []),
    skuList: scrapedData?.skuList || [],
    videoUrl: p.product_video_url || scrapedData?.videoUrl || null,
    categoryId: p.category_id || p.first_level_category_id || null,
    categoryName: p.category_name || p.first_level_category_name || '',
    reviewImages: scrapedData?.reviewImages || [],
    reviews: scrapedData?.reviews || [],
    descriptionImages: scrapedData?.descriptionImages || [],
  };

  return { product: normalized, raw: response };
}
