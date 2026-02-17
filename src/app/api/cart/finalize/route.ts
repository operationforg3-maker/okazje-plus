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
import { getProduct, getDealById } from '@/lib/data';
import { logger } from '@/lib/logging';
import { z } from 'zod';
import { getExternalUrl } from '@/lib/external-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FinalizeCartSchema = z.object({
  items: z.array(z.object({
    productId: z.string().optional(),
    dealId: z.string().optional(),
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
  baseUrl: string,
  productId: string,
  productUrl: string,
  userId: string | undefined,
  trackingId: string
): Promise<string> {
  try {
    // Call our secure redirect endpoint which returns the final URL
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

function resolvePublicBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req.headers.get('host');
  if (host && !host.startsWith('0.0.0.0')) {
    const proto = host.includes('localhost') ? 'http' : 'https';
    return `${proto}://${host}`;
  }

  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envSiteUrl && /^https?:\/\//i.test(envSiteUrl)) {
    return envSiteUrl;
  }

  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const requestOrigin = resolvePublicBaseUrl(req);
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
          let productId = item.productId;
          let targetUrl = '';
          let isDeal = false; // Flag to indicate if we found a Deal

          // 1. Try to load Deal URL if dealId is present
          if (item.dealId) {
             const deal = await getDealById(item.dealId);
             if (deal) {
               isDeal = true;
               // Try multiple fields for the link (M6 Deal vs Legacy Deal)
               targetUrl = getExternalUrl(
                 deal.link,
                 (deal as any).affiliateLink,
                 (deal as any).affiliateUrl,
                 (deal as any).dealUrl,
                 (deal as any).sourceUrl,
                 (deal as any).url,
                 (deal as any).externalUrl,
                 (deal as any).metadata?.offerPreviewUrl,
                 (deal as any).metadata?.previewUrl,
                 (deal as any).metadata?.offerUrl,
                 (deal as any).metadata?.externalUrl,
                 (deal as any).metadata?.url
               ) || '';
               
               // If item.productId was missing but we have a deal, use dealId as fallback identifier
               if (!productId) productId = item.dealId;
             }
          }

          // 2. If no URL yet, try Product URL
          if (!targetUrl && productId) {
             // Fallback to product if deal not found or no dealId
             const product = await getProduct(productId);
             if (product) {
               targetUrl = getExternalUrl(
                 product.affiliateUrl,
                 (product as any).link,
                 (product as any).dealUrl,
                 (product as any).sourceUrl,
                 (product as any).externalUrl,
                 (product as any).metadata?.externalUrl,
                 (product as any).sourceLinks?.[0]?.url,
                 (product as any).sourceLinks?.[0]?.link
               ) || '';
             }
          }
          
          if (!targetUrl) {
            logger.warn('Product/Deal not found or no URL', { productId: item.productId, dealId: item.dealId });
            return null;
          }
          
          // Generate secure redirect URL (prevents cashback hijacking)
          const redirectUrl = await generateSecureRedirectUrl(
            requestOrigin,
            productId || 'unknown',
            targetUrl,
            userId,
            `okazjeplus_cart_${Date.now()}_${Math.random()}`
          );
          
          logger.info('Generated secure redirect', {
            productId: item.productId,
            dealId: item.dealId,
            originalUrl: targetUrl,
            redirectUrl,
          });

          // 3. Construct response object
          // Client expects { product: Product, affiliateLink: string }
          let productObj: any = null;
          
          // Try to get real product if ID exists
          if (item.productId) {
             productObj = await getProduct(item.productId);
          }
          
          // If no product found but we have a deal, construct a "Virtual Product" from the deal
          // to satisfy the frontend contract without crashing it.
          if (!productObj && isDeal && item.dealId) {
             const deal = await getDealById(item.dealId);
             if (deal) {
                // Map Deal -> minimal Product
                productObj = {
                   id: deal.id,
                   name: (typeof deal.title === 'string' ? deal.title : deal.title?.pl) || 'Oferta',
                   image: deal.image || (deal as any).imageUrl,
                   price: typeof deal.price === 'object' ? deal.price.amount : (deal.price || 0),
                   affiliateUrl: targetUrl,
                   // Add M6 mock fields
                   title: typeof deal.title === 'string' ? { pl: deal.title, en: deal.title } : deal.title,
                };
             }
          }

          if (!productObj) {
            // Should verify unlikely to happen if targetUrl was found, but safety first
             return null;
          }
          
          return {
            product: productObj,
            affiliateLink: redirectUrl, // Client uses this to redirect
          };
        } catch (error) {
          logger.error('Failed to process cart item', {
            productId: item.productId,
            dealId: item.dealId,
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
