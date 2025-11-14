/**
 * Price History Engine - Type Definitions
 * 
 * Models for tracking product price changes over time.
 * Used by M6 Price Monitoring feature.
 * 
 * @module models/priceHistory
 */

/**
 * Single price snapshot at a point in time
 */
export interface PriceSnapshot {
  /** Firestore document ID */
  id?: string;
  
  /** Product ID this snapshot belongs to */
  productId: string;
  
  /** Price in PLN (or other currency) */
  price: number;
  
  /** Currency code (e.g., 'PLN', 'EUR', 'USD') */
  currency: string;
  
  /** Original/regular price before discount (if applicable) */
  originalPrice?: number;
  
  /** Calculated discount percentage */
  discountPercent?: number;
  
  /** Timestamp when snapshot was taken (ISO string) */
  capturedAt: string;
  
  /** Data source (e.g., 'aliexpress', 'manual', 'api') */
  source: string;
  
  /** Whether product was in stock at capture time */
  inStock: boolean;
  
  /** Additional merchant/seller info if available */
  merchant?: string;
  
  /** Shipping cost at time of snapshot */
  shippingCost?: number;
  
  /** Raw data from external source (for debugging) */
  rawData?: Record<string, any>;
  
  /** Any errors encountered during capture */
  errors?: string[];
}

/**
 * Aggregated price history record for a product
 * 
 * Stores min/max/avg stats and references to individual snapshots.
 */
export interface PriceHistoryRecord {
  /** Firestore document ID (typically same as productId) */
  id?: string;
  
  /** Product this history belongs to */
  productId: string;
  
  /** Current/latest price */
  currentPrice: number;
  
  /** Lowest price ever recorded */
  lowestPrice: number;
  
  /** Highest price ever recorded */
  highestPrice: number;
  
  /** Average price across all snapshots */
  averagePrice: number;
  
  /** Date when lowest price was recorded (ISO string) */
  lowestPriceDate?: string;
  
  /** Date when highest price was recorded (ISO string) */
  highestPriceDate?: string;
  
  /** Total number of price snapshots */
  snapshotCount: number;
  
  /** When this record was first created (ISO string) */
  firstCapturedAt: string;
  
  /** When this record was last updated (ISO string) */
  lastUpdatedAt: string;
  
  /** IDs of recent snapshots (for quick access) */
  recentSnapshotIds?: string[];
  
  /** Price trend indicator */
  trend?: 'up' | 'down' | 'stable';
  
  /** Percentage change from previous snapshot */
  changePercent?: number;
}

/**
 * Configuration for price monitoring schedule
 */
export interface PriceMonitoringConfig {
  /** Whether price monitoring is enabled globally */
  enabled: boolean;
  
  /** How often to capture snapshots (in hours) */
  intervalHours: number;
  
  /** Products to exclude from monitoring */
  excludedProductIds?: string[];
  
  /** Maximum age of stale data before re-capture (in days) */
  maxStaleDays?: number;
  
  /** Whether to use dry-run mode (no DB writes) */
  dryRun: boolean;
}

/**
 * Result/stats from a snapshot operation
 */
export interface SnapshotResult {
  /** Operation completed successfully */
  ok: boolean;
  
  /** Whether this was a dry-run (no writes) */
  dryRun: boolean;
  
  /** Number of snapshots that would be created */
  wouldCreate: number;
  
  /** Number of snapshots that would be updated */
  wouldUpdate: number;
  
  /** Number of products processed */
  processed: number;
  
  /** Number of products skipped */
  skipped: number;
  
  /** Errors encountered */
  errors: Array<{
    productId: string;
    error: string;
  }>;
  
  /** Duration of operation in milliseconds */
  durationMs?: number;
}

// =============================================================================
// Firestore Helper Functions (Stubs)
// =============================================================================

/**
 * Create a new price snapshot in Firestore
 * 
 * @param snapshot - Snapshot data to save
 * @returns Promise resolving to snapshot ID
 * 
 * TODO M6: Implement actual Firestore write
 */
export async function createPriceSnapshot(snapshot: Omit<PriceSnapshot, 'id'>): Promise<string> {
  // TODO M6: Implement Firestore write to collection 'priceSnapshots'
  // const db = getFirestore();
  // const docRef = await addDoc(collection(db, 'priceSnapshots'), snapshot);
  // return docRef.id;
  
  console.log('[STUB] createPriceSnapshot:', snapshot.productId);
  return Promise.resolve(`snapshot_${Date.now()}`);
}

/**
 * Get price snapshots for a product
 * 
 * @param productId - Product to get snapshots for
 * @param limit - Maximum number of snapshots to return
 * @returns Promise resolving to array of snapshots
 * 
 * TODO M6: Implement actual Firestore read
 */
export async function getPriceSnapshots(
  productId: string,
  limit = 30
): Promise<PriceSnapshot[]> {
  // TODO M6: Implement Firestore query
  // const db = getFirestore();
  // const q = query(
  //   collection(db, 'priceSnapshots'),
  //   where('productId', '==', productId),
  //   orderBy('capturedAt', 'desc'),
  //   limit(limit)
  // );
  // const snapshot = await getDocs(q);
  // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceSnapshot));
  
  console.log('[STUB] getPriceSnapshots:', productId, limit);
  return Promise.resolve([]);
}

/**
 * Update or create price history record for a product
 * 
 * @param record - Price history data
 * @returns Promise resolving when saved
 * 
 * TODO M6: Implement actual Firestore write with merge
 */
export async function upsertPriceHistoryRecord(
  record: Omit<PriceHistoryRecord, 'id'>
): Promise<void> {
  // TODO M6: Implement Firestore write with merge
  // const db = getFirestore();
  // await setDoc(doc(db, 'priceHistory', record.productId), record, { merge: true });
  
  console.log('[STUB] upsertPriceHistoryRecord:', record.productId);
  return Promise.resolve();
}

/**
 * Get price history record for a product
 * 
 * @param productId - Product to get history for
 * @returns Promise resolving to history record or null
 * 
 * TODO M6: Implement actual Firestore read
 */
export async function getPriceHistoryRecord(
  productId: string
): Promise<PriceHistoryRecord | null> {
  // TODO M6: Implement Firestore read
  // const db = getFirestore();
  // const docRef = doc(db, 'priceHistory', productId);
  // const docSnap = await getDoc(docRef);
  // return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as PriceHistoryRecord : null;
  
  console.log('[STUB] getPriceHistoryRecord:', productId);
  return Promise.resolve(null);
}
