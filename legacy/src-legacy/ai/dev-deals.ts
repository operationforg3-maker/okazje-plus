import { config } from 'dotenv';
config();

import { fillCategoriesWithDeals } from '@/ai/flows/fillCategoriesWithDeals';

async function run() {
  console.log('\n[dev-deals] Startowanie normalizacji i pobierania deali >50% zniżki...');
  const start = Date.now();
  try {
    const summary = await fillCategoriesWithDeals();
    const ms = Date.now() - start;
    console.log('\n[dev-deals] Zakończono w', ms + 'ms');
    console.log('\n===== PODSUMOWANIE =====\n' + summary + '\n========================\n');
  } catch (e: any) {
    console.error('[dev-deals] Błąd krytyczny:', e?.message || e);
    process.exitCode = 1;
  }
}

run();
