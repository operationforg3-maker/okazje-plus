/**
 * Cart Finalize API Endpoint (M4)
 * 
 * Generates secure affiliate redirects for all products in cart
 * Uses server-side redirect endpoint to prevent cashback extension hijacking
 * 
 * POST /api/cart/finalize
 * Body: { items: [{ productId: string, quantity: number }], userId?: string }
 * 
 * Returns: { links: [{ product: Product, redirectUrl: string }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProduct } from '@/lib/data';
import { logger } from '@/lib/logging';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FinalizeCartSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
  userId: z.string().optional(),
});

/**
 * Generate secure redirect URL for affiliate link
 * 
 * This uses our server-side redirect endpoint to prevent
 * cashback extensions from hijacking the link
 */
async function generateSecureRedirectUrl(
  productId: string,
  productUrl: string,
  userId: string | undefined,
  trackingId: string
): Promise<string> {
  try {
    // Call our secure redirect endpoint which returns the final URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002';
    const params = new URLSearchParams({
      productId,
      productUrl,
      source: 'cart',
      userId: userId || 'anonymous',
    });
    
    return `${baseUrl}/api/affiliate/redirect?${params.toString()}`;
  } catch (error) {
    logger.error('Failed to generate secure redirect', { error });
    return productUrl; // Fallback to original URL
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    const parsed = FinalizeCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }
    
    const { items, userId } = parsed.data;
    
    logger.info('Finalizing cart', { itemCount: items.length, userId });
    
    // Generate secure redirects for each product
    const links = await Promise.all(
      items.map(async item => {
        try {
          // Fetch product from Firestore
          const product = await getProduct(item.productId);
          
          if (!product) {
            logger.warn('Product not found', { productId: item.productId });
            return null;
          }
          
          // Generate secure redirect URL (prevents cashback hijacking)
          const redirectUrl = await generateSecureRedirectUrl(
            item.productId,
            product.affiliateUrl || `https://www.aliexpress.com/item/${item.productId}.html`,
            userId,
            `okazjeplus_cart_${Date.now()}_${Math.random()}`
          );
          
          logger.info('Generated secure redirect', {
            productId: item.productId,
            originalUrl: product.affiliateUrl,
            redirectUrl,
          });
          
          return {
            product,
            affiliateLink: redirectUrl, // Client uses this to redirect
          };
        } catch (error) {
          logger.error('Failed to process cart item', {
            productId: item.productId,
            error,
          });
          return null;
        }
      })
    );
    
    // Filter out nulls
    const validLinks = links.filter(link => link !== null);
    
    logger.info('Cart finalized', {
      requested: items.length,
      generated: validLinks.length,
    });
    
    return NextResponse.json({
      success: true,
      links: validLinks,
    });
    
  } catch (error: any) {
    logger.error('Cart finalization failed', { error: error.message });
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to finalize cart',
      },
      { status: 500 }
    );
  }
}
