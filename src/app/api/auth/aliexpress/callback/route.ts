/**
 * AliExpress OAuth Callback Handler
 * 
 * Handles redirect from AliExpress after user authorizes
 * Path: /api/auth/aliexpress/callback
 * Callback URL: https://okazjeplus.pl/api/auth/aliexpress/callback
 * 
 * Query params:
 * - code: Authorization code to exchange for token
 * - state: CSRF protection token
 * - error: Error code if authorization failed
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering to avoid build-time Firebase initialization
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Lazy import Firebase Admin to avoid build-time initialization
    const { adminDb } = await import('@/lib/firebase-admin');
    
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('🔐 OAuth Callback received', {
      code: code ? code.substring(0, 20) + '...' : 'N/A',
      state: state ? state.substring(0, 20) + '...' : 'N/A',
      error,
      errorDescription,
    });

    // Check for errors
    if (error) {
      console.error('❌ Authorization failed:', { error, errorDescription });
      return NextResponse.redirect(
        new URL(
          `/pl/admin/settings/oauth?error=${error}&message=${encodeURIComponent(errorDescription || 'Unknown error')}`,
          request.url
        )
      );
    }

    // Validate state
    if (!state) {
      console.error('❌ Missing state parameter');
      return NextResponse.redirect(
        new URL('/pl/admin/settings/oauth?error=missing_state', request.url)
      );
    }

    const stateDoc = await adminDb.collection('oauthStates').doc(state).get();
    if (!stateDoc.exists) {
      console.error('❌ Invalid or expired state:', state);
      return NextResponse.redirect(
        new URL('/pl/admin/settings/oauth?error=invalid_state', request.url)
      );
    }

    // Delete state (one-time use)
    await db.collection('oauthStates').doc(state).delete();

    // Check for authorization code
    if (!code) {
      console.error('❌ Missing authorization code');
      return NextResponse.redirect(
        new URL('/pl/admin/settings/oauth?error=missing_code', request.url)
      );
    }

    console.log('✅ Callback validation passed');
    console.log(`📝 Authorization code: ${code.substring(0, 30)}...`);

    // Redirect to admin panel with code
    // User will then manually exchange code using: npx tsx scripts/exchange-oauth-code.ts <code>
    return NextResponse.redirect(
      new URL(
        `/pl/admin/settings/oauth?code=${code}&state=authorized`,
        request.url
      )
    );
  } catch (error) {
    console.error('❌ Callback error:', error);
    return NextResponse.redirect(
      new URL('/pl/admin/settings/oauth?error=callback_error', request.url)
    );
  }
}
