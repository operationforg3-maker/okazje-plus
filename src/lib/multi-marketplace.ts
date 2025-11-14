import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Marketplace,
  CategoryMapping,
  PriceComparison,
  MarketplacePrice,
  MultiSourceProduct,
  ProductSource,
  ReviewAggregation,
  ReviewSource,
} from '@/lib/types';

/**
 * Gets all enabled marketplaces
 */
export async function getEnabledMarketplaces(): Promise<Marketplace[]> {
  const marketplacesRef = collection(db, 'marketplaces');
  const q = query(marketplacesRef, where('enabled', '==', true), orderBy('name', 'asc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Marketplace));
}

/**
 * Gets a specific marketplace
 */
export async function getMarketplace(marketplaceId: string): Promise<Marketplace | null> {
  const marketplaceRef = doc(db, 'marketplaces', marketplaceId);
  const marketplaceDoc = await getDoc(marketplaceRef);

  if (!marketplaceDoc.exists()) {
    return null;
  }

  return { id: marketplaceDoc.id, ...marketplaceDoc.data() } as Marketplace;
}

/**
 * Creates or updates a marketplace
 */
export async function upsertMarketplace(
  marketplaceData: Omit<Marketplace, 'id' | 'createdAt'>
): Promise<string> {
  const marketplaceRef = doc(db, 'marketplaces', marketplaceData.slug);
  const existing = await getDoc(marketplaceRef);

  if (existing.exists()) {
    await updateDoc(marketplaceRef, {
      ...marketplaceData,
      updatedAt: new Date().toISOString(),
    });
    return marketplaceRef.id;
  } else {
    const newMarketplace = {
      ...marketplaceData,
      createdAt: new Date().toISOString(),
    };
    await setDoc(marketplaceRef, newMarketplace);
    return marketplaceRef.id;
  }
}

/**
 * Gets category mapping for a platform category
 */
export async function getCategoryMapping(
  mainSlug: string,
  subSlug: string,
  marketplaceId: string
): Promise<CategoryMapping | null> {
  const mappingsRef = collection(db, 'category_mappings');
  const q = query(
    mappingsRef,
    where('platformCategory.mainSlug', '==', mainSlug),
    where('platformCategory.subSlug', '==', subSlug),
    where('marketplaceId', '==', marketplaceId),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CategoryMapping;
}

/**
 * Creates a category mapping
 */
export async function createCategoryMapping(
  platformCategory: { mainSlug: string; subSlug?: string; subSubSlug?: string },
  marketplaceId: string,
  marketplaceCategory: { id: string; name: string; path?: string[] },
  confidence: number = 1.0,
  verified: boolean = false
): Promise<string> {
  const mapping: Omit<CategoryMapping, 'id'> = {
    platformCategory,
    marketplaceId,
    marketplaceCategory,
    confidence,
    verified,
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, 'category_mappings'), mapping);
  return docRef.id;
}

/**
 * Gets all mappings for a marketplace
 */
export async function getMarketplaceMappings(marketplaceId: string): Promise<CategoryMapping[]> {
  const mappingsRef = collection(db, 'category_mappings');
  const q = query(mappingsRef, where('marketplaceId', '==', marketplaceId));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CategoryMapping));
}

/**
 * Aggregates prices from multiple marketplaces for a product
 */
export async function aggregateProductPrices(
  canonicalProductId: string,
  productName: string,
  canonicalImage: string,
  sources: ProductSource[]
): Promise<string> {
  const prices: MarketplacePrice[] = [];
  let lowestPrice = Infinity;
  let highestPrice = 0;

  for (const source of sources) {
    const marketplace = await getMarketplace(source.marketplaceId);
    if (!marketplace) continue;

    const price: MarketplacePrice = {
      marketplaceId: source.marketplaceId,
      marketplaceName: marketplace.name,
      productId: source.productId,
      price: source.price,
      currency: marketplace.currency,
      inStock: source.inStock,
      rating: source.rating,
      reviewCount: source.reviewCount,
      url: source.url,
      lastChecked: source.lastSynced,
    };

    prices.push(price);
    lowestPrice = Math.min(lowestPrice, source.price);
    highestPrice = Math.max(highestPrice, source.price);
  }

  const averagePrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
  const priceSpread = highestPrice - lowestPrice;

  const comparison: Omit<PriceComparison, 'id'> = {
    productName,
    canonicalImage,
    prices,
    lowestPrice,
    highestPrice,
    averagePrice,
    priceSpread,
    lastUpdated: new Date().toISOString(),
  };

  const comparisonRef = doc(db, 'price_comparisons', canonicalProductId);
  await setDoc(comparisonRef, comparison);

  return canonicalProductId;
}

/**
 * Gets price comparison for a product
 */
export async function getPriceComparison(productId: string): Promise<PriceComparison | null> {
  const comparisonRef = doc(db, 'price_comparisons', productId);
  const comparisonDoc = await getDoc(comparisonRef);

  if (!comparisonDoc.exists()) {
    return null;
  }

  return { id: comparisonDoc.id, ...comparisonDoc.data() } as PriceComparison;
}

/**
 * Creates or updates a multi-source product
 */
