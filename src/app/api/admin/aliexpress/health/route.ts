import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const API_BASE = process.env.ALIEXPRESS_API_BASE;
    const APP_KEY = process.env.ALIEXPRESS_APP_KEY || process.env.ALIEXPRESS_API_KEY;
    const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
    const AFFILIATE_ID = process.env.ALIEXPRESS_AFFILIATE_ID;

    const configured = Boolean(API_BASE);
    const hasAppKeySecret = Boolean(APP_KEY && APP_SECRET);
    const hasAffiliateId = Boolean(AFFILIATE_ID);

    let mode: 'signed' | 'api-key' | 'mock' = 'mock';
    if (hasAppKeySecret) mode = 'signed';
    else if (process.env.ALIEXPRESS_API_KEY) mode = 'api-key';

    const issues: string[] = [];
    if (!configured) issues.push('Brak ALIEXPRESS_API_BASE');
    if (!hasAppKeySecret && !process.env.ALIEXPRESS_API_KEY) {
      issues.push('Brak APP_KEY/APP_SECRET lub ALIEXPRESS_API_KEY');
    }

    return NextResponse.json({
      ok: configured,
      configured,
      hasAppKeySecret,
      hasAffiliateId,
      mode,
      issues,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
