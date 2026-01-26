'use server';

import { DealRefiner } from '@/lib/automation/deal-refiner';
import { requireAdmin } from '@/lib/auth-server';
import { getServerAuthSession } from '@/lib/auth-server';
import { RefinerJob } from '@/lib/types';

/**
 * Server action to start Deal Refiner job (admin only)
 */
export async function startDealRefinerJob(
  limit: number = 50
): Promise<{ success: boolean; job?: RefinerJob; error?: string }> {
  try {
    // Auth check
    await requireAdmin();

    const jobId = `deal-refiner-${Date.now()}`;
    const refiner = new DealRefiner(jobId);

    // Run refiner
    const job = await refiner.refineNewDeals(limit);

    return {
      success: true,
      job,
    };
  } catch (err) {
    console.error('[startDealRefinerJob] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
