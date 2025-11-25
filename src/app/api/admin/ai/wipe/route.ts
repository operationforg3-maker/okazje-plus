import { NextRequest } from 'next/server';
import { deleteAllProducts, deleteAllDeals } from '@/lib/data-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const deletedProducts = await deleteAllProducts();
    const deletedDeals = await deleteAllDeals();
    
    return Response.json({ 
      ok: true, 
      deletedProducts, 
      deletedDeals,
      message: `✅ Baza danych wyczyszczona!\n\nUsunięto ${deletedProducts} produktów i ${deletedDeals} deali.` 
    });
  } catch (error: any) {
    console.error('[wipe] Error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message || 'Nieznany błąd' 
    }, { status: 500 });
  }
}
