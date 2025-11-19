/**
 * Admin API: Product Ingestion Endpoint (M2 with AI)
 * 
 * Triggers automated product import from AliExpress with AI processing pipeline.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { runImport, IngestOptions } from '@/integrations/aliexpress/ingest';
import { logger } from '@/lib/logging';

// Rate limiting: Simple in-memory store (production should use Redis)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

/**
 * Check rate limit for IP
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetAt) {
    // New window
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

/**
 * POST /api/admin/products/ingest
 * 
 * Body:
 * {
 *   profileId: string; // ImportProfile ID
 *   dryRun?: boolean; // If true, simulate without saving
 *   maxItems?: number; // Override max items from profile
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      const auth = getAuth(adminApp);
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      logger.error('Token verification failed', { error });
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }
    
    // 2. Authorization - check admin role
    if (decodedToken.role !== 'admin') {
      logger.warn('Non-admin attempted to access ingest endpoint', {
        uid: decodedToken.uid,
        role: decodedToken.role,
      });
      
      return NextResponse.json(
        { error: 'Forbidden - admin role required' },
        { status: 403 }
      );
    }
    
    // 3. Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: 60 },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(
              Date.now() + RATE_WINDOW
            ).toISOString(),
          },
        }
      );
    }
    
    // 4. Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    
    const { profileId, dryRun, maxItems } = body;
    
    if (!profileId || typeof profileId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid profileId' },
        { status: 400 }
      );
    }
    
    // 5. Execute import
    logger.info('Starting admin product import', {
      profileId,
      dryRun: !!dryRun,
      maxItems,
      triggeredBy: decodedToken.uid,
    });
    
    const options: IngestOptions = {
      dryRun: !!dryRun,
      maxItems: maxItems ? parseInt(maxItems) : undefined,
      triggeredBy: 'manual',
      triggeredByUid: decodedToken.uid,
    };
    
    const result = await runImport(profileId, options);
    
    // 6. Return result
    logger.info('Product import completed', {
      profileId,
      importRunId: result.importRunId,
      stats: result.stats,
      ok: result.ok,
    });
    
    return NextResponse.json(
      {
        ok: result.ok,
        importRunId: result.importRunId,
        dryRun: result.dryRun,
        stats: result.stats,
        errors: result.errors || [],
        message: result.ok
          ? `Import completed successfully`
          : 'Import completed with errors',
      },
      {
        status: result.ok ? 200 : 207, // 207 Multi-Status for partial success
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error) {
    logger.error('Product import endpoint error', { error });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
