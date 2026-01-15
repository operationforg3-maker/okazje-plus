const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function checkCategories() {
  console.log('=== M6 CATEGORY STRUCTURE CHECK ===\n');
  
  const snapshot = await db.collection('categories').limit(100).get();
  
  if (snapshot.empty) {
    console.log('❌ No categories found in Firestore');
    process.exit(1);
  }

  console.log(`Found ${snapshot.size} categories:\n`);

  const categoryLevels = {
    main: [],
    sub: [],
    subsub: []
  };

  const languages = new Set();

  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Check language support
    if (data.label && typeof data.label === 'object') {
      Object.keys(data.label).forEach(lang => languages.add(lang));
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
  
  console.log(`\n🌍 SUPPORTED LANGUAGES: ${Array.from(languages).sort().join(', ')}`);
  console.log(`   Expected: de, en, pl\n`);

  // Show sample from each level
  if (categoryLevels.main.length > 0) {
    console.log(`📌 SAMPLE MAIN CATEGORY:\n`);
    const sample = categoryLevels.main[0];
    console.log(`  Slug: ${sample.slug}`);
    console.log(`  Label:`, JSON.stringify(sample.label, null, 2));
    console.log();
  }

  if (categoryLevels.sub.length > 0) {
    console.log(`📌 SAMPLE SUB CATEGORY:\n`);
    const sample = categoryLevels.sub[0];
    console.log(`  Slug: ${sample.slug}`);
    console.log(`  Parent: ${sample.parent}`);
    console.log(`  Label:`, JSON.stringify(sample.label, null, 2));
    console.log();
  }

  if (categoryLevels.subsub.length > 0) {
    console.log(`📌 SAMPLE SUB-SUB CATEGORY:\n`);
    const sample = categoryLevels.subsub[0];
    console.log(`  Slug: ${sample.slug}`);
    console.log(`  Parent: ${sample.parent}`);
    console.log(`  Label:`, JSON.stringify(sample.label, null, 2));
    console.log();
  }

  console.log(`\n✅ VERIFICATION SUMMARY:\n`);
  const has3levels = categoryLevels.main.length > 0 && categoryLevels.sub.length > 0 && categoryLevels.subsub.length > 0;
  const has3langs = languages.size >= 3;
  console.log(`  ✓ Has 3 category levels: ${has3levels ? 'YES' : 'NO'}`);
  console.log(`  ✓ Has multi-language labels: ${has3langs ? 'YES (' + Array.from(languages).sort().join(', ') + ')' : 'NO'}`);

  // Show full tree for first main category
  if (categoryLevels.main.length > 0) {
    const firstMain = categoryLevels.main[0];
    const subCats = categoryLevels.sub.filter(c => c.parent === firstMain.slug);
    console.log(`\n📈 FULL TREE SAMPLE (${firstMain.slug}):\n`);
    console.log(`  ${firstMain.slug}`);
    subCats.slice(0, 3).forEach(sub => {
      const subSubCats = categoryLevels.subsub.filter(c => c.parent === sub.slug);
      console.log(`    ├─ ${sub.slug}`);
      subSubCats.slice(0, 2).forEach((subsub, i) => {
        console.log(`    │  ${i === Math.min(1, subSubCats.length - 1) ? '└' : '├'}─ ${subsub.slug}`);
      });
    });
  }

  process.exit(0);
}

checkCategories().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
