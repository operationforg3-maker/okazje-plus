/**
 * OAuth Authorization Initiation Endpoint (M2)
 * 
 * Initiates OAuth flow by redirecting to vendor's authorization URL
 * 
 * Usage: GET /api/admin/oauth/authorize?vendorId=aliexpress&accountName=main
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConfig, generateAuthorizationUrl } from '@/lib/oauth';
import { logger } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get('vendorId');
    const accountName = searchParams.get('accountName') || 'default';
    
    logger.info('[authorize] Starting OAuth flow', { vendorId, accountName });
    
    if (!vendorId) {
      return NextResponse.json(
        { error: 'vendorId is required' },
        { status: 400 }
      );
    }
    
    // Get OAuth configuration
    logger.info('[authorize] Fetching OAuth config', { vendorId });
    const config = await getOAuthConfig(vendorId);
    logger.info('[authorize] Config retrieved', { vendorId, hasConfig: !!config, enabled: config?.enabled });
    
    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: 'OAuth not configured or not enabled for this vendor' },
        { status: 404 }
      );
    }
    
    // Generate state parameter for CSRF protection
    const state = JSON.stringify({
      vendorId,
      accountName,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
    });
    
    // Encode state as base64
    const encodedState = Buffer.from(state).toString('base64url');
    
    logger.info('[authorize] Generating auth URL', { vendorId, clientId: config.clientId, redirectUri: config.redirectUri });
    
    // Generate authorization URL
    const authUrl = generateAuthorizationUrl(config, encodedState);
    
    logger.info('OAuth authorization initiated', { vendorId, accountName, authUrl });
    
    // Redirect to vendor's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error('OAuth authorization failed', { 
      error, 
      errorMessage: (error as Error)?.message, 
      errorStack: (error as Error)?.stack 
    });
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow', details: (error as Error)?.message },
      { status: 500 }
    );
  }
}
