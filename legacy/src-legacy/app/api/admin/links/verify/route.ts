/**
 * Admin API: Affiliate links verification
 * POST /api/admin/links/verify
 * 
 * Cyclically verifies that all product/deal links are affiliate links
 * and updates non-affiliate links to affiliate format
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { checkAdminAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large batches

interface LinkVerificationResult {
  entityType: 'product' | 'deal';
  entityId: string;
  originalLink: string;
  isAffiliate: boolean;
  needsUpdate: boolean;
  updatedLink?: string;
  error?: string;
}

/**
 * Check if URL is an affiliate link
 * Supports: AliExpress, Amazon, other affiliate patterns
 */
function isAffiliateLink(url: string): boolean {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // AliExpress affiliate patterns
  if (lowerUrl.includes('aliexpress.com') || lowerUrl.includes('s.click.aliexpress.com')) {
    // Check for tracking parameters
    return lowerUrl.includes('aff_') || 
           lowerUrl.includes('pvid=') || 
           lowerUrl.includes('algo_pvid=') ||
           lowerUrl.includes('terminal_id=') ||
           url.includes('s.click.aliexpress.com'); // Short link is always affiliate
  }
  
  // Amazon affiliate patterns
  if (lowerUrl.includes('amazon.')) {
    return lowerUrl.includes('tag=') || lowerUrl.includes('/dp/') && url.includes('?');
  }
  
  // Generic affiliate markers
  return lowerUrl.includes('aff_') || 
         lowerUrl.includes('affiliate') ||
         lowerUrl.includes('ref=') ||
         lowerUrl.includes('partner');
}

/**
 * Convert regular product URL to affiliate link
 * This is a placeholder - implement actual affiliate link generation
 */
function convertToAffiliateLink(url: string, source: 'aliexpress' | 'amazon' | 'other'): string {
  if (!url) return url;
  
  // AliExpress conversion
  if (source === 'aliexpress' || url.includes('aliexpress.com')) {
    // If already has parameters, add affiliate ones
    const separator = url.includes('?') ? '&' : '?';
    
    // Add basic tracking parameters (replace with real affiliate ID)
    // TODO: Get affiliate credentials from config/secrets
    return `${url}${separator}aff_platform=portal&terminal_id=okazje-plus`;
  }
  
  // Amazon conversion
  if (source === 'amazon' || url.includes('amazon.')) {
    const separator = url.includes('?') ? '&' : '?';
    
    // Add Amazon affiliate tag (replace with real tag)
    // TODO: Get Amazon affiliate tag from config
    return `${url}${separator}tag=okazjeplus-21`;
  }
  
  // Other sources - return as is
  return url;
}

/**
 * Verify and update links in products collection
 */
async function verifyProductLinks(
  limit: number = 100,
  updateLinks: boolean = false
): Promise<LinkVerificationResult[]> {
  const results: LinkVerificationResult[] = [];
  
  // Get products batch
  const productsSnapshot = await adminDb
    .collection('products')
    .where('status', '==', 'approved') // Only check active products
    .limit(limit)
    .get();
  
  for (const doc of productsSnapshot.docs) {
    const product = doc.data();
    const affiliateUrl = product.affiliateUrl || product.link;
    
    if (!affiliateUrl) {
      results.push({
        entityType: 'product',
        entityId: doc.id,
        originalLink: '',
        isAffiliate: false,
        needsUpdate: false,
        error: 'No link found'
      });
      continue;
    }
    
    const isAffiliate = isAffiliateLink(affiliateUrl);
    
    if (!isAffiliate && updateLinks) {
      // Convert to affiliate link
      const source = product.metadata?.source || 'other';
      const updatedLink = convertToAffiliateLink(affiliateUrl, source);
      
      // Update in Firestore
      await adminDb.collection('products').doc(doc.id).update({
        affiliateUrl: updatedLink,
        'metadata.affiliateLinkUpdated': new Date().toISOString()
      });
      
      results.push({
        entityType: 'product',
        entityId: doc.id,
        originalLink: affiliateUrl,
        isAffiliate: false,
        needsUpdate: true,
        updatedLink
      });
    } else {
      results.push({
        entityType: 'product',
        entityId: doc.id,
        originalLink: affiliateUrl,
        isAffiliate,
        needsUpdate: !isAffiliate
      });
    }
  }
  
  return results;
}

