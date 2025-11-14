/**
 * Dynamic Alert System - Type Definitions
 * 
 * Models for price alerts and user notifications.
 * Used by M6 Price Monitoring feature.
 * 
 * @module models/alerts
 */

/**
 * Alert profile/configuration for a product
 * 
 * Defines when and how users should be notified about price changes.
 */
export interface AlertProfile {
  /** Firestore document ID */
  id?: string;
  
  /** Product this alert is for */
  productId: string;
  
  /** Target price that triggers alert */
  targetPrice: number;
  
  /** Currency code */
  currency: string;
  
  /** Alert condition type */
  condition: 'below' | 'above' | 'drops_by_percent' | 'any_change';
  
  /** Percentage threshold for 'drops_by_percent' condition */
  percentThreshold?: number;
  
  /** Whether this alert is active */
  active: boolean;
  
  /** When alert was created (ISO string) */
  createdAt: string;
  
  /** When alert will expire (ISO string, optional) */
  expiresAt?: string;
  
  /** Number of times this alert has been triggered */
  triggerCount: number;
  
  /** Last time alert was triggered (ISO string) */
  lastTriggeredAt?: string;
}

/**
 * User's subscription to a price alert
 */
export interface UserAlert {
  /** Firestore document ID */
  id?: string;
  
  /** User who created this alert */
  userId: string;
  
  /** Product being monitored */
  productId: string;
  
  /** Alert configuration */
  alertProfile: AlertProfile;
  
  /** Notification channels to use */
  channels: Array<'email' | 'web_push' | 'in_app'>;
  
  /** Whether user has confirmed their email (for email alerts) */
  emailConfirmed?: boolean;
  
  /** Whether user wants daily digest instead of instant notifications */
  dailyDigest?: boolean;
  
  /** User's custom note for this alert */
  notes?: string;
  
  /** When alert subscription was created (ISO string) */
  createdAt: string;
  
  /** When subscription was last updated (ISO string) */
  updatedAt: string;
}

/**
 * Record of a notification sent to a user
 */
export interface NotificationRecord {
  /** Firestore document ID */
  id?: string;
  
  /** User who received notification */
  userId: string;
  
  /** Alert that triggered this notification */
  alertId: string;
  
  /** Product related to this notification */
  productId: string;
  
  /** Notification type */
  type: 'price_drop' | 'price_target_met' | 'back_in_stock' | 'price_increase';
  
  /** Channel used for notification */
  channel: 'email' | 'web_push' | 'in_app';
  
  /** Old price (before change) */
  oldPrice: number;
  
  /** New price (after change) */
  newPrice: number;
  
  /** Currency code */
  currency: string;
  
  /** When notification was created (ISO string) */
  createdAt: string;
  
  /** When notification was sent (ISO string) */
  sentAt?: string;
  
  /** Whether notification was successfully delivered */
  delivered: boolean;
  
  /** Delivery error if failed */
  deliveryError?: string;
  
  /** When user read/acknowledged notification (ISO string) */
  readAt?: string;
}

/**
 * Configuration for notification channels
 */
export interface NotificationConfig {
  /** Email provider settings */
  email?: {
    enabled: boolean;
    provider: 'sendgrid' | 'ses' | 'smtp';
    fromAddress: string;
    templates?: {
      priceDropTemplate?: string;
      backInStockTemplate?: string;
    };
  };
  
  /** Web push notification settings */
  webPush?: {
    enabled: boolean;
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
  };
  
  /** In-app notification settings */
  inApp?: {
    enabled: boolean;
    maxNotifications?: number; // Max to keep per user
  };
}

/**
 * Statistics about alert system
 */
export interface AlertSystemStats {
  /** Total active alerts */
  totalActiveAlerts: number;
  
  /** Alerts triggered in last 24h */
  alertsTriggeredToday: number;
  
  /** Notifications sent in last 24h */
  notificationsSentToday: number;
  
  /** Failed notifications in last 24h */
  failedNotificationsToday: number;
  
  /** Average response time for alert checking (ms) */
  avgCheckTimeMs: number;
  
  /** Last time stats were updated (ISO string) */
  updatedAt: string;
}

// =============================================================================
// Firestore Helper Functions (Stubs)
// =============================================================================

/**
 * Create a new user alert subscription
 * 
 * @param alert - Alert data to save
 * @returns Promise resolving to alert ID
 * 
 * TODO M6: Implement actual Firestore write
 */
