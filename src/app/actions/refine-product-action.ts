'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { AIRefiner } from '@/lib/automation/refiner';
import { ProductCore, LocalizedText } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function refineProductAction(productId: string) {
  const session = await getServerAuthSession();
  if (!session || session.role !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Instantiate AIRefiner
    const refiner = new AIRefiner('manual-action-' + Date.now());
    
    // Use the refiner's built-in method which correctly handles:
    // 1. Fetching from 'product_cores'
    // 2. Enriching data
    // 3. Updating 'product_cores'
    const job = await refiner.refineProducts([productId], 'full_enrichment');

    if (job.productsFailed > 0) {
       // Check logs for specific error
       const failureLog = job.logs.find(l => l.level === 'failed');
       return { 
         success: false, 
         error: failureLog?.message || 'Refinement failed for unknown reason' 
       };
    }

    revalidatePath('/admin/catalog');
    revalidatePath('/admin/products'); // Legacy path just in case
    
    return { success: true, message: 'Refinement complete' };

  } catch (error: any) {
    console.error('Refinement error:', error);
    return { success: false, error: error.message };
  }
}
