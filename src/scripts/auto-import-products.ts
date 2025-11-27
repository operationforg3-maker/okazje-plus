/**
 * Auto Import Products for All Categories
 * 
 * Automatically creates import profiles and runs imports
 * for all sub-subcategories with AliExpress keywords
 */

import { adminDb } from '../lib/firebase-admin';
import { ImportProfile } from '../lib/types';

interface ImportJob {
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug: string;
  subSubCategoryName: string;
  keywords: string[];
}

async function getAllSubSubCategories(): Promise<ImportJob[]> {
  const jobs: ImportJob[] = [];
  
  const categoriesSnap = await adminDb.collection('categories').get();
  
  for (const catDoc of categoriesSnap.docs) {
    const mainSlug = catDoc.id;
    
    const subCatsSnap = await catDoc.ref.collection('subcategories').get();
    
    for (const subCatDoc of subCatsSnap.docs) {
      const subSlug = subCatDoc.id;
      
      const subSubCatsSnap = await subCatDoc.ref.collection('subcategories').get();
      
      for (const subSubCatDoc of subSubCatsSnap.docs) {
        const data = subSubCatDoc.data();
        const keywords = data.aliexpressKeywords || [];
        
        if (keywords.length > 0) {
          jobs.push({
            mainCategorySlug: mainSlug,
            subCategorySlug: subSlug,
            subSubCategorySlug: subSubCatDoc.id,
            subSubCategoryName: data.name,
            keywords,
          });
        }
      }
    }
  }
  
  return jobs;
}

async function createImportProfile(job: ImportJob, maxItems: number = 20): Promise<string> {
  const profileData: Omit<ImportProfile, 'id'> = {
    name: `Auto: ${job.subSubCategoryName}`,
    vendorId: 'aliexpress',
    enabled: true,
    schedule: undefined, // Manual scheduling
    filters: {
      searchQuery: job.keywords[0], // Primary keyword
      minPrice: 10,
      maxPrice: 1000,
      minRating: 4.0,
      minDiscount: 20,
      shippingType: 'free',
    },
    mapping: {
      targetMainCategory: job.mainCategorySlug,
      targetSubCategory: job.subCategorySlug,
      targetSubSubCategory: job.subSubCategorySlug,
      priceMarkup: 1.0,
      defaultStatus: 'approved',
    },
    maxItemsPerRun: maxItems,
    deduplicationStrategy: 'skip',
    createdBy: 'system-auto-import',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const docRef = await adminDb.collection('importProfiles').add(profileData);
  return docRef.id;
}

async function triggerImport(profileId: string): Promise<void> {
  // Note: This would normally call the API endpoint
  // For now, we'll just create the profile
  console.log(`   ⏳ Import profile created: ${profileId}`);
  console.log(`   👉 Run manually via: POST /api/admin/products/ingest { "profileId": "${profileId}" }`);
}

async function autoImportProducts(options: {
  maxItemsPerCategory?: number;
  dryRun?: boolean;
  limitCategories?: number;
}) {
  const { maxItemsPerCategory = 20, dryRun = false, limitCategories } = options;
  
  console.log('🚀 Auto Import Products - Starting...\n');
  console.log(`Options:`);
  console.log(`  - Max items per category: ${maxItemsPerCategory}`);
  console.log(`  - Dry run: ${dryRun}`);
  console.log(`  - Limit categories: ${limitCategories || 'none'}\n`);
  
  // Step 1: Get all sub-subcategories with keywords
  console.log('📋 Scanning categories...');
  const jobs = await getAllSubSubCategories();
  
  const jobsToProcess = limitCategories ? jobs.slice(0, limitCategories) : jobs;
  
  console.log(`✅ Found ${jobs.length} sub-subcategories total`);
  console.log(`🎯 Processing ${jobsToProcess.length} sub-subcategories\n`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN - No profiles will be created\n');
    jobsToProcess.forEach((job, idx) => {
      console.log(`${idx + 1}. ${job.subSubCategoryName}`);
      console.log(`   📍 ${job.mainCategorySlug} > ${job.subCategorySlug} > ${job.subSubCategorySlug}`);
      console.log(`   🔑 Keywords: ${job.keywords.join(', ')}`);
      console.log(`   📦 Would import ~${maxItemsPerCategory} products\n`);
    });
    return;
  }
  
  // Step 2: Create import profiles
  const profileIds: string[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (const [idx, job] of jobsToProcess.entries()) {
    try {
      console.log(`\n[${idx + 1}/${jobsToProcess.length}] Processing: ${job.subSubCategoryName}`);
      console.log(`   📍 Category: ${job.mainCategorySlug} > ${job.subCategorySlug} > ${job.subSubCategorySlug}`);
      console.log(`   🔑 Primary keyword: "${job.keywords[0]}"`);
      
      const profileId = await createImportProfile(job, maxItemsPerCategory);
      profileIds.push(profileId);
      
      await triggerImport(profileId);
      
      successCount++;
      
      // Rate limiting - wait between requests
      if (idx < jobsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Auto Import Setup Completed!\n');
  console.log(`Summary:`);
  console.log(`  - Profiles created: ${successCount}`);
  console.log(`  - Errors: ${errorCount}`);
  console.log(`  - Total categories: ${jobsToProcess.length}\n`);
  
  if (profileIds.length > 0) {
    console.log('📝 Next steps:');
    console.log('1. Review import profiles in Admin Panel → AliExpress Import');
    console.log('2. Trigger imports via API or Admin UI');
    console.log('3. Monitor import runs in Admin Panel\n');
    
    console.log('💡 Quick import all (via API):');
    console.log('```bash');
    profileIds.slice(0, 5).forEach(id => {
      console.log(`curl -X POST /api/admin/products/ingest -d '{"profileId":"${id}"}'`);
    });
    if (profileIds.length > 5) {
      console.log(`# ... and ${profileIds.length - 5} more`);
    }
    console.log('```\n');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: Parameters<typeof autoImportProducts>[0] = {
    maxItemsPerCategory: 20,
    dryRun: false,
    limitCategories: undefined,
  };
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--max-items' || arg === '-m') {
      options.maxItemsPerCategory = parseInt(args[++i], 10);
    } else if (arg === '--limit' || arg === '-l') {
      options.limitCategories = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Auto Import Products for All Categories

Usage:
  npm run auto-import [options]

Options:
  -d, --dry-run          Preview without creating profiles
  -m, --max-items NUM    Max products per category (default: 20)
  -l, --limit NUM        Limit number of categories to process
  -h, --help             Show this help message

Examples:
  npm run auto-import --dry-run
  npm run auto-import --max-items 50 --limit 10
  npm run auto-import
`);
      process.exit(0);
    }
  }
  
  autoImportProducts(options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export { autoImportProducts, getAllSubSubCategories };
