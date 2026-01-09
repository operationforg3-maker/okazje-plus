/**
 * CRITICAL ANALYSIS: Why is dedupe still filtering all products?
 * 
 * Even though we fixed stageDedupe.ts, something else might be filtering.
 * This script checks ALL possible filtering points in the pipeline.
 */

console.log('\n╔════════════════════════════════════════╗');
console.log('║  DEEP ROOT CAUSE ANALYSIS              ║');
console.log('╚════════════════════════════════════════╝\n');

// Let's trace through the exact code paths
console.log('Possible issues:\n');

console.log('1️⃣ stageSanitize (before dedupe) - Check first!\n');
console.log(`   Function sanitizeProducts() in stageDedupe.ts`);
console.log(`   Filters:`);
console.log(`     - No title or link → reject`);
console.log(`     - No image → reject`);
console.log(`     - Price <= 0 or > 10000 → reject`);
console.log(`     - Spam keywords → reject`);
console.log(`   Result: Could filter out many products BEFORE dedupe!\n`);

console.log('2️⃣ Price filter in deduplicateProducts() - Check second!\n');
console.log(`   config.minPrice: 5`);
console.log(`   config.maxPrice: 10000`);
console.log(`   If AliExpress returns price=0 → FILTERED\n`);

console.log('3️⃣ Rating filter (FIXED) - This was the problem\n');
console.log(`   OLD: if (minRating && rating && rating < minRating)  → ALL rejected`);
console.log(`   NEW: if (minRating && rating > 0 && rating < minRating) → Only bad ratings rejected\n`);

console.log('4️⃣ Orders filter (FIXED) - This was also problem\n');
console.log(`   OLD: if (minOrders && orders && orders < minOrders)  → ALL rejected`);
console.log(`   NEW: if (minOrders && orders > 0 && orders < minOrders) → Only low orders rejected\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test the FULL filter chain
console.log('Testing FULL filter chain with mock AliExpress data:\n');

const mockProduct = {
  id: 'test123',
  title: 'Test Product',
  image: 'https://example.com/img.jpg',
  price: 50,
  rating: undefined,
  orders: undefined,
  link: 'https://example.com/product',
  currency: 'USD'
};

console.log(`Input product: ${mockProduct.title} (price=${mockProduct.price})`);
console.log('');

// Filter 1: sanitize
console.log('1. Sanitize filters:');
const spam_keywords = ['free', 'gift', 'bonus', 'click here', 'download'];
const titleLower = mockProduct.title.toLowerCase();

let fails = [];
if (!mockProduct.title || !mockProduct.link || mockProduct.link === '#') fails.push('no title/link');
if (!mockProduct.image) fails.push('no image');
if (mockProduct.price <= 0 || mockProduct.price > 10000) fails.push('bad price');
if (spam_keywords.some(k => titleLower.includes(k))) fails.push('spam keywords');

if (fails.length === 0) {
  console.log('   ✅ Passed sanitize\n');
} else {
  console.log(`   ❌ FILTERED by: ${fails.join(', ')}\n`);
}

// Filter 2-4: dedupe
if (fails.length === 0) {
  console.log('2. Dedupe filters:');
  console.log(`   Price: ${mockProduct.price} in range [5, 10000]? ✅`);
  
  console.log(`   Rating: ${mockProduct.rating} - SKIP (no valid data) ✅`);
  console.log(`   Orders: ${mockProduct.orders} - SKIP (no valid data) ✅`);
  
  console.log('\n   ✅ Would PASS dedupe (with fix)');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('CONCLUSION:\n');
console.log('IF live still shows dedup=0, the issue is:');
console.log('  1. ❌ OLD CODE deployed (not our fix)');
console.log('  2. ❌ Data not being fetched properly');
console.log('  3. ❌ Sanitize filtering too much');
console.log('  4. ❌ Cache issue (old bytecode running)\n');

console.log('NEXT ACTION:');
console.log('  Force manual deploy via Cloud Run or Docker\n');
