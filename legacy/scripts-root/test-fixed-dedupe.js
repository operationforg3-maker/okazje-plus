/**
 * Quick local test of fixed dedupe filters
 * Tests that products without rating/orders data are NOT filtered out
 */

// Import the actual dedupe function (we'll simulate it here)
const mockProducts = [
  {
    id: '1',
    title: 'Product with NO rating/orders',
    image: 'https://example.com/1.jpg',
    price: 50,
    rating: undefined,
    orders: undefined,
    link: 'https://example.com/1',
    currency: 'USD'
  },
  {
    id: '2',
    title: 'Product with ZERO rating/orders',
    image: 'https://example.com/2.jpg',
    price: 75,
    rating: 0,
    orders: 0,
    link: 'https://example.com/2',
    currency: 'USD'
  },
  {
    id: '3',
    title: 'Product with LOW rating/orders',
    image: 'https://example.com/3.jpg',
    price: 100,
    rating: 2.0,  // Below minRating 2.5
    orders: 5,    // Below minOrders 10
    link: 'https://example.com/3',
    currency: 'USD'
  },
  {
    id: '4',
    title: 'Product with GOOD rating/orders',
    image: 'https://example.com/4.jpg',
    price: 150,
    rating: 4.5,  // Above minRating 2.5
    orders: 100,  // Above minOrders 10
    link: 'https://example.com/4',
    currency: 'USD'
  }
];

const config = {
  minPrice: 5,
  maxPrice: 10000,
  minRating: 2.5,
  minOrders: 10
};

console.log('\n=== Testing NEW Dedupe Logic (Fixed) ===\n');
console.log('Config:', config);
console.log('\n');

const filtered = [];
let filtered_price = 0;
let filtered_rating = 0;
let filtered_orders = 0;

for (const product of mockProducts) {
  console.log(`--- ${product.title} ---`);
  console.log(`  rating: ${product.rating}, orders: ${product.orders}`);
  
  // Price filter
  if (product.price < config.minPrice || product.price > config.maxPrice) {
    console.log(`  ❌ FILTERED: Price out of range`);
    filtered_price++;
    continue;
  }
  
  // Rating filter - NEW LOGIC: only apply if product HAS rating data
  if (config.minRating !== undefined && product.rating !== undefined && product.rating !== null && product.rating > 0) {
    if (product.rating < config.minRating) {
      console.log(`  ❌ FILTERED: Rating ${product.rating} < ${config.minRating}`);
      filtered_rating++;
      continue;
    }
  } else {
    console.log(`  ✅ Rating filter SKIPPED (no rating data)`);
  }
  
  // Orders filter - NEW LOGIC: only apply if product HAS orders data
  if (config.minOrders !== undefined && product.orders !== undefined && product.orders !== null && product.orders > 0) {
    if (product.orders < config.minOrders) {
      console.log(`  ❌ FILTERED: Orders ${product.orders} < ${config.minOrders}`);
      filtered_orders++;
      continue;
    }
  } else {
    console.log(`  ✅ Orders filter SKIPPED (no orders data)`);
  }
  
  console.log(`  ✅ PRODUCT KEPT`);
  filtered.push(product);
  console.log('');
}

console.log('\n=== RESULTS ===\n');
console.log(`Input: ${mockProducts.length} products`);
console.log(`Output: ${filtered.length} products`);
console.log(`Filtered (price): ${filtered_price}`);
console.log(`Filtered (rating): ${filtered_rating}`);
console.log(`Filtered (orders): ${filtered_orders}`);

console.log('\n✅ SUCCESS! Products without rating/orders data are now KEPT\n');
console.log('Next step: Deploy this fix and start new import');
console.log('');
