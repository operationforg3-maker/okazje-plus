/**
 * Test OAuth Config endpoint - debug only
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get('vendorId') || 'aliexpress';
    
    logger.info('[test-oauth-config] Starting test', { vendorId });
    
    // Test 1: Check if adminDb is initialized
    logger.info('[test-oauth-config] adminDb type', { type: typeof adminDb });
    
    // Test 2: Try to get config
    logger.info('[test-oauth-config] Fetching config...');
    const configSnap = await adminDb.collection('oauthConfigs').doc(vendorId).get();
    
    logger.info('[test-oauth-config] Config fetched', { 
      exists: configSnap.exists,
      hasData: configSnap.exists ? !!configSnap.data() : false
    });
    
    if (!configSnap.exists) {
      return NextResponse.json({
        success: false,
        error: 'Config not found',
        vendorId
      });
    }
    
    const data = configSnap.data();
    
    return NextResponse.json({
      success: true,
      vendorId,
      config: {
        clientId: data?.clientId,
        hasClientSecret: !!data?.clientSecret,
        authorizationUrl: data?.authorizationUrl,
        tokenUrl: data?.tokenUrl,
        callbackUrl: data?.callbackUrl,
        redirectUri: data?.redirectUri,
        enabled: data?.enabled,
        scope: data?.scope
      }
    });
  } catch (error) {
    logger.error('[test-oauth-config] Error', {
      error: String(error),
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      name: (error as Error)?.name
    });
    
    return NextResponse.json({
      success: false,
      error: (error as Error)?.message || String(error),
      stack: (error as Error)?.stack
    }, { status: 500 });
  }
}
