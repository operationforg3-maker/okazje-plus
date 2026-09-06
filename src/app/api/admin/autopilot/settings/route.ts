import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const SETTINGS_DOC_PATH = 'admin_meta/aliexpress-autopilot-settings';

export type AliExpressAutopilotSettings = {
  enabled: boolean;
  ensureProfiles: boolean;
  autoApprove: boolean;
  maxProfilesPerRun: number;
  maxItemsPerProfile: number;
  hardCap: number;
  pageSize: number;
  maxPages: number;
  defaultProfileMaxItems: number;
  // Hot Stream
  hotStreamEnabled: boolean;
  hotStreamGlobalLimit: number;
  hotStreamPerCategoryLimit: number;
  // Super Deals
  superDealsEnabled: boolean;
  superDealsMaxPromos: number;
  updatedAt?: string;
  updatedBy?: string;
};

const DEFAULT_SETTINGS: AliExpressAutopilotSettings = {
  enabled: true,
  ensureProfiles: false,
  autoApprove: true,
  maxProfilesPerRun: 3,
  maxItemsPerProfile: 20,
  hardCap: 5000,
  pageSize: 50,
  maxPages: 100,
  defaultProfileMaxItems: 20,
  // Hot Stream
  hotStreamEnabled: false,
  hotStreamGlobalLimit: 50,
  hotStreamPerCategoryLimit: 10,
  // Super Deals
  superDealsEnabled: true,
  superDealsMaxPromos: 2,
};

function normalizeNumeric(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeSettings(input: Partial<AliExpressAutopilotSettings>): AliExpressAutopilotSettings {
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_SETTINGS.enabled,
    ensureProfiles: typeof input.ensureProfiles === 'boolean' ? input.ensureProfiles : DEFAULT_SETTINGS.ensureProfiles,
    autoApprove: typeof input.autoApprove === 'boolean' ? input.autoApprove : DEFAULT_SETTINGS.autoApprove,
    maxProfilesPerRun: normalizeNumeric(input.maxProfilesPerRun, DEFAULT_SETTINGS.maxProfilesPerRun, 1, 25),
    maxItemsPerProfile: normalizeNumeric(input.maxItemsPerProfile, DEFAULT_SETTINGS.maxItemsPerProfile, 5, 20000),
    hardCap: normalizeNumeric(input.hardCap, DEFAULT_SETTINGS.hardCap, 100, 50000),
    pageSize: normalizeNumeric(input.pageSize, DEFAULT_SETTINGS.pageSize, 10, 50),
    maxPages: normalizeNumeric(input.maxPages, DEFAULT_SETTINGS.maxPages, 1, 1000),
    defaultProfileMaxItems: normalizeNumeric(input.defaultProfileMaxItems, DEFAULT_SETTINGS.defaultProfileMaxItems, 10, 5000),
    // Hot Stream
    hotStreamEnabled: typeof input.hotStreamEnabled === 'boolean' ? input.hotStreamEnabled : DEFAULT_SETTINGS.hotStreamEnabled,
    hotStreamGlobalLimit: normalizeNumeric(input.hotStreamGlobalLimit, DEFAULT_SETTINGS.hotStreamGlobalLimit, 0, 500),
    hotStreamPerCategoryLimit: normalizeNumeric(input.hotStreamPerCategoryLimit, DEFAULT_SETTINGS.hotStreamPerCategoryLimit, 0, 500),
    // Super Deals
    superDealsEnabled: typeof input.superDealsEnabled === 'boolean' ? input.superDealsEnabled : DEFAULT_SETTINGS.superDealsEnabled,
    superDealsMaxPromos: normalizeNumeric(input.superDealsMaxPromos, DEFAULT_SETTINGS.superDealsMaxPromos, 1, 10),
  };
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const snap = await adminDb.doc(SETTINGS_DOC_PATH).get();
    const raw = snap.exists ? (snap.data() as Partial<AliExpressAutopilotSettings>) : {};
    const settings = normalizeSettings(raw);

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        updatedAt: raw.updatedAt,
        updatedBy: raw.updatedBy,
      },
    });
  } catch (error) {
    logger.error('Failed to load autopilot settings', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load settings',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<AliExpressAutopilotSettings>;
    const settings = normalizeSettings(body);

    const payload: AliExpressAutopilotSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: session.uid,
    };

    await adminDb.doc(SETTINGS_DOC_PATH).set(payload, { merge: true });

    return NextResponse.json({
      success: true,
      settings: payload,
      message: 'Ustawienia autopilota zapisane.',
    });
  } catch (error) {
    logger.error('Failed to save autopilot settings', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save settings',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
