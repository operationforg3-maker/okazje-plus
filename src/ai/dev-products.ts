import { config } from 'dotenv';
config();

import { fillCategoriesWithProducts } from '@/ai/flows/fillCategoriesWithProducts';

async function run() {
  console.log('\n[dev-products] Start: pełne wypełnianie katalogu z AI enrichment...');
  const t0 = Date.now();
  try {
    const summary = await fillCategoriesWithProducts();
    const ms = Date.now() - t0;
    console.log('\n[dev-products] Zakończono w', ms + 'ms');
    console.log('\n===== PODSUMOWANIE =====\n' + summary + '\n========================\n');
  } catch (e: any) {
    console.error('[dev-products] Błąd krytyczny:', e?.message || e);
    process.exitCode = 1;
  }
}

run();