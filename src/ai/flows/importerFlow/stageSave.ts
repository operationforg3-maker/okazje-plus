import { EnrichedProduct, ImportStageConfig } from './types';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateIdentityHash } from '@/lib/automation/identity-matcher';
import { LocalizedText, ProductCore, DealM6 } from '@/lib/types';
import { queueProductForIndexing, queueDealForIndexing } from '@/search/typesenseQueue';
import { generateEmbeddings } from '@/ai/embeddings';

export interface SaveConfig extends ImportStageConfig {
  skipExisting?: boolean;
  jobId?: string;
  categoryNamePL?: string;
  subcategoryNamePL?: string;
  subsubcategoryNamePL?: string;
}

const DEFAULT_CONFIG: SaveConfig = {
  name: 'save',
  batchSize: 10,
  delayBetweenItems: 100,
  delayBetweenBatches: 500,
  maxRetries: 1,
  skipExisting: false,
};

function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item));
  }
  if (typeof obj === 'object') {
    if (obj.constructor && obj.constructor.name !== 'Object') {
      return obj;
    }
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = removeUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export async function saveProductsToFirestore(
  products: EnrichedProduct[],
  config: Partial<SaveConfig> = {}
): Promise<{ created: string[]; updated: string[]; skipped: string[] }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  console.log(`[Importer:Save] Saving ${products.length} refined products to product_cores + deals...`);

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const parsed = parseFloat(String(val).replace(',', '.').replace(/[^\d\.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  for (const product of products) {
    try {
      // 1. Calculate combined identity hash (Primary key for product deduplication)
      const identityHash = calculateIdentityHash(
        product.title.pl || product.title.en || 'Untitled',
        product.image || ''
      );

      // 2. Query for existing product core
      let existingProductDoc: any = null;
      const queryByIdentity = await adminDb
        .collection('product_cores')
        .where('identityHash', '==', identityHash)
        .limit(1)
        .get();

      if (!queryByIdentity.empty) {
        existingProductDoc = queryByIdentity.docs[0];
      } else {
        const queryByOriginalId = await adminDb
          .collection('product_cores')
          .where('metadata.originalId', '==', product.originalId)
          .where('metadata.source', '==', 'aliexpress')
          .limit(1)
          .get();

        if (!queryByOriginalId.empty) {
          existingProductDoc = queryByOriginalId.docs[0];
        }
      }

      if (existingProductDoc && finalConfig.skipExisting) {
        skipped.push(existingProductDoc.id);
        continue;
      }

      const productCoreId = existingProductDoc ? existingProductDoc.id : adminDb.collection('product_cores').doc().id;
      const now = new Date().toISOString();

      // Generate embedding for search
      let embedding: number[] | undefined = undefined;
      try {
        const titleText = product.title?.pl || product.title?.en || '';
        const descText = product.description?.pl || product.description?.en || '';
        const textForEmbedding = `${titleText} ${descText}`.trim();
        if (textForEmbedding) {
          embedding = await generateEmbeddings(textForEmbedding);
        }
      } catch (err) {
        console.error(`  ⚠️ Failed to generate embedding for product ${product.originalId}:`, err);
      }

      // 3. Resolve shipping & logistics
      const shippingCost = product.shipping ? parseNumber(product.shipping) : 0;
      const deliveryDays = product.deliveryTime ? (parseInt(product.deliveryTime, 10) || 7) : 7;
      const isFreeShipping = product.freeShipping ?? (shippingCost === 0);

      // 4. Construct ProductCore document
      const productCorePayload: Partial<ProductCore> = {
        title: product.title,
        shortDescription: product.description,
        fullDescription: product.descriptionHtml ? {
          pl: product.descriptionHtml,
          en: product.descriptionHtml,
          de: product.descriptionHtml,
          fr: product.descriptionHtml,
          es: product.descriptionHtml,
          uk: product.descriptionHtml,
        } : product.description,
        description: product.description,
        
        mainCategorySlug: product.categorySlugEN,
        subCategorySlug: product.subcategorySlugEN,
        subSubCategorySlug: product.subsubcategorySlugEN,

        imageUrl: product.image,
        images: product.gallery && product.gallery.length > 0 ? product.gallery : [product.image],
        
        rating: {
          score: Number(product.rating || 0),
          count: Number(product.orders || 0),
          provider: 'aliexpress',
        },
        
        logistics: {
          deliveryDays,
          isFreeShipping,
          shippingCost,
        },
        
        seller: product.storeName ? {
          name: product.storeName,
          storeUrl: product.storeUrl,
          rating: Number(product.rating || 4.5),
        } : undefined,

        specs: product.specsLocalized?.pl || product.rawSpecs || {},
        coreSpecs: product.specsLocalized?.en || product.rawSpecs || {},
        embedding: embedding ? FieldValue.vector(embedding) as any : undefined,
        
        // Alternative format to specs (array for listing display)
        attributes: product.attributes || [],
        variants: product.variants || [],

        status: 'approved', // Auto-approve refined items
        updatedAt: now,
        
        metadata: {
          source: 'aliexpress',
          originalId: product.originalId,
          qualityScore: product.qualityScore,
          importedAt: now,
          importJobId: finalConfig.jobId,
        }
      };

      const cleanProductCore = removeUndefined(productCorePayload);
      if (!existingProductDoc) {
        (cleanProductCore as any).createdAt = now;
        (cleanProductCore as any).id = productCoreId;
        (cleanProductCore as any).linkedDealIds = [];
        await adminDb.collection('product_cores').doc(productCoreId).set(cleanProductCore);
        created.push(productCoreId);
      } else {
        await adminDb.collection('product_cores').doc(productCoreId).set(cleanProductCore, { merge: true });
        updated.push(productCoreId);
      }

      // Sync with search queue
      try {
        await queueProductForIndexing(productCoreId);
      } catch (err) {
        console.error(`  ⚠️ Failed to queue product ${productCoreId} for indexing:`, err);
      }

      // 5. Query for existing Deal
      let existingDealDoc: any = null;
      const dealQuery = await adminDb
        .collection('deals')
        .where('productId', '==', productCoreId)
        .where('source', '==', 'aliexpress')
        .limit(1)
        .get();

      if (!dealQuery.empty) {
        existingDealDoc = dealQuery.docs[0];
      } else {
        const dealQueryByOriginalId = await adminDb
          .collection('deals')
          .where('sourceProductId', '==', product.originalId)
          .where('source', '==', 'aliexpress')
          .limit(1)
          .get();

        if (!dealQueryByOriginalId.empty) {
          existingDealDoc = dealQueryByOriginalId.docs[0];
        }
      }

      const dealId = existingDealDoc ? existingDealDoc.id : adminDb.collection('deals').doc().id;

      // 6. Construct Deal document
      const priceAmount = product.price?.amount || product.pricePLN || 0;
      const originalPrice = product.originalPriceValue || priceAmount;
      const discountAmount = originalPrice > priceAmount ? originalPrice - priceAmount : 0;
      const discountPercent = discountAmount > 0 ? Math.round((discountAmount / originalPrice) * 100) : undefined;

      const dealPayload: Omit<DealM6, 'id'> = {
        productId: productCoreId,
        productCoreId: productCoreId,
        
        mainCategorySlug: product.categorySlugEN,
        subCategorySlug: product.subcategorySlugEN,
        subSubCategorySlug: product.subsubcategorySlugEN,
        
        image: product.image,
        images: product.gallery && product.gallery.length > 0 ? product.gallery : [product.image],
        gallery: product.gallery && product.gallery.length > 0 ? product.gallery : [product.image],

        price: {
          amount: priceAmount,
          currency: product.price?.currency || 'PLN',
        },
        originalPrice: originalPrice > 0 ? originalPrice : undefined,
        discount: discountAmount > 0 ? { amount: discountAmount, percentage: discountPercent } : undefined,
        discountPercent,
        
        shipping: {
          cost: shippingCost,
          timeDays: deliveryDays,
          method: 'Standard',
          fromCountry: product.warehouse,
        },
        totalPrice: priceAmount + shippingCost,
        
        source: 'aliexpress',
        affiliateLink: product.link || product.affiliateUrl || '',
        affiliateUrl: product.link || product.affiliateUrl || '',
        dealUrl: product.link || product.affiliateUrl || '',
        
        merchantName: product.storeName,
        
        title: product.title,
        description: product.description,
        dealType: product.discountValue ? 'sale' : 'regular',
        couponCode: (product as any).couponCode,
        freeShipping: isFreeShipping,
        
        stockStatus: 'in_stock',
        isActive: true,
        
        priceHistory: existingDealDoc?.data()?.priceHistory || [
          {
            date: now.substring(0, 10),
            price: priceAmount,
            currency: product.price?.currency || 'PLN',
          }
        ],
        
        voteCount: existingDealDoc?.data()?.voteCount || 0,
        temperature: existingDealDoc?.data()?.temperature || 0,
        commentsCount: existingDealDoc?.data()?.commentsCount || 0,
        
        status: 'approved',
        
        createdAt: existingDealDoc ? existingDealDoc.data().createdAt : now,
        updatedAt: now,
        
        sourceProductId: product.originalId,
        sourceUrl: product.link || product.affiliateUrl || '',
        embedding: embedding ? FieldValue.vector(embedding) as any : undefined,
        
        metadata: {
          source: 'aliexpress',
          importedAt: now,
          originalId: product.originalId,
          merchant: product.storeName,
          warehouse: product.warehouse,
          deliveryTime: `${deliveryDays} dni`,
          shippingMethod: 'Standard',
          variants: product.skuList || [],
        }
      };

      const cleanDeal = removeUndefined(dealPayload);
      await adminDb.collection('deals').doc(dealId).set(cleanDeal, { merge: true });

      // Sync with search queue
      try {
        await queueDealForIndexing(dealId);
      } catch (err) {
        console.error(`  ⚠️ Failed to queue deal ${dealId} for indexing:`, err);
      }

      // 7. Update ProductCore with best price and linked deal IDs
      await adminDb.collection('product_cores').doc(productCoreId).update(removeUndefined({
        bestPrice: dealPayload.price,
        bestTotalPrice: dealPayload.totalPrice,
        bestDealId: dealId,
        linkedDealIds: FieldValue.arrayUnion(dealId),
      }));

    } catch (e) {
      console.error(`  ✗ Save failed for ${product.originalId}:`, e);
    }
  }

  return { created, updated, skipped };
}

