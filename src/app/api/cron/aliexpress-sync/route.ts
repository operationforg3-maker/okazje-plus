import { NextRequest, NextResponse } from 'next/server';
import { importFromAliExpress } from '@/lib/aliexpress-importer';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/aliexpress-sync
 * 
 * Scheduled cron job to refresh AliExpress products/deals
 * - Fetches latest prices, availability, images
 * - Updates existing items
 * - Triggered by Cloud Scheduler or App Hosting cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron request', { authHeader });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('Starting scheduled AliExpress sync');

    // Load enabled import profiles
    const profilesSnapshot = await adminDb
      .collection('importProfiles')
      .where('enabled', '==', true)
      .where('vendorId', '==', 'aliexpress')
      .get();

    if (profilesSnapshot.empty) {
      logger.info('No enabled AliExpress import profiles found');
      return NextResponse.json({
        success: true,
        message: 'No profiles to sync',
        synced: 0,
      });
    }

    const results = [];
    for (const profileDoc of profilesSnapshot.docs) {
      const profile = { id: profileDoc.id, ...profileDoc.data() };
      
      try {
        logger.info('Running sync for profile', { profileId: profile.id, name: profile.name });
        
        const result = await importFromAliExpress({
          profileId: profile.id,
          maxItems: 20, // Limit for scheduled sync
          dryRun: false,
          autoApprove: true, // Auto-approve for scheduled sync
          enableAI: true,
          triggeredBy: 'cron',
        });

        results.push({
          profileId: profile.id,
          name: profile.name,
          success: result.success,
          stats: result.stats,
        });

        logger.info('Profile sync completed', {
          profileId: profile.id,
          stats: result.stats,
        });

      } catch (error) {
        logger.error('Profile sync failed', {
          profileId: profile.id,
          error: error instanceof Error ? error.message : String(error),
        });
        
        results.push({
          profileId: profile.id,
          name: profile.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    logger.info('Scheduled AliExpress sync completed', {
      total: totalCount,
      successful: successCount,
      failed: totalCount - successCount,
    });

    return NextResponse.json({
      success: true,
      synced: successCount,
      total: totalCount,
      results,
    });

  } catch (error) {
    logger.error('Cron sync failed', { error });
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