export async function upsertMultiSourceProduct(
  productData: Omit<MultiSourceProduct, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const productId = `multi_${productData.canonicalName.toLowerCase().replace(/\s+/g, '_')}`;
  const productRef = doc(db, 'multi_source_products', productId);
  const existing = await getDoc(productRef);

  if (existing.exists()) {
    await updateDoc(productRef, {
      ...productData,
      updatedAt: new Date().toISOString(),
    });
    return productId;
  } else {
    const newProduct: Omit<MultiSourceProduct, 'id'> = {
      ...productData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(productRef, newProduct);
    return productId;
  }
}

/**
 * Gets a multi-source product
 */
export async function getMultiSourceProduct(productId: string): Promise<MultiSourceProduct | null> {
  const productRef = doc(db, 'multi_source_products', productId);
  const productDoc = await getDoc(productRef);

  if (!productDoc.exists()) {
    return null;
  }

  return { id: productDoc.id, ...productDoc.data() } as MultiSourceProduct;
}

/**
 * Finds products from multiple marketplaces by category
 */
export async function findMultiSourceProducts(
  mainCategorySlug: string,
  subCategorySlug?: string,
  limitCount: number = 20
): Promise<MultiSourceProduct[]> {
  const productsRef = collection(db, 'multi_source_products');
  let q = query(
    productsRef,
    where('category.mainSlug', '==', mainCategorySlug),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  );

  if (subCategorySlug) {
    q = query(
      productsRef,
      where('category.mainSlug', '==', mainCategorySlug),
      where('category.subSlug', '==', subCategorySlug),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MultiSourceProduct));
}

/**
 * Aggregates reviews from multiple sources
 */
export async function aggregateProductReviews(
  productId: string,
  sources: ReviewSource[]
): Promise<string> {
  const totalReviews = sources.reduce((sum, s) => sum + s.reviewCount, 0);
  const weightedRatingSum = sources.reduce((sum, s) => sum + s.averageRating * s.reviewCount, 0);
  const averageRating = totalReviews > 0 ? weightedRatingSum / totalReviews : 0;

  const aggregation: Omit<ReviewAggregation, 'id'> = {
    productId,
    totalReviews,
    averageRating,
    sources,
    lastAggregated: new Date().toISOString(),
  };

  const aggregationRef = doc(db, 'review_aggregations', productId);
  await setDoc(aggregationRef, aggregation);

  return productId;
}

/**
 * Gets review aggregation for a product
 */
export async function getReviewAggregation(productId: string): Promise<ReviewAggregation | null> {
  const aggregationRef = doc(db, 'review_aggregations', productId);
  const aggregationDoc = await getDoc(aggregationRef);

  if (!aggregationDoc.exists()) {
    return null;
  }

  return { id: aggregationDoc.id, ...aggregationDoc.data() } as ReviewAggregation;
}

/**
 * Syncs product from a marketplace
 * This is a stub that should be implemented per marketplace
 */
export async function syncProductFromMarketplace(
  marketplaceId: string,
  marketplaceProductId: string
): Promise<ProductSource | null> {
  const marketplace = await getMarketplace(marketplaceId);
  if (!marketplace || !marketplace.enabled) {
    return null;
  }

  // This would call the marketplace API to fetch product data
  // For now, return null as it's marketplace-specific
  console.log(`Syncing product ${marketplaceProductId} from ${marketplace.name}`);
  return null;
}

/**
 * Updates marketplace statistics
 */
export async function updateMarketplaceStats(
  marketplaceId: string,
  stats: Partial<Marketplace['stats']>
): Promise<void> {
  const marketplaceRef = doc(db, 'marketplaces', marketplaceId);
  await updateDoc(marketplaceRef, {
    'stats': stats,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Helper function to normalize product name for matching
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper function to calculate price difference percentage
 */
export function calculatePriceDifference(price1: number, price2: number): number {
  if (price2 === 0) return 0;
  return ((price1 - price2) / price2) * 100;
}

/**
 * Gets best offer across all marketplaces for a product
 */
export async function getBestOffer(productId: string): Promise<MarketplacePrice | null> {
  const comparison = await getPriceComparison(productId);
  if (!comparison || comparison.prices.length === 0) {
    return null;
  }

  // Find lowest price that's in stock
  const inStockPrices = comparison.prices.filter((p) => p.inStock);
  if (inStockPrices.length === 0) {
    return null;
  }

  return inStockPrices.reduce((best, current) => {
    const bestTotal = best.price + (best.shippingCost || 0);
    const currentTotal = current.price + (current.shippingCost || 0);
    return currentTotal < bestTotal ? current : best;
  });
}

/**
 * Searches price comparisons by product name
 */
export async function searchPriceComparisons(searchQuery: string): Promise<PriceComparison[]> {
  const comparisonsRef = collection(db, 'price_comparisons');
  
  // Firestore doesn't support full-text search, so we'll get all and filter client-side
  // For production, consider using Typesense or Algolia
  const snapshot = await getDocs(comparisonsRef);
  
  const allComparisons = snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as PriceComparison)
  );

  if (!searchQuery.trim()) {
    return allComparisons.slice(0, 20); // Return first 20 if no query
  }

  const query = searchQuery.toLowerCase();
  const filtered = allComparisons.filter((comparison) =>
    comparison.productName.toLowerCase().includes(query)
  );

  return filtered.slice(0, 20); // Return top 20 matches
}
