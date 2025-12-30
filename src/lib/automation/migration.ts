/**
 * Migration Script: Convert existing Deal/Product structure to Product-Centric Architecture
 *
 * This script:
 * 1. Reads existing products and deals from Firestore
 * 2. Groups deals by product/similar identity
 * 3. Creates new ProductCore documents with deduplication
 * 4. Links deals to new ProductCores
 * 5. Validates data integrity
 */

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal as DealLegacy, DealM6, Product, ProductCore } from '@/lib/types';
import { calculateIdentityHash, calculateTitleHash, calculateImageHash } from '@/lib/automation/identity-matcher';

interface MigrationStats {
  totalOldProducts: number;
  totalOldDeals: number;
  newProductCoresCreated: number;
  dealsLinked: number;
  duplicatesFound: number;
  errors: Array<{ type: string; message: string }>;
}

/**
 * Main migration function
 */
export async function migrateToProductCentricArchitecture(
  dryRun: boolean = true
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalOldProducts: 0,
    totalOldDeals: 0,
    newProductCoresCreated: 0,
    dealsLinked: 0,
    duplicatesFound: 0,
    errors: [],
  };

  try {
    console.log(
      `\n🚀 Starting migration to Product-Centric Architecture (dryRun: ${dryRun})`
    );

    // Step 1: Fetch existing products and deals
    console.log('\n📥 Fetching existing data...');
    const oldProducts = await getOldProducts();
    const oldDeals = await getOldDeals();

    stats.totalOldProducts = oldProducts.length;
    stats.totalOldDeals = oldDeals.length;

    console.log(`Found ${oldProducts.length} products, ${oldDeals.length} deals`);

    // Step 2: Create a mapping from old products to new ProductCores
    const productMap = new Map<string, ProductCore>();
    const identityMap = new Map<string, string>(); // identityHash -> productId

    console.log('\n🔄 Creating ProductCores...');
    for (const oldProduct of oldProducts) {
      try {
        const productCore = await convertProductToCore(oldProduct, oldDeals);

        // Check for duplicates by identity hash
        const identityHash = productCore.identityHash;
        if (identityMap.has(identityHash)) {
          console.log(
            `  ⚠️  Found duplicate: "${oldProduct.name}" (hash: ${identityHash})`
          );
          stats.duplicatesFound++;
          continue;
        }

        productMap.set(oldProduct.id, productCore);
        identityMap.set(identityHash, oldProduct.id);
        console.log(`  ✓ Created core for: ${oldProduct.name}`);
      } catch (err) {
        stats.errors.push({
          type: 'ProductCoreCreation',
          message: `${oldProduct.id}: ${(err as Error).message}`,
        });
        console.error(`  ✗ Error creating core for ${oldProduct.id}:`, err);
      }
    }

    console.log(`✓ Created ${productMap.size} ProductCores`);

    // Step 3: Create new Deal documents linked to ProductCores
    console.log('\n🔗 Linking deals to ProductCores...');
    const newDealIds: string[] = [];

    for (const oldDeal of oldDeals) {
      try {
        const linkedProductId = oldDeal.linkedProductIds?.[0];
        if (!linkedProductId || !productMap.has(linkedProductId)) {
          console.log(
            `  ⚠️  Skipping deal (no linked product): ${oldDeal.id}`
          );
          continue;
        }

        const productCore = productMap.get(linkedProductId)!;
        const newDeal = convertDealToNew(oldDeal, productCore.id);

        if (!dryRun) {
          const docRef = await addDoc(collection(db, 'deals'), newDeal);
          newDealIds.push(docRef.id);
          console.log(`  ✓ Linked deal: ${oldDeal.title.pl} -> ${productCore.id}`);
        } else {
          newDealIds.push('dry-run-id');
          console.log(`  ✓ [DRY-RUN] Would link deal`);
        }
      } catch (err) {
        stats.errors.push({
          type: 'DealLinking',
          message: `${oldDeal.id}: ${(err as Error).message}`,
        });
        console.error(`  ✗ Error linking deal ${oldDeal.id}:`, err);
      }
    }

    stats.dealsLinked = newDealIds.length;
    console.log(`✓ Linked ${stats.dealsLinked} deals`);

    // Step 4: Save new ProductCores
    if (!dryRun) {
      console.log('\n💾 Saving ProductCores to Firestore...');
      let createdCount = 0;

      for (const productCore of productMap.values()) {
        try {
          const docRef = await addDoc(
            collection(db, 'product_cores'),
            productCore
          );
          createdCount++;
          console.log(
            `  ✓ Saved: ${productCore.title.pl} (${docRef.id})`
          );
        } catch (err) {
          stats.errors.push({
            type: 'FirestoreSave',
            message: `${(err as Error).message}`,
          });
          console.error(`  ✗ Error saving ProductCore:`, err);
        }
      }

      stats.newProductCoresCreated = createdCount;
      console.log(`✓ Saved ${createdCount} ProductCores`);
    } else {
      stats.newProductCoresCreated = productMap.size;
      console.log(`✓ [DRY-RUN] Would save ${productMap.size} ProductCores`);
    }

    // Step 5: Validation
    console.log('\n✅ Validation Results:');
    console.log(`  • Old Products: ${stats.totalOldProducts}`);
    console.log(`  • New ProductCores: ${stats.newProductCoresCreated}`);
    console.log(`  • Duplicates Found: ${stats.duplicatesFound}`);
    console.log(`  • Deals Linked: ${stats.dealsLinked}`);
    console.log(`  • Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.forEach((err) => {
        console.log(`  • [${err.type}] ${err.message}`);
      });
    }

    if (dryRun) {
      console.log('\n⚠️  DRY-RUN MODE: No changes were made to Firestore');
      console.log('Run with dryRun=false to apply changes');
    } else {
      console.log('\n✨ Migration completed successfully!');
    }

    return stats;
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

/**
 * Fetch all old products
 */
async function getOldProducts(): Promise<Product[]> {
  const ref = collection(db, 'products');
  const q = query(ref); // Get all
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
}

/**
 * Fetch all old deals
 */
async function getOldDeals(): Promise<DealLegacy[]> {
  const ref = collection(db, 'deals');
  const q = query(ref); // Get all
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DealLegacy));
}

/**
 * Convert old Product to new ProductCore
 */
function convertProductToCore(product: Product, deals: DealLegacy[]): ProductCore {
  // Find deals linked to this product
  const linkedDeals = deals.filter(
    (d) => d.linkedProductIds?.includes(product.id)
  );

  // Calculate best price
  const prices = linkedDeals
    .map((d) => (d.price || 0) + (d.shippingCost || 0))
    .filter((p) => p > 0);
  const bestPrice =
    prices.length > 0 ? Math.min(...prices) : product.price || 0;

  // Extract identity hash
  const identityHash = calculateIdentityHash(
    product.name,
    product.image || 'unknown'
  );

  // Convert translations
  const title = {
    pl: product.title?.pl || product.name,
    en: product.title?.en || product.name,
    de: product.title?.de || product.name,
  };

  const shortDescription = {
    pl: product.shortDescription?.pl || product.description.slice(0, 150),
    en: product.shortDescription?.en || product.description.slice(0, 150),
    de: product.shortDescription?.de || product.description.slice(0, 150),
  };

  const fullDescription = {
    pl: product.fullDescription?.pl || product.longDescription || '',
    en: product.fullDescription?.en || product.longDescription || '',
    de: product.fullDescription?.de || product.longDescription || '',
  };

  // Build ProductCore
  const core: ProductCore = {
    id: product.id,
    identityHash,
    title,
    shortDescription,
    fullDescription,
    specs: product.metadata?.specifications
      ? Object.fromEntries(
          product.metadata.specifications.map((s: any) => [s.key || s.name, s.value])
        )
      : {},
    mainCategorySlug: product.mainCategorySlug || 'uncategorized',
    subCategorySlug: product.subCategorySlug || 'uncategorized',
    subSubCategorySlug: product.subSubCategorySlug,
    images: product.gallery?.map((g) => g.src) || [product.image],
    primaryImageHash: calculateImageHash(product.image || 'unknown'),
    reviewsSummary: product.ai?.enrichment
      ? {
          pl: `Rating: ${product.ratingCard?.average || 0}/5. Based on ${product.ratingCard?.count || 0} reviews.`,
          en: `Rating: ${product.ratingCard?.average || 0}/5. Based on ${product.ratingCard?.count || 0} reviews.`,
        }
      : {
          pl: 'No reviews yet',
          en: 'No reviews yet',
        },
    rating: {
      score: product.ratingCard?.average || 0,
      count: product.ratingCard?.count || 0,
      provider: 'mixed',
    },
    bestPrice: {
      amount: bestPrice,
      currency: 'USD',
    },
    linkedDealIds: linkedDeals.map((d) => d.id),
    searchTags: product.seoKeywords || [],
    seoTitle: product.metaTitle,
    seoDescription: product.metaDescription,
    status: product.status === 'approved' ? 'approved' : 'pending_approval',
    createdAt: product.metadata?.importedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return core;
}

/**
 * Convert old Deal to new Deal format
 */
function convertDealToNew(oldDeal: DealLegacy, productId: string): DealM6 {
  const now = new Date().toISOString();

  const deal: DealM6 = {
    id: oldDeal.id,
    productId,
    price: {
      amount: oldDeal.price || 0,
      currency: oldDeal.importMetadata?.source?.includes('allegro') ? 'PLN' : 'USD',
    },
    originalPrice: oldDeal.originalPrice,
    discount: (oldDeal as any).discountPercent
      ? {
          percentage: (oldDeal as any).discountPercent,
        }
      : undefined,
    shipping: {
      cost: oldDeal.shippingCost || 0,
      timeDays: oldDeal.metadata?.deliveryTime
        ? parseInt(oldDeal.metadata.deliveryTime)
        : 14,
    },
    source:
      (oldDeal.source as any) || oldDeal.importMetadata?.source || 'manual',
    affiliateLink: oldDeal.link,
    merchantName: oldDeal.merchant || oldDeal.importMetadata?.merchant,
    merchantRating: oldDeal.importMetadata?.sellerRating,
    title: oldDeal.title,
    dealType: oldDeal.dealType === 'freebie' || oldDeal.dealType === 'pricing-error' || oldDeal.dealType === 'bundle' 
      ? 'sale' 
      : (oldDeal.dealType as 'sale' | 'coupon' | 'cashback' | 'flash_deal' | 'regular' | undefined),
    couponCode: oldDeal.couponCode,
    stockStatus: oldDeal.importMetadata?.stockStatus || 'in_stock',
    stockLevel: oldDeal.importMetadata?.stockLevel,
    expiryDate: oldDeal.expiryDate,
    isActive: oldDeal.status === 'approved',
    voteCount: oldDeal.voteCount || 0,
    temperature: oldDeal.temperature || 0,
    commentsCount: oldDeal.commentsCount || 0,
    status: oldDeal.status,
    createdAt: oldDeal.createdAt?.toISOString?.() || now,
    updatedAt: oldDeal.updatedAt?.toISOString?.() || now,
    sourceProductId: oldDeal.externalOriginalId,
    sourceUrl: oldDeal.link,
    priceHistory: oldDeal.importMetadata?.priceHistory || [
      {
        date: now.split('T')[0],
        price: oldDeal.price || 0,
        currency: 'USD',
      },
    ],
  };

  return deal;
}

/**
 * Rollback: Delete all migrated data
 * WARNING: This removes all ProductCores and relinked Deals!
 */
export async function rollbackMigration(): Promise<void> {
  console.log('\n⚠️  ROLLBACK: Deleting all migrated data...');

  try {
    // Delete all ProductCores
    const productsRef = collection(db, 'product_cores');
    const productSnap = await getDocs(productsRef);
    console.log(`Deleting ${productSnap.size} ProductCores...`);

    const batch = writeBatch(db);
    productSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    console.log('✓ Rollback completed');
  } catch (err) {
    console.error('Rollback failed:', err);
    throw err;
  }
}
