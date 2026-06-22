import 'dotenv/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { adminDb } from '../src/lib/firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('Reading scratch/mobile_response_1782064247497.json...');
  const fileContent = fs.readFileSync(path.resolve(process.cwd(), 'scratch/mobile_response_1782064247497.json'), 'utf8');
  let jsonStr = fileContent.trim();
  const jsonpMatch = jsonStr.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
  if (jsonpMatch) {
    jsonStr = jsonpMatch[1].trim();
  }
  const data = JSON.parse(jsonStr);

  const resObj = data.data?.result || data.result || data;
  if (!resObj) {
    console.error('Could not find result object in JSON!');
    return;
  }

  // 1. Extract variants properties (e.g. Color, Size)
  const rawProperties = resObj.SKU?.skuProperties || [];
  const mtopVariants = rawProperties.map((prop: any) => ({
    id: String(prop.skuPropertyId),
    name: prop.skuPropertyName,
    values: prop.skuPropertyValues?.map((val: any) => val.propertyValueName) || [],
  }));

  // 2. Extract concrete SKU list mapping combinations to specific SKU properties
  const skuPaths = resObj.SKU?.skuPaths || [];
  const skuPriceInfoMap = resObj.PRICE?.skuPriceInfoMap || {};
  const skuImagesMap = resObj.HEADER_IMAGE_PC?.skuImagesMap || {};

  // Build helper maps
  const valueIdToNameMap = new Map<string, string>();
  const valueIdToImageMap = new Map<string, string>();
  rawProperties.forEach((prop: any) => {
    prop.skuPropertyValues?.forEach((val: any) => {
      valueIdToNameMap.set(String(val.propertyValueId), val.propertyValueName);
      if (val.skuPropertyImagePath) {
        valueIdToImageMap.set(String(val.propertyValueId), val.skuPropertyImagePath);
      }
    });
  });

  const mtopSkuList = skuPaths.map((pathEntry: any) => {
    const skuId = String(pathEntry.skuIdStr || pathEntry.skuId);
    const stock = pathEntry.skuStock ?? 0;
    const available = pathEntry.salable !== false && stock > 0;

    const attributes: Array<{ name: string; value: string; image?: string }> = [];
    const pathString = pathEntry.path || '';
    const segments = pathString.split(';');

    segments.forEach((seg: string) => {
      const [propId, valId] = seg.split(':');
      if (propId && valId) {
        const prop = rawProperties.find((p: any) => String(p.skuPropertyId) === propId);
        const propName = prop ? prop.skuPropertyName : `Prop_${propId}`;
        const valName = valueIdToNameMap.get(valId) || `Val_${valId}`;
        const valImage = valueIdToImageMap.get(valId);

        attributes.push({
          name: propName,
          value: valName,
          ...(valImage ? { image: valImage } : {}),
        });
      }
    });

    // Parse price from salePriceLocal (e.g., "490,85zł|490|85")
    const priceInfo = skuPriceInfoMap[skuId];
    let price: number | undefined;
    if (priceInfo?.salePriceLocal) {
      const parts = priceInfo.salePriceLocal.split('|');
      if (parts.length >= 3) {
        price = Number(parts[1] + '.' + parts[2]);
      }
    }

    // Extract image
    const imageList = skuImagesMap[skuId];
    const image = (Array.isArray(imageList) && imageList.length > 0) ? imageList[0] : undefined;

    return {
      skuId,
      available,
      attributes,
      price,
      stock,
      image
    };
  });

  console.log(`Parsed ${mtopVariants.length} variants and ${mtopSkuList.length} SKUs`);

  // Query database for the travel fridge ProductCore and Deal
  const originalId = '1005009279188100';
  console.log(`Querying product_cores where originalId = ${originalId}...`);
  const productCoreQuery = await adminDb
    .collection('product_cores')
    .where('metadata.originalId', '==', originalId)
    .limit(1)
    .get();

  if (productCoreQuery.empty) {
    console.error('Could not find travel fridge ProductCore in database!');
    return;
  }

  const productCoreDoc = productCoreQuery.docs[0];
  const productCoreId = productCoreDoc.id;
  console.log(`Found ProductCore with ID: ${productCoreId}`);

  // Update ProductCore.variants
  await adminDb.collection('product_cores').doc(productCoreId).update({
    variants: mtopVariants
  });
  console.log('Successfully updated ProductCore.variants');

  // Query database for the associated Deal
  const dealQuery = await adminDb
    .collection('deals')
    .where('productId', '==', productCoreId)
    .limit(1)
    .get();

  if (dealQuery.empty) {
    console.error('Could not find associated Deal in database!');
    return;
  }

  const dealDoc = dealQuery.docs[0];
  const dealId = dealDoc.id;
  console.log(`Found Deal with ID: ${dealId}`);

  // Update Deal.metadata.variants (skuList)
  await adminDb.collection('deals').doc(dealId).update({
    'metadata.variants': mtopSkuList
  });
  console.log('Successfully updated Deal.metadata.variants (skuList)');

  console.log('Backfill successfully completed.');
}

main().catch(console.error);
