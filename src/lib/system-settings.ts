import { adminDb } from '@/lib/firebase-admin';

export interface AutomationSettings {
  masterSwitchEnabled: boolean;
  autopilotEnabled: boolean;
  harvesterEnabled: boolean;
  priceMonitorEnabled: boolean;
  seoCleanerEnabled: boolean;
  weeklyDigestEnabled: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  masterSwitchEnabled: false, // Default to disabled to save costs until manually turned on
  autopilotEnabled: false,
  harvesterEnabled: false,
  priceMonitorEnabled: false,
  seoCleanerEnabled: false,
  weeklyDigestEnabled: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Retrieves current automation settings from Firestore (Server-side using adminDb).
 */
export async function getAutomationSettings(): Promise<AutomationSettings> {
  try {
    const docRef = adminDb.collection('system_settings').doc('automation');
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return DEFAULT_AUTOMATION_SETTINGS;
    }

    const data = docSnap.data();
    return {
      ...DEFAULT_AUTOMATION_SETTINGS,
      ...data,
    };
  } catch (error) {
    console.error('[SystemSettings] Error fetching automation settings:', error);
    // If error reading settings, fail-safe to FALSE to avoid unintended costs
    return DEFAULT_AUTOMATION_SETTINGS;
  }
}

/**
 * Updates automation settings in Firestore (Server-side).
 */
export async function updateAutomationSettings(
  partialSettings: Partial<AutomationSettings>,
  userId?: string
): Promise<AutomationSettings> {
  const current = await getAutomationSettings();
  const updated: AutomationSettings = {
    ...current,
    ...partialSettings,
    updatedAt: new Date().toISOString(),
    ...(userId ? { updatedBy: userId } : {}),
  };

  const docRef = adminDb.collection('system_settings').doc('automation');
  await docRef.set(updated, { merge: true });

  return updated;
}

/**
 * Checks if background processing is allowed for a given subsystem (or master switch).
 */
export async function isBackgroundProcessingEnabled(
  subsystem?: keyof Omit<AutomationSettings, 'masterSwitchEnabled' | 'updatedAt' | 'updatedBy'>
): Promise<boolean> {
  const settings = await getAutomationSettings();
  if (!settings.masterSwitchEnabled) {
    return false;
  }
  if (subsystem && settings[subsystem] === false) {
    return false;
  }
  return true;
}
