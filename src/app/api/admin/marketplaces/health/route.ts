import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SourceStatus {
  configured: boolean;
  missingVars: string[];
}

interface HealthCheckResponse {
  ok: boolean;
  sources: Record<string, SourceStatus>;
  summary: {
    totalSources: number;
    configuredSources: number;
    unconfiguredSources: number;
  };
}

export async function GET() {
  try {
    const sources: Record<string, SourceStatus> = {};

    // AliExpress
    const aliexpressBase = process.env.ALIEXPRESS_API_BASE;
    const aliexpressKey = process.env.ALIEXPRESS_APP_KEY;
    const aliexpressSecret = process.env.ALIEXPRESS_APP_SECRET;
    const aliexpressMissing = [];
    if (!aliexpressBase) aliexpressMissing.push('ALIEXPRESS_API_BASE');
    if (!aliexpressKey) aliexpressMissing.push('ALIEXPRESS_APP_KEY');
    if (!aliexpressSecret) aliexpressMissing.push('ALIEXPRESS_APP_SECRET');
    sources.aliexpress = {
      configured: aliexpressMissing.length === 0,
      missingVars: aliexpressMissing,
    };

    // Convertiser
    const convertiserToken = process.env.CONVERTISER_API_TOKEN;
    sources.convertiser = {
      configured: Boolean(convertiserToken),
      missingVars: convertiserToken ? [] : ['CONVERTISER_API_TOKEN'],
    };

    // Allegro
    const allegroKey = process.env.ALLEGRO_APP_KEY;
    const allegroSecret = process.env.ALLEGRO_APP_SECRET;
    const allegroMissing = [];
    if (!allegroKey) allegroMissing.push('ALLEGRO_APP_KEY');
    if (!allegroSecret) allegroMissing.push('ALLEGRO_APP_SECRET');
    sources.allegro = {
      configured: allegroMissing.length === 0,
      missingVars: allegroMissing,
    };

    // Amazon
    const amazonAccessKey = process.env.AMAZON_ACCESS_KEY;
    const amazonSecretKey = process.env.AMAZON_SECRET_KEY;
    const amazonPartnerTag = process.env.AMAZON_PARTNER_TAG;
    const amazonMissing = [];
    if (!amazonAccessKey) amazonMissing.push('AMAZON_ACCESS_KEY');
    if (!amazonSecretKey) amazonMissing.push('AMAZON_SECRET_KEY');
    if (!amazonPartnerTag) amazonMissing.push('AMAZON_PARTNER_TAG');
    sources.amazon = {
      configured: amazonMissing.length === 0,
      missingVars: amazonMissing,
    };

    // eBay
    const ebayAppId = process.env.EBAY_APP_ID;
    const ebayCertId = process.env.EBAY_CERT_ID;
    const ebayMissing = [];
    if (!ebayAppId) ebayMissing.push('EBAY_APP_ID');
    if (!ebayCertId) ebayMissing.push('EBAY_CERT_ID');
    sources.ebay = {
      configured: ebayMissing.length === 0,
      missingVars: ebayMissing,
    };

    const totalSources = Object.keys(sources).length;
    const configuredSources = Object.values(sources).filter(s => s.configured).length;
    const unconfiguredSources = totalSources - configuredSources;

    const response: HealthCheckResponse = {
      ok: configuredSources > 0, // At least one source must be configured
      sources,
      summary: {
        totalSources,
        configuredSources,
        unconfiguredSources,
      },
    };

    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e),
      sources: {},
      summary: { totalSources: 0, configuredSources: 0, unconfiguredSources: 0 },
    }, { status: 500 });
  }
}
