import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { SmartHarvester } from '@/lib/automation/harvester';

/**
 * POST /api/admin/harvester/presets/[id]/run
 * Uruchom harvester z konfiguracją presetu
 * 
 * Ten endpoint iteruje przez wszystkie keywords w presecie i uruchamia
 * osobny job harvestera dla każdego keyword.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    // Pobierz preset
    const presetDoc = await adminDb.collection('harvester_presets').doc(params.id).get();

    if (!presetDoc.exists) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    const preset = presetDoc.data() as any;

    if (!preset.active) {
      return NextResponse.json(
        { error: 'Preset is inactive. Enable it first.' },
        { status: 400 }
      );
    }

    // Utwórz główny job ID
    const batchJobId = `preset_${params.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const jobIds: string[] = [];
    const startTime = new Date().toISOString();

    // Uruchom harvester dla każdego keyword
    for (const keyword of preset.keywords) {
      const jobId = `${batchJobId}_${keyword.replace(/\s+/g, '_')}`;
      const harvester = new SmartHarvester(jobId);

      // Uruchom w background (async)
      harvester.harvestProducts(
        preset.source,
        keyword,
        preset.maxResultsPerKeyword || 50,
        undefined, // no categories
        false, // not tree mode
        preset.convertiserMode, // only for convertiser
        false,
        'bestsellers',
        preset.tradetrackerMode,
        preset.tradetrackerFeedUrl
      ).catch((err) => {
        console.error(`[Preset ${params.id}] Harvester failed for keyword "${keyword}":`, err);
      });

      jobIds.push(jobId);
    }

    // Aktualizuj preset stats
    await adminDb.collection('harvester_presets').doc(params.id).update({
      lastRun: startTime,
      totalRuns: (preset.totalRuns || 0) + 1,
      'stats.lastRunStatus': 'running',
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      batchJobId,
      jobIds,
      message: `Started ${jobIds.length} harvester jobs for preset "${preset.name}"`,
    });
  } catch (error: any) {
    console.error('[Presets API] Run error:', error);
    
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to run preset' },
      { status: 500 }
    );
  }
}
