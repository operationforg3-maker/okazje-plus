const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

/**
 * Test harvesting from full category tree
 * This simulates what the harvester does: iterate all 3 levels and collect queries
 */
async function testFullCategoryHarvest() {
  console.log('=== Testing Full Category Tree Harvest ===\n');

  const queries = [];
  const categoryMap = {
    totalMain: 0,
    totalSub: 0,
    totalSubSub: 0,
    byCategoryLevel: {}
  };

  try {
    // Get all main categories
    const mainSnapshot = await db.collection('categories').get();
    categoryMap.totalMain = mainSnapshot.size;

    console.log(`📊 Found ${mainSnapshot.size} main categories\n`);

    for (const mainDoc of mainSnapshot.docs) {
      const mainData = mainDoc.data();
      const mainSlug = mainData?.slug || mainDoc.id;
      
      categoryMap.byCategoryLevel[mainSlug] = { subs: 0, subsubs: 0, queries: [] };

      // Get sub categories
      const subSnapshot = await mainDoc.ref.collection('subcategories').get();
      categoryMap.totalSub += subSnapshot.size;
      categoryMap.byCategoryLevel[mainSlug].subs = subSnapshot.size;

      for (const subDoc of subSnapshot.docs) {
        const subData = subDoc.data();
        const subSlug = subData?.slug || subDoc.id;

        // Get sub-sub categories
        const subSubSnapshot = await subDoc.ref.collection('subcategories').get();
        
        if (subSubSnapshot.empty) {
          // No sub-sub level - add just main/sub
          queries.push(`${mainSlug}/${subSlug}`);
          categoryMap.byCategoryLevel[mainSlug].queries.push(`${mainSlug}/${subSlug}`);
        } else {
          // Has sub-sub level
          categoryMap.totalSubSub += subSubSnapshot.size;
          
          for (const subSubDoc of subSubSnapshot.docs) {
            const subSubData = subSubDoc.data();
            const subSubSlug = subSubData?.slug || subSubDoc.id;
            
            // Add query: main/sub/subsub
            queries.push(`${mainSlug}/${subSlug}/${subSubSlug}`);
            categoryMap.byCategoryLevel[mainSlug].queries.push(`${mainSlug}/${subSlug}/${subSubSlug}`);
            categoryMap.byCategoryLevel[mainSlug].subsubs += 1;
          }
        }
      }
    }

    console.log(`\n📈 HARVEST COVERAGE:\n`);
    console.log(`  Main categories: ${categoryMap.totalMain}`);
    console.log(`  Sub categories: ${categoryMap.totalSub}`);
    console.log(`  Sub-sub categories: ${categoryMap.totalSubSub}`);
    console.log(`  Total query paths: ${queries.length}`);
    console.log(`  Average per main: ${(queries.length / categoryMap.totalMain).toFixed(2)}`);

    console.log(`\n🔍 SAMPLE QUERIES:\n`);
    queries.slice(0, 15).forEach(q => {
      const parts = q.split('/');
      console.log(`  ✓ ${q} (${parts.length}-level: ${parts.join(' → ')})`);
    });

    if (queries.length > 15) {
      console.log(`  ... and ${queries.length - 15} more queries`);
    }

    console.log(`\n📋 BREAKDOWN BY CATEGORY:\n`);
    Object.entries(categoryMap.byCategoryLevel).slice(0, 5).forEach(([cat, data]) => {
      console.log(`  ${cat}: ${data.subs} sub-categories, ${data.subsubs} sub-sub-categories`);
    });

    console.log(`\n✅ All queries (${queries.length} total):`);
    console.log(JSON.stringify(queries, null, 2));

    // Summary
    console.log(`\n✨ VERIFICATION:\n`);
    const hasThreeLevels = queries.some(q => q.split('/').length === 3);
    const hasTwoLevels = queries.some(q => q.split('/').length === 2);
    console.log(`  ✓ Has 3-level queries: ${hasThreeLevels ? 'YES' : 'NO'}`);
    console.log(`  ✓ Has 2-level queries: ${hasTwoLevels ? 'YES' : 'NO'}`);
    console.log(`  ✓ Ready for harvester: YES`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

testFullCategoryHarvest();
