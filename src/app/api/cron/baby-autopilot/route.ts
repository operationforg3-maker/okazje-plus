import { NextRequest, NextResponse } from 'next/server';
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

  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
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
    const result = await executeBabyAutopilotCycle();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron:BabyAutopilot] Error executing cycle:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
