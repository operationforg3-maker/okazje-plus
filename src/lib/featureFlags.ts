/**
 * Feature Flags - Configuration Management
 * 
 * Centralized feature flag system for enabling/disabling features.
 * Reads from environment variables or Firestore config documents.
 * 
 * @module lib/featureFlags
 */

/**
 * Check if price monitoring feature is enabled
 * 
 * Checks NEXT_PUBLIC_PRICE_MONITORING_ENABLED environment variable first,
 * then falls back to Firestore config if needed.
 * 
 * @returns Promise resolving to boolean indicating if feature is enabled
 * 
 * Usage:
 * ```typescript
 * if (await isPriceMonitoringEnabled()) {
 *   // Execute price monitoring logic
 * }
 * ```
 */
export async function isPriceMonitoringEnabled(): Promise<boolean> {
  // Check environment variable first (highest priority)
  const envFlag = process.env.NEXT_PUBLIC_PRICE_MONITORING_ENABLED;
  
  if (envFlag !== undefined) {
    return envFlag === 'true' || envFlag === '1';
  }
  
  // TODO M6: Implement Firestore config lookup as fallback
  // const db = getFirestore();
  // const configDoc = await getDoc(doc(db, 'config', 'features'));
  // if (configDoc.exists()) {
  //   const data = configDoc.data();
  //   return data?.priceMonitoring?.enabled ?? false;
  // }
  
  // Default to disabled if no config found
  return false;
}

/**
 * Check if price alerts feature is enabled
 * 
 * @returns Promise resolving to boolean indicating if alerts are enabled
 */
export async function isPriceAlertsEnabled(): Promise<boolean> {
  const envFlag = process.env.NEXT_PUBLIC_PRICE_ALERTS_ENABLED;
  
  if (envFlag !== undefined) {
    return envFlag === 'true' || envFlag === '1';
  }
  
  // TODO M6: Implement Firestore config lookup
  return false;
}

/**
 * Check if price history UI should be shown
 * 
 * @returns Promise resolving to boolean indicating if UI is enabled
 */
export async function isPriceHistoryUIEnabled(): Promise<boolean> {
  const envFlag = process.env.NEXT_PUBLIC_PRICE_HISTORY_UI_ENABLED;
  
  if (envFlag !== undefined) {
    return envFlag === 'true' || envFlag === '1';
  }
  
  // TODO M6: Implement Firestore config lookup
  return false;
}

/**
 * Check if admin can manually trigger price snapshots
 * 
 * @returns Promise resolving to boolean indicating if manual triggers are allowed
 */
export async function isManualPriceSnapshotEnabled(): Promise<boolean> {
  const envFlag = process.env.NEXT_PUBLIC_MANUAL_PRICE_SNAPSHOT_ENABLED;
  
  if (envFlag !== undefined) {
    return envFlag === 'true' || envFlag === '1';
  }
  
  // TODO M6: Implement Firestore config lookup
  return false;
}

/**
 * Get price monitoring interval in hours
 * 
 * @returns Promise resolving to interval in hours (default: 24)
 */
export async function getPriceMonitoringInterval(): Promise<number> {
  const envInterval = process.env.PRICE_MONITORING_INTERVAL_HOURS;
  
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  
  // TODO M6: Implement Firestore config lookup
  
  // Default to 24 hours (daily)
  return 24;
}

/**
 * Check if dry-run mode is enabled (no actual DB writes)
 * 
 * @returns Promise resolving to boolean indicating if dry-run is enabled
 */
export async function isPriceMonitoringDryRun(): Promise<boolean> {
  const envFlag = process.env.PRICE_MONITORING_DRY_RUN;
  
  if (envFlag !== undefined) {
    return envFlag === 'true' || envFlag === '1';
  }
  
  // Default to dry-run (safe default)
  return true;
}

/**
 * Get notification channels configuration
 * 
 * @returns Promise resolving to configuration object
 */
export async function getNotificationChannelsConfig(): Promise<{
  email: boolean;
  webPush: boolean;
  inApp: boolean;
}> {
  return {
    email: process.env.NOTIFICATION_EMAIL_ENABLED === 'true',
    webPush: process.env.NOTIFICATION_WEB_PUSH_ENABLED === 'true',
    inApp: process.env.NOTIFICATION_IN_APP_ENABLED === 'true',
  };
}

/**
 * Feature flags configuration object
 * 
 * Can be used for synchronous access when flags have been pre-loaded.
 */
export interface FeatureFlagsConfig {
  priceMonitoring: {
    enabled: boolean;
    dryRun: boolean;
    intervalHours: number;
    manualTriggers: boolean;
  };
  priceAlerts: {
    enabled: boolean;
  };
  priceHistoryUI: {
    enabled: boolean;
  };
  notifications: {
    email: boolean;
    webPush: boolean;
    inApp: boolean;
  };
}

/**
 * Load all feature flags at once
 * 
 * Useful for caching or initializing configuration at startup.
 * 
 * @returns Promise resolving to complete feature flags configuration
 */
export async function loadFeatureFlags(): Promise<FeatureFlagsConfig> {
  const [
    priceMonitoringEnabled,
    priceMonitoringDryRun,
    priceMonitoringInterval,
    manualTriggersEnabled,
    priceAlertsEnabled,
    priceHistoryUIEnabled,
    notificationChannels,
  ] = await Promise.all([
    isPriceMonitoringEnabled(),
    isPriceMonitoringDryRun(),
    getPriceMonitoringInterval(),
    isManualPriceSnapshotEnabled(),
    isPriceAlertsEnabled(),
    isPriceHistoryUIEnabled(),
    getNotificationChannelsConfig(),
  ]);
  
  return {
    priceMonitoring: {
      enabled: priceMonitoringEnabled,
      dryRun: priceMonitoringDryRun,
      intervalHours: priceMonitoringInterval,
      manualTriggers: manualTriggersEnabled,
    },
    priceAlerts: {
      enabled: priceAlertsEnabled,
    },
    priceHistoryUI: {
      enabled: priceHistoryUIEnabled,
    },
    notifications: notificationChannels,
  };
}

/**
 * Check if any M6 feature is enabled
 * 
 * Useful for conditionally loading M6 modules.
 * 
 * @returns Promise resolving to boolean
 */
export async function isM6Enabled(): Promise<boolean> {
  const [monitoring, alerts, historyUI] = await Promise.all([
    isPriceMonitoringEnabled(),
    isPriceAlertsEnabled(),
    isPriceHistoryUIEnabled(),
  ]);
  
  return monitoring || alerts || historyUI;
}
