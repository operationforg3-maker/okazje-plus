import { NextRequest, NextResponse } from 'next/server';
import { deleteAllProducts, deleteAllDeals, deleteAllCategories, deleteAllProductCores, deleteAllIdentityMatches, deleteAllHarvesterJobs } from '@/lib/data-admin';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Secure endpoint: only admin can wipe database
    await requireAdmin();

    const [deletedProducts, deletedDeals, deletedProductCores, deletedIdentityMatches, deletedHarvesterJobs, deletedCategories] = await Promise.all([
      deleteAllProducts(),
      deleteAllDeals(),
      deleteAllProductCores(),
      deleteAllIdentityMatches(),
      deleteAllHarvesterJobs(),
      deleteAllCategories(),
    ]);
    
    return Response.json({ 
      ok: true, 
      deletedProducts, 
      deletedDeals,
      deletedProductCores,
      deletedIdentityMatches,
      deletedHarvesterJobs,
      deletedCategories: deletedCategories.categories,
      deletedSubcategories: deletedCategories.subcategories,
      message: `✅ Baza danych wyczyszczona!\n\n` +
        `Usunięto:\n` +
        `- ${deletedProducts} produktów (legacy)\n` +
        `- ${deletedProductCores} ProductCore (M6)\n` +
        `- ${deletedDeals} deali\n` +
        `- ${deletedCategories.categories} kategorii głównych\n` +
        `- ${deletedCategories.subcategories} podkategorii\n` +
        `- ${deletedIdentityMatches} wpisów identity_matches\n` +
        `- ${deletedHarvesterJobs} zapisów harvester_jobs`
    });
  } catch (error: any) {
    console.error('[wipe] Error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message || 'Nieznany błąd' 
    }, { status: 500 });
  }
}
