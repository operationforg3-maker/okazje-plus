/**
 * Test to see ACTUAL product data structure from AliExpress
 * Run in Node context like Cloud Functions to simulate real import
 */

// Simulate one batch from stageFetch
const mockProducts = [
  {
    id: '123',
    title: 'Test Product',
    image: 'https://example.com/image.jpg',
    price: 50,
    rating: undefined, // ← POSSIBLY undefined!
    orders: 0,         // ← POSSIBLY 0!
    link: 'https://example.com/product',
    currency: 'USD'
  },
  {
    id: '456',
    title: 'Another Product',
    image: 'https://example.com/image2.jpg',
    price: 100,
    rating: 0,         // ← POSSIBLY 0!
    orders: undefined, // ← POSSIBLY undefined!
    link: 'https://example.com/product2',
    currency: 'USD'
  }
];

// Test dedupe config (from route.ts line 340)
const config = {
  minPrice: 5,
  maxPrice: 10000,
  minRating: 2.5,
  minOrders: 10
};

console.log('\n=== Testing Dedupe Filters ===\n');
console.log('Config:', config);
console.log('\nProducts:');

mockProducts.forEach((product, idx) => {
  console.log(`\n--- Product ${idx + 1} ---`);
  console.log(`ID: ${product.id}`);
  console.log(`Title: ${product.title}`);
  console.log(`Price: ${product.price}`);
  console.log(`Rating: ${product.rating}`);
  console.log(`Orders: ${product.orders}`);
  
  // Test filters
  const passPrice = product.price >= config.minPrice && product.price <= config.maxPrice;
  const passRating = config.minRating !== undefined && product.rating && product.rating >= config.minRating;
  const passOrders = config.minOrders !== undefined && product.orders && product.orders >= config.minOrders;
  
  console.log(`\nFilter Results:`);
  console.log(`  Price filter (${config.minPrice}-${config.maxPrice}): ${passPrice ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Rating filter (>=${config.minRating}): ${passRating ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Orders filter (>=${config.minOrders}): ${passOrders ? '✅ PASS' : '❌ FAIL'}`);
  
  const finalPass = passPrice && passRating && passOrders;
  console.log(`\nFinal: ${finalPass ? '✅ PRODUCT KEPT' : '❌ PRODUCT FILTERED OUT'}`);
});

console.log('\n\n=== DIAGNOSIS ===\n');
console.log('If products have:');
console.log('  - rating: undefined or 0 → FAILS rating filter');
console.log('  - orders: undefined or < 10 → FAILS orders filter');
console.log('\nFIX OPTIONS:');
console.log('  1. Lower minRating to 0 or remove rating filter');
console.log('  2. Lower minOrders to 0 or remove orders filter');
console.log('  3. Ensure AliExpress API returns rating/orders data');
console.log('  4. Make filters optional only when data exists');
console.log('');
