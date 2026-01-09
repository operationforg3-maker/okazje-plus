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
    
    if (!vendorId) {
      return NextResponse.json(
        { error: 'vendorId is required' },
        { status: 400 }
      );
    }
    
    // Get OAuth configuration
    const config = await getOAuthConfig(vendorId);
    
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
    
    // Generate authorization URL
    const authUrl = generateAuthorizationUrl(config, encodedState);
    
    logger.info('OAuth authorization initiated', { vendorId, accountName });
    
    // Redirect to vendor's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error('OAuth authorization failed', { error });
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
