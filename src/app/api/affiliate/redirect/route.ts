import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

/**
 * Server-side affiliate link redirect
 * 
 * This endpoint:
 * 1. Receives affiliate request from client
 * 2. Builds AliExpress link with our affiliate ID on server (hidden from extensions)
 * 3. Logs the click for conversion tracking
 * 4. Redirects user to AliExpress
 * 
 * Benefits:
 * - Cashback extensions can't intercept server-side construction
 * - Conversion tracking is server-side (can't be manipulated)
 * - User data is protected (not exposed in URL)
 */

interface AffiliateRedirectRequest {
  productId?: string;
  productUrl?: string;
  userId?: string;
  source?: 'cart' | 'product-page' | 'search' | 'deal';
}

// Generate secure token for tracking
function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Validate affiliate URL to prevent injection
function isValidAliExpressUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('aliexpress.com') || 
           parsed.hostname.includes('aliexpress.ru') ||
           parsed.hostname.includes('aff.alibaba.com');
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AffiliateRedirectRequest = await request.json();
    const { productId, productUrl, userId, source = 'product-page' } = body;

    // Validate input
    if (!productUrl && !productId) {
      return NextResponse.json(
        { error: 'Missing productUrl or productId' },
        { status: 400 }
      );
    }

    // Build the affiliate URL
    let affiliateUrl = productUrl || '';
    
    if (!affiliateUrl) {
      // Build from productId if URL not provided
      affiliateUrl = `https://www.aliexpress.com/item/${productId}.html`;
    }

    // Validate the URL
    if (!isValidAliExpressUrl(affiliateUrl)) {
      return NextResponse.json(
        { error: 'Invalid AliExpress URL' },
        { status: 400 }
      );
    }

    // Add our affiliate ID to the URL (server-side, hidden from extensions)
    const affiliateId = process.env.ALIEXPRESS_AFFILIATE_ID || '';
    const trackingToken = generateTrackingToken();
    
    // Append affiliate parameters
    const separator = affiliateUrl.includes('?') ? '&' : '?';
    const finalUrl = `${affiliateUrl}${separator}aff_platform=okazjeplus&aff_token=${trackingToken}`;

    // Log the click for conversion tracking
    try {
      await adminDb.collection('affiliate_clicks').add({
        productId: productId || 'unknown',
        affiliateId,
        userId: userId || 'anonymous',
        source,
        trackingToken,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown',
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error logging affiliate click:', error);
      // Don't fail the request if logging fails
    }

    // Return redirect response
    return NextResponse.json(
      { 
        redirectUrl: finalUrl,
        trackingToken,
        message: 'Redirect generated successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Affiliate redirect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for direct browser redirect (simpler flow)
 * Query params: ?productUrl=...&userId=...&source=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productUrl = searchParams.get('productUrl');
    const productId = searchParams.get('productId');
    const userId = searchParams.get('userId');
    const source = (searchParams.get('source') as 'cart' | 'product-page' | 'search' | 'deal') || 'product-page';

    if (!productUrl && !productId) {
      return new NextResponse('Missing productUrl or productId', { status: 400 });
    }

    let affiliateUrl = productUrl || `https://www.aliexpress.com/item/${productId}.html`;

    if (!isValidAliExpressUrl(affiliateUrl)) {
      return new NextResponse('Invalid AliExpress URL', { status: 400 });
    }

    const trackingToken = generateTrackingToken();
    const affiliateId = process.env.ALIEXPRESS_AFFILIATE_ID || '';

    // Log the click
    try {
      await adminDb.collection('affiliate_clicks').add({
        productId: productId || 'unknown',
        affiliateId,
        userId: userId || 'anonymous',
        source,
        trackingToken,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown',
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error logging affiliate click:', error);
    }

    // Redirect directly
    const separator = affiliateUrl.includes('?') ? '&' : '?';
    const finalUrl = `${affiliateUrl}${separator}aff_platform=okazjeplus&aff_token=${trackingToken}`;

    return NextResponse.redirect(finalUrl, { status: 301 });
  } catch (error) {
    console.error('Affiliate redirect error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