export async function createUserAlert(alert: Omit<UserAlert, 'id'>): Promise<string> {
  // TODO M6: Implement Firestore write to collection 'userAlerts'
  // const db = getFirestore();
  // const docRef = await addDoc(collection(db, 'userAlerts'), alert);
  // return docRef.id;
  
  console.log('[STUB] createUserAlert:', alert.userId, alert.productId);
  return Promise.resolve(`alert_${Date.now()}`);
}

/**
 * Get all active alerts for a user
 * 
 * @param userId - User to get alerts for
 * @returns Promise resolving to array of alerts
 * 
 * TODO M6: Implement actual Firestore query
 */
export async function getUserAlerts(userId: string): Promise<UserAlert[]> {
  // TODO M6: Implement Firestore query
  // const db = getFirestore();
  // const q = query(
  //   collection(db, 'userAlerts'),
  //   where('userId', '==', userId),
  //   where('alertProfile.active', '==', true)
  // );
  // const snapshot = await getDocs(q);
  // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAlert));
  
  console.log('[STUB] getUserAlerts:', userId);
  return Promise.resolve([]);
}

/**
 * Get all active alerts for a product
 * 
 * @param productId - Product to get alerts for
 * @returns Promise resolving to array of alerts
 * 
 * TODO M6: Implement actual Firestore query
 */
export async function getProductAlerts(productId: string): Promise<UserAlert[]> {
  // TODO M6: Implement Firestore query
  // const db = getFirestore();
  // const q = query(
  //   collection(db, 'userAlerts'),
  //   where('productId', '==', productId),
  //   where('alertProfile.active', '==', true)
  // );
  // const snapshot = await getDocs(q);
  // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAlert));
  
  console.log('[STUB] getProductAlerts:', productId);
  return Promise.resolve([]);
}

/**
 * Update an existing alert
 * 
 * @param alertId - Alert to update
 * @param updates - Fields to update
 * @returns Promise resolving when saved
 * 
 * TODO M6: Implement actual Firestore update
 */
export async function updateUserAlert(
  alertId: string,
  updates: Partial<UserAlert>
): Promise<void> {
  // TODO M6: Implement Firestore update
  // const db = getFirestore();
  // await updateDoc(doc(db, 'userAlerts', alertId), updates);
  
  console.log('[STUB] updateUserAlert:', alertId, updates);
  return Promise.resolve();
}

/**
 * Delete an alert
 * 
 * @param alertId - Alert to delete
 * @returns Promise resolving when deleted
 * 
 * TODO M6: Implement actual Firestore delete
 */
export async function deleteUserAlert(alertId: string): Promise<void> {
  // TODO M6: Implement Firestore delete
  // const db = getFirestore();
  // await deleteDoc(doc(db, 'userAlerts', alertId));
  
  console.log('[STUB] deleteUserAlert:', alertId);
  return Promise.resolve();
}

/**
 * Create a notification record
 * 
 * @param notification - Notification data to save
 * @returns Promise resolving to notification ID
 * 
 * TODO M6: Implement actual Firestore write
 */
export async function createNotificationRecord(
  notification: Omit<NotificationRecord, 'id'>
): Promise<string> {
  // TODO M6: Implement Firestore write to collection 'notificationRecords'
  // const db = getFirestore();
  // const docRef = await addDoc(collection(db, 'notificationRecords'), notification);
  // return docRef.id;
  
  console.log('[STUB] createNotificationRecord:', notification.userId, notification.type);
  return Promise.resolve(`notification_${Date.now()}`);
}

/**
 * Get recent notifications for a user
 * 
 * @param userId - User to get notifications for
 * @param limit - Maximum number to return
 * @returns Promise resolving to array of notifications
 * 
 * TODO M6: Implement actual Firestore query
 */
export async function getUserNotifications(
  userId: string,
  limit = 50
): Promise<NotificationRecord[]> {
  // TODO M6: Implement Firestore query
  // const db = getFirestore();
  // const q = query(
  //   collection(db, 'notificationRecords'),
  //   where('userId', '==', userId),
  //   orderBy('createdAt', 'desc'),
  //   limit(limit)
  // );
  // const snapshot = await getDocs(q);
  // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationRecord));
  
  console.log('[STUB] getUserNotifications:', userId, limit);
  return Promise.resolve([]);
}
