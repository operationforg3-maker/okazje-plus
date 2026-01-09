/**
 * OAuth Token Revocation Endpoint (M2)
 * 
 * Revokes an OAuth token
 * 
 * Usage: POST /api/admin/oauth/revoke
 * Body: { tokenId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeOAuthToken } from '@/lib/oauth';
import { logger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenId } = body;
    
    if (!tokenId) {
      return NextResponse.json(
        { error: 'tokenId is required' },
        { status: 400 }
      );
    }
    
    // TODO: Check user authorization
    // Only admins should be able to revoke tokens
    
    await revokeOAuthToken(tokenId);
    
    logger.info('OAuth token revoked via API', { tokenId });
    
    return NextResponse.json({
      success: true,
      message: 'Token revoked successfully',
    });
  } catch (error) {
    logger.error('Token revocation failed', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke token' },
      { status: 500 }
    );
  }
}
