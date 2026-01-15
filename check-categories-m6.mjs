import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function checkCategories() {
  console.log('=== M6 CATEGORY STRUCTURE CHECK ===\n');
  
  const snapshot = await db.collection('categories').limit(20).get();
  
  if (snapshot.empty) {
    console.log('❌ No categories found in Firestore');
    process.exit(1);
  }

  console.log(`Found ${snapshot.size} categories (showing first 20):\n`);

  const categoryLevels = {
    main: [],
    sub: [],
    subsub: []
  };

  const languages = new Set();

  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Check language support
    if (data.label) {
      if (typeof data.label === 'object') {
        Object.keys(data.label).forEach(lang => languages.add(lang));
      }
    }

    // Categorize by level
    if (data.parentSlug) {
      if (data.parentSlug.includes('_sub_')) {
        categoryLevels.subsub.push({
          id: doc.id,
          slug: data.slug,
          label: data.label,
          parent: data.parentSlug,
          level: 'subsub'
        });
      } else {
        categoryLevels.sub.push({
          id: doc.id,
          slug: data.slug,
          label: data.label,
          parent: data.parentSlug,
          level: 'sub'
        });
      }
    } else {
      categoryLevels.main.push({
        id: doc.id,
        slug: data.slug,
        label: data.label,
        level: 'main'
      });
    }
  });

  console.log(`📊 CATEGORY LEVELS:\n`);
  console.log(`  Main categories: ${categoryLevels.main.length}`);
  console.log(`  Sub categories: ${categoryLevels.sub.length}`);
  console.log(`  Sub-sub categories: ${categoryLevels.subsub.length}`);
  
  console.log(`\n🌍 SUPPORTED LANGUAGES: ${Array.from(languages).join(', ')}`);
  console.log(`   Expected: pl, en, de\n`);

  // Show sample from each level
  if (categoryLevels.main.length > 0) {
    console.log(`📌 SAMPLE MAIN CATEGORY:\n`);
    const sample = categoryLevels.main[0];
    console.log(`  Slug: ${sample.slug}`);
    console.log(`  Label:`, sample.label);
    console.log();
  }

  if (categoryLevels.sub.length > 0) {
    console.log(`📌 SAMPLE SUB CATEGORY:\n`);
    const sample = categoryLevels.sub[0];
    console.log(`  Slug: ${sample.slug}`);
    console.log(`  Parent: ${sample.parent}`);
    console.log(`  Label:`, sample.label);
    console.log();
  }

  if (categoryLevels.subsub.length > 0) {
    console.log(`📌 SAMPLE SUB-SUB CATEGORY:\n`);
    const sample = categoryLevels.subsub[0];
    console.log(`  Slug: ${sample.slug}`);
    console.log(`  Parent: ${sample.parent}`);
    console.log(`  Label:`, sample.label);
    console.log();
  }

  // Check if any category has all 3 levels in hierarchy
  console.log(`\n✅ VERIFICATION SUMMARY:\n`);
  console.log(`  Has 3 category levels: ${categoryLevels.main.length > 0 && categoryLevels.sub.length > 0 && categoryLevels.subsub.length > 0 ? '✓ YES' : '✗ NO'}`);
  console.log(`  Has multi-language labels: ${languages.size >= 3 ? '✓ YES (' + Array.from(languages).join(', ') + ')' : '✗ NO (needs: pl, en, de)'}`);

  // Show full tree for first main category
  if (categoryLevels.main.length > 0) {
    const firstMain = categoryLevels.main[0];
    const subCats = categoryLevels.sub.filter(c => c.parent === firstMain.slug);
    console.log(`\n📈 FULL TREE SAMPLE (${firstMain.slug}):\n`);
    console.log(`  ${firstMain.slug}`);
    subCats.forEach(sub => {
      const subSubCats = categoryLevels.subsub.filter(c => c.parent === sub.slug);
      console.log(`    ├─ ${sub.slug}`);
      subSubCats.forEach((subsub, i) => {
        console.log(`    │  ${i === subSubCats.length - 1 ? '└' : '├'}─ ${subsub.slug}`);
      });
    });
  }

  process.exit(0);
}

checkCategories().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
