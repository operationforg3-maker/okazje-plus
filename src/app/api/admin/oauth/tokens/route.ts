/**
 * OAuth Tokens Management Endpoint (M2)
 * 
 * List and manage OAuth tokens
 * 
 * GET /api/admin/oauth/tokens?vendorId=aliexpress - List tokens for vendor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllTokens } from '@/lib/oauth';
import { logger } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get('vendorId');
    
    if (!vendorId) {
      return NextResponse.json(
        { error: 'vendorId is required' },
        { status: 400 }
      );
    }
    
    // TODO: Check user authorization
    // Only admins should be able to list tokens
    
    const tokens = await getAllTokens(vendorId);
    
    // Don't return sensitive token data
    const sanitizedTokens = tokens.map(token => ({
      id: token.id,
      vendorId: token.vendorId,
      accountName: token.accountName,
      tokenType: token.tokenType,
      status: token.status,
      expiresAt: token.expiresAt,
      obtainedAt: token.obtainedAt,
      lastUsedAt: token.lastUsedAt,
      lastRefreshedAt: token.lastRefreshedAt,
      scope: token.scope,
      createdAt: token.createdAt,
      createdBy: token.createdBy,
    }));
    
    return NextResponse.json({
      tokens: sanitizedTokens,
      count: sanitizedTokens.length,
    });
  } catch (error) {
    logger.error('Failed to list tokens', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve tokens' },
      { status: 500 }
    );
  }
}
