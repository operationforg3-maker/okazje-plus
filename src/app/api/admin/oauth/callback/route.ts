/**
 * OAuth Callback Endpoint (M2)
 * 
 * Handles OAuth callback after user authorizes the app
 * Exchanges authorization code for access token
 * 
 * Usage: GET /api/admin/oauth/callback?code=XXX&state=YYY
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/oauth';
import { logger } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Check for OAuth errors
    if (error) {
      logger.error('OAuth authorization error', { error, errorDescription });
      
      // Redirect to admin panel with error
      const redirectUrl = new URL('/admin/settings/oauth', request.nextUrl.origin);
      redirectUrl.searchParams.set('error', error);
      redirectUrl.searchParams.set('error_description', errorDescription || 'Authorization failed');
      
      return NextResponse.redirect(redirectUrl);
    }
    
    if (!code || !state) {
      logger.error('Missing code or state parameter');
      
      const redirectUrl = new URL('/admin/settings/oauth', request.nextUrl.origin);
      redirectUrl.searchParams.set('error', 'invalid_request');
      redirectUrl.searchParams.set('error_description', 'Missing required parameters');
      
      return NextResponse.redirect(redirectUrl);
    }
    
    // Decode and validate state
    let stateData: {
      vendorId: string;
      accountName: string;
      timestamp: number;
      nonce: string;
    };
    
    try {
      const decodedState = Buffer.from(state, 'base64url').toString();
      stateData = JSON.parse(decodedState);
      
      // Validate state timestamp (should be within 10 minutes)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 10 * 60 * 1000) {
        throw new Error('State expired');
      }
    } catch (error) {
      logger.error('Invalid state parameter', { error });
      
      const redirectUrl = new URL('/admin/settings/oauth', request.nextUrl.origin);
      redirectUrl.searchParams.set('error', 'invalid_state');
      redirectUrl.searchParams.set('error_description', 'Invalid or expired state parameter');
      
      return NextResponse.redirect(redirectUrl);
    }
    
    // TODO: Get user ID from session/auth
    // For now, using a placeholder
    const userId = 'admin-user'; // Should come from auth context
    
    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     undefined;
    
    // Exchange code for token
    const token = await exchangeCodeForToken(
      stateData.vendorId,
      code,
      userId,
      stateData.accountName,
      {
        userAgent,
        ipAddress,
      }
    );
    
    logger.info('OAuth token obtained successfully', {
      tokenId: token.id,
      vendorId: stateData.vendorId,
      accountName: stateData.accountName,
    });
    
    // Redirect to admin panel with success message
    const redirectUrl = new URL('/admin/settings/oauth', request.nextUrl.origin);
    redirectUrl.searchParams.set('success', 'true');
    redirectUrl.searchParams.set('vendorId', stateData.vendorId);
    redirectUrl.searchParams.set('accountName', stateData.accountName);
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logger.error('OAuth callback failed', { error });
    
    const redirectUrl = new URL('/admin/settings/oauth', request.nextUrl.origin);
    redirectUrl.searchParams.set('error', 'token_exchange_failed');
    redirectUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.redirect(redirectUrl);
  }
}
