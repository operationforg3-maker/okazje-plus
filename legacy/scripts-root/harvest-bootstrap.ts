import { SmartHarvester } from '@/lib/automation/harvester';

async function main() {
  try {
    console.log('🌾 M6 Harvest Bootstrap\n');
    
    const jobId = `harvest_m6_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const harvester = new SmartHarvester(jobId);
    
    // Direct harvest from common categories (skip buildCategoryQueries)
    const queries = [
      'electronics/smartphone/smartphone',
      'electronics/komputery/laptop',
      'electronics/audio-video/headphones',
      'home-garden/meble/sofa',
      'fashion/odziez-damska/dress'
    ];
    
    console.log(`🚀 Harvesting from ${queries.length} categories (40 products each)...\n`);
    
    const job = await harvester.harvestProducts(
      'aliexpress',
      'products',
      40,
      queries,
      true // tree mode
    );
    
    console.log(`\n✅ Harvest Complete!`);
    console.log(`   Products Created: ${job.productsCreated}`);
    console.log(`   Deals Created: ${job.dealsCreated}`);
    console.log(`   Duplicates Skipped: ${job.duplicatesSkipped}`);
    console.log(`   Errors: ${job.errors.length}\n`);
    
    if (job.errors.length > 0) {
      console.log(`⚠️ Top 5 errors:`);
      job.errors.slice(0, 5).forEach(err => console.log(`   - ${err.message}`));
    }
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
