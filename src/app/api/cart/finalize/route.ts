/**
 * Cart Finalize API Endpoint (M4)
 * 
 * Generates fresh deep affiliate links for all products in cart
 * Uses AliExpress link generation API to ensure tracking and commission
 * 
 * POST /api/cart/finalize
 * Body: { items: [{ productId: string, quantity: number }] }
 * 
 * Returns: { links: [{ product: Product, affiliateLink: string }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAliExpressClient } from '@/integrations/aliexpress/client';
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
});

/**
 * Generate deep affiliate link for a product
 * 
 * Method: aliexpress.affiliate.link.generate
 * Generates trackable affiliate link with commission tracking
 */
async function generateAffiliateLink(
  client: any,
  productUrl: string,
  trackingId?: string
): Promise<string> {
  try {
    const params: Record<string, any> = {
      promotion_link_type: 0, // Normal link
      source_values: productUrl,
    };
    
    if (trackingId) {
      params.tracking_id = trackingId;
    }
    
    const result = await client.request('aliexpress.affiliate.link.generate', params);
    
    // Parse response
    const responseKey = Object.keys(result)[0];
    const responseData = result[responseKey];
    
    if (!responseData || responseData.resp_code !== 200) {
      logger.warn('Link generation failed, using original URL', { responseData });
      return productUrl;
    }
    
    const promotionLinks = responseData.result?.promotion_links;
    if (promotionLinks && promotionLinks.length > 0) {
      return promotionLinks[0].promotion_link;
    }
    
    return productUrl;
  } catch (error) {
    logger.error('Failed to generate affiliate link', { error });
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
    
    const { items } = parsed.data;
    
    logger.info('Finalizing cart', { itemCount: items.length });
    
    // Initialize AliExpress client
    const client = createAliExpressClient();
    
    // Generate links for each product
    const links = await Promise.all(
      items.map(async item => {
        try {
          // Fetch product from Firestore
          const product = await getProduct(item.productId);
          
          if (!product) {
            logger.warn('Product not found', { productId: item.productId });
            return null;
          }
          
          // Generate fresh affiliate link
          const affiliateLink = await generateAffiliateLink(
            client,
            product.affiliateUrl,
            `okazjeplus_cart_${Date.now()}`
          );
          
          logger.info('Generated affiliate link', {
            productId: item.productId,
            originalUrl: product.affiliateUrl,
            generatedLink: affiliateLink,
          });
          
          return {
            product,
            affiliateLink,
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
