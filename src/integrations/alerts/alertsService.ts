/**
 * Alerts Service
 * 
 * Core logic for managing price alerts and checking alert conditions.
 * 
 * @module integrations/alerts/alertsService
 */

import {
  UserAlert,
  AlertProfile,
  NotificationRecord,
  createUserAlert,
  getUserAlerts,
  getProductAlerts,
  updateUserAlert,
  deleteUserAlert,
  createNotificationRecord,
} from '@/lib/models/alerts';
import { PriceSnapshot, getPriceHistoryRecord } from '@/lib/models/priceHistory';
import { createAlertLogger, logAlertStats, logError } from '@/lib/logger';
import { notifyUser } from './notificationChannels';

/**
 * Create a new price alert for a user
 * 
 * @param userId - User creating the alert
 * @param productId - Product to monitor
 * @param targetPrice - Target price that triggers alert
 * @param condition - Alert condition type
 * @param channels - Notification channels to use
 * @returns Promise resolving to alert ID
 * 
 * @example
 * ```typescript
 * const alertId = await createAlert(
 *   'user_123',
 *   'prod_456',
 *   89.99,
 *   'below',
 *   ['email', 'in_app']
 * );
 * ```
 */
export async function createAlert(
  userId: string,
  productId: string,
  targetPrice: number,
  condition: AlertProfile['condition'] = 'below',
  channels: UserAlert['channels'] = ['in_app']
): Promise<string> {
  const logger = createAlertLogger();
  
  logger.info('Creating price alert', {
    userId,
    productId,
    targetPrice,
    condition,
  });
  
  try {
    const now = new Date().toISOString();
    
    const alertProfile: AlertProfile = {
      productId,
      targetPrice,
      currency: 'PLN',
      condition,
      active: true,
      createdAt: now,
      triggerCount: 0,
    };
    
    const userAlert: Omit<UserAlert, 'id'> = {
      userId,
      productId,
      alertProfile,
      channels,
      emailConfirmed: false, // TODO M6: Implement email confirmation
      dailyDigest: false,
      createdAt: now,
      updatedAt: now,
    };
    
    const alertId = await createUserAlert(userAlert);
    
    logger.info('Alert created successfully', { alertId });
    
    return alertId;
    
  } catch (error) {
    logError(logger, error, { userId, productId });
    throw error;
  }
}

/**
 * Check alerts for a specific product after price change
 * 
 * This is called after a new price snapshot is created.
 * Checks all active alerts for the product and triggers notifications if conditions are met.
 * 
 * @param productId - Product to check alerts for
 * @param newSnapshot - New price snapshot that was just created
 * @returns Promise resolving to number of alerts triggered
 */
export async function checkAlertsForProduct(
  productId: string,
  newSnapshot: PriceSnapshot
): Promise<number> {
  const logger = createAlertLogger();
  const startTime = Date.now();
  
  logger.info('Checking alerts for product', { productId });
  
  let alertsChecked = 0;
  let alertsTriggered = 0;
  let notificationsSent = 0;
  let errors = 0;
  
  try {
    // Get all active alerts for this product
    const alerts = await getProductAlerts(productId);
    alertsChecked = alerts.length;
    
    logger.debug(`Found ${alertsChecked} active alerts`, { productId });
    
    // Get price history for context
    const priceHistory = await getPriceHistoryRecord(productId);
    
    // Check each alert
    for (const alert of alerts) {
      try {
        const shouldTrigger = evaluateAlertCondition(
          alert.alertProfile,
          newSnapshot,
          priceHistory
        );
        
        if (shouldTrigger) {
          logger.info('Alert condition met', {
            alertId: alert.id,
            userId: alert.userId,
            condition: alert.alertProfile.condition,
            targetPrice: alert.alertProfile.targetPrice,
            actualPrice: newSnapshot.price,
          });
          
          alertsTriggered++;
          
          // Send notification
          const notified = await notifyUser(
            alert.userId,
            alert,
            newSnapshot,
            priceHistory?.currentPrice
          );
          
          if (notified) {
            notificationsSent++;
          }
          
          // Update alert trigger count
          const now = new Date().toISOString();
          await updateUserAlert(alert.id!, {
            alertProfile: {
              ...alert.alertProfile,
              triggerCount: alert.alertProfile.triggerCount + 1,
              lastTriggeredAt: now,
            },
            updatedAt: now,
          });
        }
        
      } catch (error) {
        logError(logger, error, { alertId: alert.id, productId });
        errors++;
      }
    }
    
  } catch (error) {
    logError(logger, error, { productId });
    errors++;
  }
  
  const durationMs = Date.now() - startTime;
  
  logAlertStats(logger, {
    checked: alertsChecked,
    triggered: alertsTriggered,
    notified: notificationsSent,
    errors,
    durationMs,
  });
  
  return alertsTriggered;
}

