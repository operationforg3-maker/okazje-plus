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
  const client = createAliExpressClient();
  const response = await client.getProductDetails({ productId: id });

  // Check for API errors
  if (response && (response as any).error_response) {
    throw new Error(`AliExpress API returned an error: ${(response as any).error_response.msg || 'Unknown error'}`);
  }

  const productsList = (response as any)?.resp_result?.result?.products;
  const product = Array.isArray(productsList)
    ? productsList[0]
    : (productsList?.product?.[0] || (response as any)?.resp_result?.result?.products?.[0] || (response as any)?.product);

  if (!product) {
    throw new Error(`Product details not found for ID: ${id}`);
  }

  // Extract all images
  const allImages: string[] = [];
  const mainImage = product.product_main_image_url || product.image_url || '';
  if (mainImage) allImages.push(mainImage);
  
  // Additional images
  if (product.product_small_image_urls) {
    const smallImgs = Array.isArray(product.product_small_image_urls) 
      ? product.product_small_image_urls 
      : (Array.isArray(product.product_small_image_urls.string) 
          ? product.product_small_image_urls.string 
          : [product.product_small_image_urls]);
    allImages.push(...smallImgs.filter((u: string) => u && !allImages.includes(u)));
  }
  
  // Extract warehouse and delivery info
  const warehouses = Array.isArray(product.ships_from_countries)
    ? product.ships_from_countries
    : (product.ships_from_countries?.string || []);
  const warehouse = warehouses[0] || product.ship_from_country || '';
  const deliveryTime = product.ship_to_days ? `${product.ship_to_days} days` : '';
  
  // Extract variants/SKUs if available
  const variants = product.sku_list || product.aeop_ae_product_s_k_us?.aeop_ae_product_sku || product.skus || [];
  
  // Call our scraper to get specifications and HTML description
  let scrapedData: any = null;
  try {
    scrapedData = await scrapeAliExpressProduct(id);
  } catch (scrapeErr) {
    console.error(`[AliExpress Details Helper] Scraper failed for ID ${id}:`, scrapeErr);
  }

  // Map product properties to attributes list
  const attributes = extractAttributesFromProps(product.product_props);

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
    id: String(product.product_id || product.item_id || id),
    title: product.product_title || product.title || scrapedData?.title || '',
    descriptionHtml: scrapedData?.descriptionHtml || product.product_description || product.description || product.detail || product.description_html || '',
    images: allImages.length > 0 ? allImages : (scrapedData?.images || []),
    mainImage: mainImage || scrapedData?.mainImage || '',
    price: Number(product.target_sale_price || product.sale_price || product.app_sale_price || scrapedData?.price || 0),
    originalPrice: Number(product.target_original_price || product.original_price || scrapedData?.originalPrice || 0),
    rating: product.evaluate_rate ? parseFloat(product.evaluate_rate) / 20 : (product.product_rating ? Number(product.product_rating) : (scrapedData?.seller?.rating || 0)),
    orders: product.lastest_volume || product.volume || product.orders || 0,
    merchant: product.shop_name || product.store_info?.store_name || product.store_name || product.seller_name || product.shop_name || scrapedData?.seller?.name || '',
    merchantId: product.shop_id || product.store_info?.store_id || null,
    shipping: product.shipping || product.logistics_info || '',
    shippingInfo: {
      warehouse: warehouse || (scrapedData?.shippingDays ? 'CN' : ''),
      deliveryTime: deliveryTime || (scrapedData?.shippingDays ? `${scrapedData.shippingDays} days` : ''),
      freeShipping: product.free_shipping || product.is_free_shipping || (scrapedData?.shippingCost === 0) || false,
      shippingCost: product.shipping_cost || product.shipping_price || scrapedData?.shippingCost || null,
    },
    attributes,
    specs,
    variants: (scrapedData?.variants && scrapedData.variants.length > 0)
      ? scrapedData.variants
      : (Array.isArray(variants) ? variants : []),
    skuList: scrapedData?.skuList || [],
    videoUrl: product.product_video_url || scrapedData?.videoUrl || null,
    categoryId: product.category_id || product.first_level_category_id || null,
    categoryName: product.category_name || product.first_level_category_name || '',
    reviewImages: scrapedData?.reviewImages || [],
    reviews: scrapedData?.reviews || [],
    descriptionImages: scrapedData?.descriptionImages || [],
  };

  return { product: normalized, raw: response };
}
