#!/usr/bin/env node
/**
 * Simple Import Test Script
 * 
 * Tests the import pipeline end-to-end with minimal complexity
 * Usage: node test-import-simple.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

console.log('🧪 Simple Import Test - Starting...\n');

// Initialize Firebase Admin
let app;
try {
  const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
  app = initializeApp({
    credential: cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized\n');
} catch (e) {
  console.error('❌ Failed to load serviceAccountKey.json:', e.message);
  console.error('   Make sure serviceAccountKey.json exists in project root');
  process.exit(1);
}

const db = getFirestore(app);

/**
 * Test 1: Check if categories exist
 */
async function testCategories() {
  console.log('📂 Test 1: Checking categories...');
  
  try {
    const categoriesSnap = await db.collection('categories').limit(5).get();
    console.log(`   ✅ Found ${categoriesSnap.size} categories`);
    
    if (categoriesSnap.empty) {
      console.log('   ⚠️  No categories in database - import cannot work!');
      return false;
    }
    
    // Check for subcategories
    const firstCat = categoriesSnap.docs[0];
    const subSnap = await firstCat.ref.collection('subcategories').limit(1).get();
    
    if (subSnap.empty) {
      console.log('   ⚠️  No subcategories found - import needs subcategories!');
      return false;
    }
    
    console.log(`   ✅ Categories structure OK\n`);
    return true;
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

/**
 * Test 2: Try to create a simple product directly
 */
async function testDirectProductCreation() {
  console.log('📦 Test 2: Creating test product directly...');
  
  try {
    const testProduct = {
      name: 'Test Product - Simple Import',
      title: { pl: 'Test Product - Simple Import', en: 'Test Product - Simple Import' },
      description: 'This is a test product created to verify import functionality',
      shortDescription: { pl: 'Test opis', en: 'Test description' },
      longDescription: 'This is a test product created to verify import functionality',
      fullDescription: { pl: 'Pełny opis testowy', en: 'Full test description' },
      price: {
        amount: 99.99,
        currency: 'PLN',
        shippingCost: 0,
        totalPrice: 99.99,
        lastUpdated: new Date().toISOString(),
      },
      image: 'https://via.placeholder.com/300',
      imageHint: 'Test product image',
      affiliateUrl: 'https://example.com/test',
      mainCategorySlug: 'test-category',
      subCategorySlug: 'test-subcategory',
      status: 'approved',
      currency: 'PLN',
      ratingCard: {
        score: 0,
        count: 0,
      },
      temperature: 0,
      upvotes: 0,
      downvotes: 0,
      views: 0,
      clicks: 0,
      shares: 0,
      commentsCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      metadata: {
        source: 'test',
        testImport: true,
      },
    };
    
    const docRef = await db.collection('products').add(testProduct);
    console.log(`   ✅ Created test product: ${docRef.id}`);
    
    // Clean up - delete test product
    await docRef.delete();
    console.log(`   ✅ Cleaned up test product\n`);
    
    return true;
  } catch (error) {
    console.error('   ❌ Error creating product:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

/**
 * Test 3: Check API configuration
 */
async function testAPIConfiguration() {
  console.log('🔌 Test 3: Checking API configuration...');
  
  const requiredEnvVars = {
    aliexpress: ['ALIEXPRESS_APP_KEY', 'ALIEXPRESS_APP_SECRET', 'ALIEXPRESS_API_BASE'],
    convertiser: ['CONVERTISER_API_TOKEN'],
  };
  
  let allConfigured = true;
  
  for (const [source, vars] of Object.entries(requiredEnvVars)) {
    const missing = vars.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
      console.log(`   ⚠️  ${source.toUpperCase()} not configured - missing: ${missing.join(', ')}`);
      allConfigured = false;
    } else {
      console.log(`   ✅ ${source.toUpperCase()} configured`);
    }
  }
  
  if (!allConfigured) {
    console.log('\n   ℹ️  Without API credentials, import will fail at Stage 1 (Fetch)');
    console.log('   ℹ️  Add credentials to .env.local or Firebase secrets');
  }
  
  console.log('');
  return allConfigured;
}

/**
 * Test 4: Check recent import jobs
 */
async function testImportJobs() {
  console.log('📊 Test 4: Checking import jobs...');
  
  try {
    const jobsSnap = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    
    if (jobsSnap.empty) {
      console.log('   ℹ️  No import jobs found - this is normal for new setup\n');
      return true;
    }
    
    console.log(`   Found ${jobsSnap.size} recent jobs:\n`);
    
    jobsSnap.forEach((doc, i) => {
      const data = doc.data();
      console.log(`   ${i + 1}. Job ${doc.id}:`);
      console.log(`      Status: ${data.status}`);
      console.log(`      Type: ${data.type} (${data.importerType || 'N/A'})`);
      console.log(`      Items Created: ${data.itemsCreated?.length || 0}`);
      console.log(`      Items Updated: ${data.itemsUpdated?.length || 0}`);
      console.log(`      Progress: ${data.progress?.completed || 0}/${data.progress?.total || 0}`);
      
      if (data.error) {
        console.log(`      ❌ Error: ${data.error}`);
      }
      
      if (data.logs && data.logs.length > 0) {
        const lastLog = data.logs[data.logs.length - 1];
        console.log(`      Last log: ${typeof lastLog === 'object' ? JSON.stringify(lastLog).slice(0, 100) : lastLog}`);
      }
      console.log('');
    });
    
    return true;
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

/**
 * Test 5: Check products in database
 */
async function testProductsExist() {
  console.log('📦 Test 5: Checking products in database...');
  
  try {
    const count = await db.collection('products').count().get();
    const total = count.data().count;
    
    console.log(`   Found ${total} products total`);
    
    if (total === 0) {
      console.log('   ⚠️  No products in database - import has not succeeded yet');
      return false;
    }
    
    // Get a few recent products
    const recentSnap = await db.collection('products')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    
    console.log(`\n   Recent products:`);
    recentSnap.forEach((doc, i) => {
      const data = doc.data();
      console.log(`   ${i + 1}. ${data.name || data.title?.pl || 'Unnamed'}`);
      console.log(`      Category: ${data.mainCategorySlug}/${data.subCategorySlug}`);
      console.log(`      Status: ${data.status || 'N/A'}`);
      console.log(`      Source: ${data.metadata?.source || 'N/A'}`);
    });
    
    console.log('');
    return true;
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  const results = {
    categories: await testCategories(),
    directCreate: await testDirectProductCreation(),
    apiConfig: await testAPIConfiguration(),
    importJobs: await testImportJobs(),
    productsExist: await testProductsExist(),
  };
  
  console.log('=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  for (const [test, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  }
  
  console.log('');
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('✅ All tests passed! System is ready for imports.');
  } else {
    console.log('⚠️  Some tests failed. Review issues above.');
    
    if (!results.apiConfig) {
      console.log('\n💡 NEXT STEP: Configure API credentials');
      console.log('   1. Add ALIEXPRESS_* or CONVERTISER_* env vars to .env.local');
      console.log('   2. See docs/api/ALIEXPRESS_API_OVERVIEW.md for setup');
      console.log('   3. Restart dev server after adding credentials');
    }
    
    if (!results.categories) {
      console.log('\n💡 NEXT STEP: Import categories');
      console.log('   Categories are required for product imports');
    }
    
    if (!results.productsExist && results.categories && results.apiConfig) {
      console.log('\n💡 NEXT STEP: Try running an import');
      console.log('   Visit /admin/harvester and create an import job');
      console.log('   Or use: POST /api/admin/import/start');
    }
  }
  
  console.log('');
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