/**
 * Evaluate if an alert condition is met
 * 
 * @param alertProfile - Alert configuration
 * @param newSnapshot - New price snapshot
 * @param priceHistory - Current price history (for context)
 * @returns True if alert should be triggered
 */
function evaluateAlertCondition(
  alertProfile: AlertProfile,
  newSnapshot: PriceSnapshot,
  priceHistory: any | null
): boolean {
  const { condition, targetPrice, percentThreshold } = alertProfile;
  const currentPrice = newSnapshot.price;
  
  switch (condition) {
    case 'below':
      // Trigger if current price is below target
      return currentPrice < targetPrice;
      
    case 'above':
      // Trigger if current price is above target
      return currentPrice > targetPrice;
      
    case 'drops_by_percent':
      // Trigger if price dropped by specified percentage
      if (!priceHistory || !percentThreshold) {
        return false;
      }
      const oldPrice = priceHistory.currentPrice;
      const dropPercent = ((oldPrice - currentPrice) / oldPrice) * 100;
      return dropPercent >= percentThreshold;
      
    case 'any_change':
      // Trigger on any price change
      if (!priceHistory) {
        return false;
      }
      return currentPrice !== priceHistory.currentPrice;
      
    default:
      return false;
  }
}

/**
 * Get all alerts for a user
 * 
 * @param userId - User to get alerts for
 * @returns Promise resolving to array of alerts
 */
export async function getUserAlertsService(userId: string): Promise<UserAlert[]> {
  const logger = createAlertLogger();
  
  logger.debug('Getting user alerts', { userId });
  
  try {
    const alerts = await getUserAlerts(userId);
    
    logger.debug(`Found ${alerts.length} alerts for user`, { userId });
    
    return alerts;
    
  } catch (error) {
    logError(logger, error, { userId });
    throw error;
  }
}

/**
 * Update an existing alert
 * 
 * @param alertId - Alert to update
 * @param updates - Fields to update
 * @returns Promise resolving when updated
 */
export async function updateAlertService(
  alertId: string,
  updates: Partial<UserAlert>
): Promise<void> {
  const logger = createAlertLogger(alertId);
  
  logger.info('Updating alert', { alertId, updates });
  
  try {
    await updateUserAlert(alertId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    
    logger.info('Alert updated successfully', { alertId });
    
  } catch (error) {
    logError(logger, error, { alertId });
    throw error;
  }
}

/**
 * Cancel/delete an alert
 * 
 * @param alertId - Alert to cancel
 * @returns Promise resolving when deleted
 */
export async function cancelAlert(alertId: string): Promise<void> {
  const logger = createAlertLogger(alertId);
  
  logger.info('Canceling alert', { alertId });
  
  try {
    await deleteUserAlert(alertId);
    
    logger.info('Alert canceled successfully', { alertId });
    
  } catch (error) {
    logError(logger, error, { alertId });
    throw error;
  }
}

/**
 * Deactivate an alert without deleting it
 * 
 * @param alertId - Alert to deactivate
 * @returns Promise resolving when deactivated
 */
export async function deactivateAlert(alertId: string): Promise<void> {
  const logger = createAlertLogger(alertId);
  
  logger.info('Deactivating alert', { alertId });
  
  try {
    // Get current alert
    // TODO M6: Implement get single alert function
    // For now, just update with active = false
    await updateUserAlert(alertId, {
      alertProfile: {
        active: false,
      } as any, // Type assertion for stub
      updatedAt: new Date().toISOString(),
    });
    
    logger.info('Alert deactivated successfully', { alertId });
    
  } catch (error) {
    logError(logger, error, { alertId });
    throw error;
  }
}
