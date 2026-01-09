'use server';

/**
 * Smart Import API Endpoint
 * 
 * POST /api/admin/smart-import/test
 * Test the 3 AI agents on a product
 */

import { NextRequest, NextResponse } from 'next/server';
import { smartImportProduct, smartImportBatch } from '@/integrations/smart-importer';
import { logger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both single and batch imports
    const isBatch = Array.isArray(body);
    
    if (isBatch) {
      logger.info('🚀 Smart Import Batch Request', { count: body.length });
      const results = await smartImportBatch(body);
      
      return NextResponse.json({
        success: true,
        count: results.length,
        results,
        stats: {
          successful: results.filter(r => r.success).length,
          rejected: results.filter(r => !r.success).length,
        },
      });
    } else {
      logger.info('🚀 Smart Import Request', { title: body.title });
      const result = await smartImportProduct({
        ...body,
        importedBy: 'test-user',
      });
      
      return NextResponse.json({
        success: result.success,
        result,
      });
    }
  } catch (error) {
    logger.error('❌ Smart Import API Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