/**
 * Verify and update links in deals collection
 */
async function verifyDealLinks(
  limit: number = 100,
  updateLinks: boolean = false
): Promise<LinkVerificationResult[]> {
  const results: LinkVerificationResult[] = [];
  
  // Get deals batch
  const dealsSnapshot = await adminDb
    .collection('deals')
    .where('status', '==', 'approved') // Only check active deals
    .limit(limit)
    .get();
  
  for (const doc of dealsSnapshot.docs) {
    const deal = doc.data();
    const link = deal.link;
    
    if (!link) {
      results.push({
        entityType: 'deal',
        entityId: doc.id,
        originalLink: '',
        isAffiliate: false,
        needsUpdate: false,
        error: 'No link found'
      });
      continue;
    }
    
    const isAffiliate = isAffiliateLink(link);
    
    if (!isAffiliate && updateLinks) {
      // Convert to affiliate link
      const source = deal.metadata?.source || deal.source || 'other';
      const updatedLink = convertToAffiliateLink(link, source);
      
      // Update in Firestore
      await adminDb.collection('deals').doc(doc.id).update({
        link: updatedLink,
        'metadata.affiliateLinkUpdated': new Date().toISOString()
      });
      
      results.push({
        entityType: 'deal',
        entityId: doc.id,
        originalLink: link,
        isAffiliate: false,
        needsUpdate: true,
        updatedLink
      });
    } else {
      results.push({
        entityType: 'deal',
        entityId: doc.id,
        originalLink: link,
        isAffiliate,
        needsUpdate: !isAffiliate
      });
    }
  }
  
  return results;
}

export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { 
      action = 'verify',
      updateLinks = false,
      limit = 100
    } = await req.json();
    
    if (action === 'verify' || action === 'update') {
      const shouldUpdate = action === 'update' || updateLinks;
      
      // Verify both products and deals
      const [productResults, dealResults] = await Promise.all([
        verifyProductLinks(limit, shouldUpdate),
        verifyDealLinks(limit, shouldUpdate)
      ]);
      
      const allResults = [...productResults, ...dealResults];
      
      const stats = {
        total: allResults.length,
        affiliate: allResults.filter(r => r.isAffiliate).length,
        nonAffiliate: allResults.filter(r => !r.isAffiliate && !r.error).length,
        updated: allResults.filter(r => r.needsUpdate && r.updatedLink).length,
        errors: allResults.filter(r => r.error).length
      };
      
      return NextResponse.json({
        success: true,
        action: shouldUpdate ? 'updated' : 'verified',
        stats,
        results: allResults,
        message: shouldUpdate
          ? `✅ Zaktualizowano ${stats.updated} linków (${stats.affiliate} już było OK)`
          : stats.nonAffiliate > 0
            ? `⚠️ Znaleziono ${stats.nonAffiliate} linków bez afiliacji`
            : `✅ Wszystkie ${stats.affiliate} linków to linki afiliacyjne!`
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "verify" or "update"' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Link verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get quick stats without full verification
    const [productsCount, dealsCount] = await Promise.all([
      adminDb.collection('products').where('status', '==', 'approved').count().get(),
      adminDb.collection('deals').where('status', '==', 'approved').count().get()
    ]);
    
    return NextResponse.json({
      stats: {
        totalProducts: productsCount.data().count,
        totalDeals: dealsCount.data().count,
        message: 'Use POST with action=verify to check affiliate links'
      }
    });

  } catch (error: any) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
