import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/harvester/presets
 * Pobierz wszystkie presety keywords dla harvestera
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const presetsSnapshot = await adminDb
      .collection('harvester_presets')
      .orderBy('createdAt', 'desc')
      .get();

    const presets = presetsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, presets });
  } catch (error: any) {
    console.error('[Presets API] GET error:', error);
    
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch presets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/harvester/presets
 * Utwórz nowy preset
 * 
 * Body:
 * {
 *   name: string,
 *   source: 'convertiser' | 'aliexpress' | 'amazon' | 'allegro',
 *   keywords: string[],
 *   convertiserMode?: 'products' | 'offers',
 *   maxResultsPerKeyword?: number,
 *   schedule?: { enabled: boolean, cron?: string },
 *   active: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { 
      name, 
      source, 
      keywords, 
      convertiserMode = 'products',
      maxResultsPerKeyword = 50,
      schedule,
      active = true 
    } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid name' }, { status: 400 });
    }

    if (!source || !['convertiser', 'aliexpress', 'amazon', 'allegro'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords must be non-empty array' }, { status: 400 });
    }

    const preset = {
      name,
      source,
      keywords,
      convertiserMode: source === 'convertiser' ? convertiserMode : undefined,
      maxResultsPerKeyword,
      schedule: schedule || { enabled: false },
      active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      totalRuns: 0,
      stats: {
        totalProducts: 0,
        totalDeals: 0,
        lastRunStatus: null,
      },
    };

    const docRef = await adminDb.collection('harvester_presets').add(preset);

    return NextResponse.json({
      success: true,
      preset: { id: docRef.id, ...preset },
    });
  } catch (error: any) {
    console.error('[Presets API] POST error:', error);
    
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create preset' },
      { status: 500 }
    );
  }
}
