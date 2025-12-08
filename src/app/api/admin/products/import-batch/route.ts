import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';

interface ImportConfig {
  source: 'aliexpress' | 'allegro' | 'amazon' | 'ebay' | 'convertiser';
  mainCategory: string;
  subCategory: string;
  subSubCategory: string;
  itemsPerCategory: number;
  importType: 'products' | 'deals' | 'coupons';
  draftStatus: 'draft' | 'pending_ai' | 'ready_to_publish';
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Check admin authorization
  const authResult = await checkAdminAuth(req);
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const config = await req.json() as ImportConfig;

    // TODO: Implement actual import logic from external APIs
    // For now, return mock response

    return NextResponse.json({
      stats: {
        totalProcessed: config.itemsPerCategory,
        created: Math.floor(config.itemsPerCategory * 0.8),
        skipped: Math.floor(config.itemsPerCategory * 0.15),
        errors: Math.floor(config.itemsPerCategory * 0.05),
        durationMs: Math.random() * 5000 + 1000,
      },
      errors: [],
    });
  } catch (error) {
    console.error('Product import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import products' },
      { status: 500 }
    );
  }
}
