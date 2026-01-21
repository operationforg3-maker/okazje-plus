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
    // 1. Fetch Product (Legacy or Core)
    // We try 'products' first as that's what the admin panel uses
    const productRef = adminDb.collection('products').doc(productId);
    const productSnap = await productRef.get();
    
    // If not found in products, try product_cores? 
    // Usually admin uses 'products'.
    if (!productSnap.exists) {
        return { success: false, error: 'Product not found' };
    }

    const productData = productSnap.data() || {};

    // 2. Map Legacy Product to ProductCore-like structure for Refiner
    // Refiner expects: title (Localized), specs (Record), ...
    const mockCore: ProductCore = {
      id: productId,
      identityHash: productData.identityHash || '',
      title: productData.title && typeof productData.title === 'object' 
        ? productData.title 
        : { pl: productData.name || '', en: productData.name || '' }, // Fallback from legacy 'name'
      specs: productData.specs || {},
      description: productData.description && typeof productData.description === 'object'
        ? productData.description
        : { pl: productData.description || '', en: '' },
      
       // Fill other required fields with defaults/existing
       status: productData.status || 'draft',
       imageUrl: productData.imageUrl || productData.image,
       price: productData.price,
       // ... other fields
    } as any; // Cast to any/ProductCore to partial fill

    // 3. Run Refiner Logic
    // We instantiate AIRefiner (jobId 'manual-action')
    const refiner = new AIRefiner('manual-action-' + Date.now());
    
    // We access the private performRefinement via public wrapper or by "cheating" (casting to any)
    // Or we can add a public method to AIRefiner for single product.
    // Ideally AIRefiner should have a public "enrichProduct" method.
    // Let's modify AIRefiner to have a public method.
    
    // For now, I will modify AIRefiner in the next step to expose `enrichSingleProduct`.
    // Assuming it exists for now:
    const enriched = await refiner.enrichSingleProduct(mockCore, 'full_enrichment');

    // 4. Map back to Legacy Product and Update
    const updates: any = {};

    // Update Name/Title
    if (enriched.title) {
        updates.title = enriched.title; // M6 field
        if (enriched.title.pl) updates.name = enriched.title.pl; // Legacy field
    }

    // Update Specs
    if (enriched.specs) {
        updates.specs = enriched.specs;
    }

    // Update Description
    if (enriched.fullDescription) {
        updates.fullDescription = enriched.fullDescription; // M6 field
        if (enriched.fullDescription.pl) {
            updates.description = enriched.fullDescription.pl; // Legacy field
            updates.longDescription = enriched.fullDescription.pl; // Another legacy possibility
        }
    }

    // Update SEO
    if (enriched.seoTitle) updates.seoTitle = enriched.seoTitle;
    if (enriched.seoDescription) updates.seoDescription = enriched.seoDescription;

    // Update Status to approved if acceptable? No, let's keep user control.
    // But Refiner might cycle status. We keep existing status or set to draft if major change?
    // User requested "run refiner", usually wants to see results. Refiner sets 'pending_approval' often.
    // We will update fields but maybe not status unless requested.

    await productRef.update(updates);

    revalidatePath('/admin/products');
    return { success: true, message: 'Refinement complete' };

  } catch (error: any) {
    console.error('Refinement error:', error);
    return { success: false, error: error.message };
  }
}
