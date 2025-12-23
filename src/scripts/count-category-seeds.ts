import { CATEGORY_SEEDS } from '@/lib/category-seeds';

function countSeeds() {
  let mainCount = 0;
  let subCount = 0;
  let subSubCount = 0;

  for (const main of CATEGORY_SEEDS) {
    mainCount++;
    const subs = main.subcategories || [];
    for (const sub of subs) {
      subCount++;
      const subsubs = sub.subcategories || [];
      subSubCount += subsubs.length;
    }
  }

  return { mainCount, subCount, subSubCount, total: mainCount + subCount + subSubCount };
}

const res = countSeeds();
console.log('📊 CATEGORY_SEEDS counts:');
console.log(`  Main: ${res.mainCount}`);
console.log(`  Sub: ${res.subCount}`);
console.log(`  Sub-Sub: ${res.subSubCount}`);
console.log(`  Total documents (if seeded): ${res.total}`);
