import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { SocialAIBot } from '@/lib/types';
import { executeBotRun } from '@/app/actions/social-ai-bots';
import { executeFishingAutopilotCycle } from '@/app/actions/fishing-autopilot';
import { executeBabyAutopilotCycle } from '@/app/actions/baby-autopilot';

export const dynamic = 'force-dynamic';

function getBearerToken(authHeader: string | null): string {
  if (!authHeader) return '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const providedSecret =
    request.nextUrl.searchParams.get('secret') ||
    request.headers.get('x-cron-secret') ||
    getBearerToken(request.headers.get('authorization'));

  const expectedSecrets = [
    process.env.CRON_SECRET,
    process.env.IMPORT_ADMIN_TOKEN,
    process.env.ADMIN_BEARER,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  if (expectedSecrets.length > 0) {
    return expectedSecrets.includes(String(providedSecret || '').trim());
  }

  // Allow in dev mode if no secrets set
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

function isBotDue(bot: SocialAIBot): boolean {
  if (!bot.enabled) return false;
  if (bot.schedule === 'manual') return false;

  if (!bot.lastRunAt) return true;

  const lastRunTime = new Date(bot.lastRunAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastRunTime) / (1000 * 60);

  switch (bot.schedule) {
    case 'hourly':
      return diffMinutes >= 50; // allow slight jitter
    case 'every_3_hours':
      return diffMinutes >= 160;
    case 'twice_daily':
      return diffMinutes >= 11 * 60;
    case 'daily':
      return diffMinutes >= 22 * 60;
    default:
      return false;
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const botsSnap = await adminDb
      .collection('socialAIBots')
      .where('enabled', '==', true)
      .get();

    if (botsSnap.empty) {
      return NextResponse.json({
        success: true,
        message: 'No active AI bots found',
        executedCount: 0,
      });
    }

    const bots = botsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SocialAIBot));
    const dueBots = bots.filter(isBotDue);

    const results = [];

    for (const bot of dueBots) {
      console.log(`[Cron:SocialBots] Running bot ${bot.name} (${bot.id})...`);
      const runRes = await executeBotRun(bot, bot.autoApprove, undefined, 'system-cron');
      results.push({
        botId: bot.id,
        botName: bot.name,
        success: runRes.success,
        published: runRes.published,
        postId: runRes.postId,
        error: runRes.error,
      });
    }

    // Trigger fishing autopilot cycle if enabled
    let fishingResult = null;
    try {
      fishingResult = await executeFishingAutopilotCycle({ isSystemCron: true });
    } catch (fishErr: any) {
      console.warn('[Cron:SocialBots] Fishing autopilot cycle error:', fishErr);
      fishingResult = { success: false, error: fishErr?.message };
    }

    // Trigger baby autopilot cycle if enabled
    let babyResult = null;
    try {
      babyResult = await executeBabyAutopilotCycle();
    } catch (babyErr: any) {
      console.warn('[Cron:SocialBots] Baby autopilot cycle error:', babyErr);
      babyResult = { success: false, error: babyErr?.message };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      activeBotsCount: bots.length,
      executedCount: dueBots.length,
      results,
      fishingAutopilot: fishingResult,
      babyAutopilot: babyResult,
    });
  } catch (error) {
    console.error('[Cron:SocialBots] Error in cron execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cron error',
      },
      { status: 500 }
    );
  }
}
