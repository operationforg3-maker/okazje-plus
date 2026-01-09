import { CATEGORY_SEEDS } from '@/lib/category-seeds';
import { buildCategoriesFromSeeds } from '@/lib/category-builder';

/**
 * Tworzy tylko strukturę kategorii (3 poziomy) bez pobierania produktów
 * Wykorzystuje CATEGORY_SEEDS z src/lib/category-seeds.ts
 */
export async function createCategoryStructure() {
  try {
    console.log('[createCategoryStructure] ===== STARTING =====');

    const { mainCount, subCount, subSubCount, total } = await buildCategoriesFromSeeds(CATEGORY_SEEDS);

    console.log('\n[createCategoryStructure] ===== COMPLETED =====');

    const summary = `
✅ Utworzono strukturę kategorii!

📊 Podsumowanie:
• Kategorie główne: ${mainCount}
• Podkategorie: ${subCount}
• Sub-podkategorie: ${subSubCount}

📁 Łącznie zapisanych dokumentów: ${total}

🎯 Następny krok: Użyj "Wypełnij Produktami" aby dodać produkty do kategorii

💡 Uwaga: Funkcje są idempotentne - istniejące kategorie nie zostały duplikowane, a cache kategorii został odświeżony
`;

    console.log(summary);
    return summary;

  } catch (error: any) {
    console.error('[createCategoryStructure] Fatal error:', error);
    throw new Error(`Błąd tworzenia struktury kategorii: ${error.message}`);
  }
}
