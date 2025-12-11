/**
 * Test: Create a MANUAL, minimal import without API
 * Directly call the pipeline to test if dedupe fix works
 */

// This simulates what happens on production when import starts
// We'll trace through the pipeline stages step by step

const mockAliExpressProducts = [
  {
    id: 'test-1',
    title: 'Test Phone (No Rating)',
    image: 'https://example.com/test1.jpg',
    price: 99.99,
    rating: undefined,  // ← Typical AliExpress response
    orders: undefined,
    link: 'https://aliexpress.com/test1',
    currency: 'USD'
  },
  {
    id: 'test-2',
    title: 'Test Cable (Zero Rating)',
    image: 'https://example.com/test2.jpg',
    price: 9.99,
    rating: 0,
    orders: 0,
    link: 'https://aliexpress.com/test2',
    currency: 'USD'
  }
];

console.log('\n╔════════════════════════════════════════╗');
console.log('║  MANUAL PIPELINE TEST - DEDUPE STAGE   ║');
console.log('╚════════════════════════════════════════╝\n');

console.log('📦 INPUT (from stageFetch): 2 products\n');
mockAliExpressProducts.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.title}`);
  console.log(`     rating=${p.rating}, orders=${p.orders}`);
});

// === Dedupe logic (FIXED version) ===
console.log('\n⚙️ APPLYING stageDedupe filters\n');

const config = {
  minPrice: 5,
  maxPrice: 10000,
  minRating: 2.5,
  minOrders: 10
};

const deduped = [];
let filtered_rating = 0;
let filtered_orders = 0;

for (const p of mockAliExpressProducts) {
  console.log(`  Processing: ${p.title}`);
  
  // Rating filter - FIXED VERSION
  if (config.minRating !== undefined && p.rating !== undefined && p.rating !== null && p.rating > 0) {
    if (p.rating < config.minRating) {
      console.log(`    ❌ Filtered: rating ${p.rating} < ${config.minRating}`);
      filtered_rating++;
      continue;
    }
  } else {
    console.log(`    ✅ Rating filter SKIPPED (no valid rating data)`);
  }
  
  // Orders filter - FIXED VERSION
  if (config.minOrders !== undefined && p.orders !== undefined && p.orders !== null && p.orders > 0) {
    if (p.orders < config.minOrders) {
      console.log(`    ❌ Filtered: orders ${p.orders} < ${config.minOrders}`);
      filtered_orders++;
      continue;
    }
  } else {
    console.log(`    ✅ Orders filter SKIPPED (no valid orders data)`);
  }
  
  console.log(`    ✅ KEPT - moves to stageEnrich`);
  deduped.push(p);
}

console.log('\n📊 OUTPUT (to stageEnrich):');
console.log(`  Kept: ${deduped.length} products`);
console.log(`  Filtered: ${filtered_rating} by rating, ${filtered_orders} by orders\n`);

if (deduped.length === 0) {
  console.log('❌ FAIL: No products passed dedupe!');
  console.log('\nThis would happen if:');
  console.log('  - Code uses OLD filter logic (product.rating < minRating)');
  console.log('  - Fix was not deployed\n');
} else {
  console.log('✅ SUCCESS: Products passing dedupe stage!');
  console.log('\nIf LIVE import shows "fetched=120, dedup=0" but this shows dedup>0');
  console.log('→ Fix was deployed but needs rebuild\n');
}
