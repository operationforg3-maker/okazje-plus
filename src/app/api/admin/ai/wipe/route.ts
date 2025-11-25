import { NextRequest } from 'next/server';
import { deleteAllProducts, deleteAllDeals, deleteAllCategories } from '@/lib/data-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const deletedProducts = await deleteAllProducts();
    const deletedDeals = await deleteAllDeals();
    const deletedCategories = await deleteAllCategories();
    
    return Response.json({ 
      ok: true, 
      deletedProducts, 
      deletedDeals,
      deletedCategories: deletedCategories.categories,
      deletedSubcategories: deletedCategories.subcategories,
      message: `✅ Baza danych wyczyszczona!\n\n` +
        `Usunięto:\n` +
        `- ${deletedProducts} produktów\n` +
        `- ${deletedDeals} deali\n` +
        `- ${deletedCategories.categories} kategorii głównych\n` +
        `- ${deletedCategories.subcategories} podkategorii`
    });
  } catch (error: any) {
    console.error('[wipe] Error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message || 'Nieznany błąd' 
    }, { status: 500 });
  }
}
