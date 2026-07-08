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
import { requireAdmin } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Secure endpoint: only admin can revoke OAuth tokens
    await requireAdmin();

    const body = await request.json();
    const { tokenId } = body;
    
    if (!tokenId) {
      return NextResponse.json(
        { error: 'tokenId is required' },
        { status: 400 }
      );
    }
    
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
