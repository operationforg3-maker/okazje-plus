#!/usr/bin/env tsx
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  deleteAllProducts,
  deleteAllDeals,
  deleteAllProductCores,
  deleteAllCategories,
  deleteAllIdentityMatches,
  deleteAllHarvesterJobs,
} from '@/lib/data-admin';

async function main() {
  const rl = readline.createInterface({ input, output });
  try {
    console.log('⚠️  UWAGA: To narzędzie usunie WSZYSTKIE rekordy deals/products/product_cores oraz kategorie.');
    const answer = (await rl.question('Wpisz "WIPE" aby kontynuować: ')).trim();
    if (answer !== 'WIPE') {
      console.log('Przerwano – nie podano poprawnego potwierdzenia.');
      return;
    }

    console.log('⏳ Czyszczenie...');
    const [products, deals, productCores, identityMatches, harvesterJobs, categories] = await Promise.all([
      deleteAllProducts(),
      deleteAllDeals(),
      deleteAllProductCores(),
      deleteAllIdentityMatches(),
      deleteAllHarvesterJobs(),
      deleteAllCategories(),
    ]);

    console.log('✅ Zakończono czyszczenie:');
    console.log(`- Produkty (legacy): ${products}`);
    console.log(`- ProductCore (M6): ${productCores}`);
    console.log(`- Deale: ${deals}`);
    console.log(`- Identity matches: ${identityMatches}`);
    console.log(`- Harvester jobs: ${harvesterJobs}`);
    console.log(`- Kategorie + podkategorie: ${categories.categories} / ${categories.subcategories}`);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('❌ Błąd podczas czyszczenia:', error);
  process.exit(1);
});
