/**
 * POST /api/admin/import/test-diagnostics
 * Quick diagnostics endpoint to check if import system is properly configured
 * Returns detailed status about each importer method
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  console.log('[Diagnostics] ===== Import System Diagnostics =====');

  try {
    const auth = await checkAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check 1: Environment variables
    console.log('[Diagnostics] Checking environment variables...');
    diagnostics.checks.env = {
      ALIEXPRESS_APP_KEY: !!process.env.ALIEXPRESS_APP_KEY,
      ALIEXPRESS_APP_SECRET: !!process.env.ALIEXPRESS_APP_SECRET,
      ALIEXPRESS_API_BASE: !!process.env.ALIEXPRESS_API_BASE,
      CONVERTISER_API_TOKEN: !!process.env.CONVERTISER_API_TOKEN,
      CONVERTISER_API_BASE: !!process.env.CONVERTISER_API_BASE,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'NOT SET',
    };

    // Check 2: AliExpress Client initialization
    console.log('[Diagnostics] Testing AliExpress client...');
    try {
      const timeoutAli = new Promise((_, reject) => setTimeout(() => reject(new Error('AliExpress client import timeout (15s)')), 15000));
      const aliMod = await Promise.race([import('@/lib/integrations/aliexpress-client'), timeoutAli]) as any;
      const { getAliExpressClient } = aliMod;
      const client = getAliExpressClient();
      if (client) {
        diagnostics.checks.aliexpressClient = { status: 'OK', message: 'Client initialized' };
      } else {
        diagnostics.checks.aliexpressClient = { status: 'FAIL', message: 'Client is null' };
      }
    } catch (e: any) {
      diagnostics.checks.aliexpressClient = { status: 'ERROR', message: e.message };
    }

    // Check 3: Convertiser Client initialization
    console.log('[Diagnostics] Testing Convertiser client...');
    try {
      const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
      const client = getConvertiserClient();
      if (client) {
        diagnostics.checks.convertiserClient = { status: 'OK', message: 'Client initialized' };
      } else {
        diagnostics.checks.convertiserClient = { status: 'FAIL', message: 'Client is null' };
      }
    } catch (e: any) {
      diagnostics.checks.convertiserClient = { status: 'ERROR', message: e.message };
    }

    // Check 4: Firestore Admin
    console.log('[Diagnostics] Testing Firestore admin...');
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      if (adminDb) {
        diagnostics.checks.firestore = { status: 'OK', message: 'Firestore admin initialized' };
      } else {
        diagnostics.checks.firestore = { status: 'FAIL', message: 'Firestore admin is null' };
      }
    } catch (e: any) {
      diagnostics.checks.firestore = { status: 'ERROR', message: e.message };
    }

    // Check 5: Genkit AI
    console.log('[Diagnostics] Testing Genkit AI...');
    try {
      const { ai } = await import('@/ai/genkit');
      if (ai) {
        diagnostics.checks.genkit = { status: 'OK', message: 'Genkit AI available' };
      } else {
        diagnostics.checks.genkit = { status: 'FAIL', message: 'Genkit AI not available' };
      }
    } catch (e: any) {
      diagnostics.checks.genkit = { status: 'ERROR', message: e.message };
    }

    // Check 6: Import pipeline functions
    console.log('[Diagnostics] Testing import pipeline functions...');
    try {
      const {
        fetchProductsFromAliexpress,
        fetchProductsFromConvertiser,
        deduplicateProducts,
        enrichProducts,
        translateProducts,
        saveProductsToFirestore,
      } = await import('@/ai/flows/importerFlow');
      
      const allAvailable = 
        !!fetchProductsFromAliexpress &&
        !!fetchProductsFromConvertiser &&
        !!deduplicateProducts &&
        !!enrichProducts &&
        !!translateProducts &&
        !!saveProductsToFirestore;

      diagnostics.checks.importPipeline = allAvailable
        ? { status: 'OK', message: 'All 6 pipeline functions available' }
        : { status: 'FAIL', message: 'Some pipeline functions missing' };
    } catch (e: any) {
      diagnostics.checks.importPipeline = { status: 'ERROR', message: e.message };
    }

    // Check 7: API endpoints
    console.log('[Diagnostics] Checking API endpoints...');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';
    const endpoints = [
      '/api/admin/aliexpress/search',
      '/api/admin/convertiser/search',
      '/api/admin/import/start',
      '/api/admin/import/queue',
      '/api/admin/import/debug',
      '/api/cron/process-jobs',
    ];

    diagnostics.checks.endpoints = {};
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${siteUrl}${endpoint}`, {
          method: 'OPTIONS',
          headers: { 'Authorization': 'Bearer test' },
        });
        // OPTIONS not implemented is OK, means endpoint exists
        diagnostics.checks.endpoints[endpoint] = { status: 'OK', statusCode: res.status };
      } catch (e: any) {
        diagnostics.checks.endpoints[endpoint] = { status: 'ERROR', message: e.message };
      }
    }

    // Summary
    const allChecks = Object.values(diagnostics.checks) as any[];
    const passing = allChecks.filter((c: any) => c.status === 'OK' || c.statusCode < 400).length;
    const total = allChecks.length;

    diagnostics.summary = {
      passing,
      total,
      percentage: Math.round((passing / total) * 100),
      status: passing === total ? 'READY' : passing > total / 2 ? 'DEGRADED' : 'BROKEN',
    };

    console.log('[Diagnostics] Summary:', diagnostics.summary);
    return NextResponse.json(diagnostics);
  } catch (error: any) {
    console.error('[Diagnostics] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
