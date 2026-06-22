import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local synchronously before importing anything else
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Now run the main query using dynamic import
async function main() {
  const { getDealsByFiltersData } = await import('../src/lib/data/deals');
  try {
    console.log("Firebase Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    console.log("Calling getDealsByFiltersData with statusFilter: 'approved'...");
    const res = await getDealsByFiltersData({
      priceRange: { min: 0, max: 15000 },
      priceLimitMin: 0,
      priceLimitMax: 50000,
      rating: undefined,
      availability: 'all' as any,
      statusFilter: 'approved'
    }, 'hot', 100);
    console.log(`getDealsByFiltersData returned ${res.length} deals`);
    if (res.length > 0) {
      console.log("First 3 deals:");
      res.slice(0, 3).forEach(deal => {
        console.log(`- ID: ${deal.id}, Title: ${typeof deal.title === 'object' ? JSON.stringify(deal.title) : deal.title}, Price: ${JSON.stringify(deal.price)}`);
      });
    }
  } catch (err) {
    console.error("Error in getDealsByFiltersData:", err);
  }
}

main();
