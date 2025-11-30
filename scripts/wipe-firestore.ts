#!/usr/bin/env tsx
import { deleteAllProducts, deleteAllDeals, deleteAllCategories } from '@/lib/data-admin';

async function main() {
  console.log('🧹 Rozpoczynam czyszczenie kolekcji...');

  const deletedDeals = await deleteAllDeals();
  console.log(`- Usunięto ${deletedDeals} dokumentów z "deals"`);

  const deletedProducts = await deleteAllProducts();
  console.log(`- Usunięto ${deletedProducts} dokumentów z "products"`);

  const deletedCategories = await deleteAllCategories();
  console.log(`- Usunięto ${deletedCategories.categories} kategorii oraz ${deletedCategories.subcategories} podkategorii`);

  console.log('✅ Czyszczenie zakończone');
}

main().catch((error) => {
  console.error('❌ Błąd podczas czyszczenia:', error);
  process.exit(1);
});
