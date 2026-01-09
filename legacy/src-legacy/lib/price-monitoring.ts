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
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  PriceSnapshot,
  PriceHistory,
  PriceAlert,
  PriceChangeNotification,
} from '@/lib/types';

/**
 * Records a price snapshot for a product or deal
 */
export async function recordPriceSnapshot(
  itemId: string,
  itemType: 'product' | 'deal',
  price: number,
  options?: {
    originalPrice?: number;
    currency?: string;
    source?: string;
    availability?: 'in_stock' | 'out_of_stock' | 'low_stock' | 'unknown';
    metadata?: Record<string, any>;
  }
): Promise<string> {
  const snapshot: Omit<PriceSnapshot, 'id'> = {
    itemId,
    itemType,
    price,
    originalPrice: options?.originalPrice,
    currency: options?.currency || 'PLN',
    discountPercent: options?.originalPrice
      ? Math.round(((options.originalPrice - price) / options.originalPrice) * 100)
      : undefined,
    source: options?.source || 'manual',
    availability: options?.availability || 'unknown',
    timestamp: new Date().toISOString(),
    metadata: options?.metadata,
  };

  const docRef = await addDoc(collection(db, 'price_snapshots'), snapshot);
  
  // Update price history
  await updatePriceHistory(itemId, itemType, price);
  
  return docRef.id;
}

/**
 * Updates the price history for an item
 */
async function updatePriceHistory(
  itemId: string,
  itemType: 'product' | 'deal',
  currentPrice: number
): Promise<void> {
  const historyRef = doc(db, 'price_histories', itemId);
  const historyDoc = await getDoc(historyRef);

  if (historyDoc.exists()) {
    const history = historyDoc.data() as PriceHistory;
    const updates: Partial<PriceHistory> = {
      currentPrice,
      lowestPrice: Math.min(history.lowestPrice, currentPrice),
      highestPrice: Math.max(history.highestPrice, currentPrice),
      lastUpdated: new Date().toISOString(),
    };

    if (currentPrice < history.currentPrice) {
      updates.priceDropCount = (history.priceDropCount || 0) + 1;
    }

    await updateDoc(historyRef, updates as any);
  } else {
    // Create new history
    const newHistory: Omit<PriceHistory, 'id'> = {
      itemId,
      itemType,
      currentPrice,
      lowestPrice: currentPrice,
      highestPrice: currentPrice,
      averagePrice: currentPrice,
      priceDropCount: 0,
      lastUpdated: new Date().toISOString(),
      snapshots: [],
    };
    await updateDoc(historyRef, newHistory as any);
  }
}

/**
 * Gets price history for an item
 */
export async function getPriceHistory(
  itemId: string
): Promise<PriceHistory | null> {
  const historyRef = doc(db, 'price_histories', itemId);
  const historyDoc = await getDoc(historyRef);

  if (!historyDoc.exists()) {
    return null;
  }

  return { id: historyDoc.id, ...historyDoc.data() } as PriceHistory;
}

/**
 * Gets recent price snapshots for an item
 */
export async function getPriceSnapshots(
  itemId: string,
  daysBack: number = 30
): Promise<PriceSnapshot[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const snapshotsRef = collection(db, 'price_snapshots');
  const q = query(
    snapshotsRef,
    where('itemId', '==', itemId),
    where('timestamp', '>=', cutoffDate.toISOString()),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PriceSnapshot));
}

/**
 * Creates a price alert for a user
 */
export async function createPriceAlert(
  userId: string,
  itemId: string,
  itemType: 'product' | 'deal',
  alertType: 'price_drop' | 'target_price' | 'back_in_stock' | 'coupon_expiry',
  options?: {
    targetPrice?: number;
    dropPercentage?: number;
    expiresAt?: string;
    metadata?: Record<string, any>;
  }
): Promise<string> {
  const alert: Omit<PriceAlert, 'id'> = {
    userId,
    itemId,
    itemType,
    alertType,
    targetPrice: options?.targetPrice,
    dropPercentage: options?.dropPercentage,
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: options?.expiresAt,
    notificationSent: false,
    metadata: options?.metadata,
  };

  const docRef = await addDoc(collection(db, 'price_alerts'), alert);
  return docRef.id;
}

/**
 * Gets active price alerts for a user
 */
export async function getUserPriceAlerts(userId: string): Promise<PriceAlert[]> {
  const alertsRef = collection(db, 'price_alerts');
  const q = query(
    alertsRef,
    where('userId', '==', userId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PriceAlert));
}

/**
 * Cancels a price alert
 */
export async function cancelPriceAlert(alertId: string): Promise<void> {
  const alertRef = doc(db, 'price_alerts', alertId);
  await updateDoc(alertRef, {
    status: 'cancelled',
  });
}

/**
 * Checks if any alerts should be triggered and creates notifications
 */
export async function checkPriceAlerts(
  itemId: string,
  newPrice: number
): Promise<void> {
  const alertsRef = collection(db, 'price_alerts');
  const q = query(
    alertsRef,
    where('itemId', '==', itemId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  const alerts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PriceAlert));

  for (const alert of alerts) {
    let shouldTrigger = false;

    if (alert.alertType === 'target_price' && alert.targetPrice) {
      shouldTrigger = newPrice <= alert.targetPrice;
    } else if (alert.alertType === 'price_drop' && alert.dropPercentage) {
      const currentPrice = alert.metadata?.currentPrice || 0;
      const dropPercent = ((currentPrice - newPrice) / currentPrice) * 100;
      shouldTrigger = dropPercent >= alert.dropPercentage;
    }

    if (shouldTrigger) {
      await triggerPriceAlert(alert.id, alert, newPrice);
    }
  }
}

/**
 * Triggers a price alert and creates a notification
 */
async function triggerPriceAlert(
  alertId: string,
  alert: PriceAlert,
  newPrice: number
): Promise<void> {
  // Update alert status
  const alertRef = doc(db, 'price_alerts', alertId);
  await updateDoc(alertRef, {
    status: 'triggered',
    triggeredAt: new Date().toISOString(),
    notificationSent: true,
  });

  // Create notification
  const notification: Omit<PriceChangeNotification, 'id'> = {
    alertId,
    userId: alert.userId,
    itemId: alert.itemId,
    itemType: alert.itemType,
    changeType: alert.alertType === 'target_price' ? 'target_reached' : 'price_drop',
    oldPrice: alert.metadata?.currentPrice || 0,
    newPrice,
    percentageChange: alert.metadata?.currentPrice
      ? Math.round(((alert.metadata.currentPrice - newPrice) / alert.metadata.currentPrice) * 100)
      : 0,
    message: `Cena spadła do ${newPrice} PLN!`,
    link: `/products/${alert.itemId}`,
    sentAt: new Date().toISOString(),
    read: false,
  };

  await addDoc(collection(db, 'price_change_notifications'), notification);
}

/**
 * Gets price change notifications for a user
 */
export async function getPriceChangeNotifications(
  userId: string,
  unreadOnly: boolean = false
): Promise<PriceChangeNotification[]> {
  const notificationsRef = collection(db, 'price_change_notifications');
  let q = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('sentAt', 'desc'),
    limit(50)
  );

  if (unreadOnly) {
    q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('sentAt', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PriceChangeNotification));
}

/**
 * Marks a price change notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'price_change_notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
  });
}
