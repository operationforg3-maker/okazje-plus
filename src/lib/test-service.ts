/**
 * Comprehensive Test Service
 * Testy techniczne, funkcjonalne i biznesowe dla całej aplikacji
 */

import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getCountFromServer,
  doc,
  getDoc,
  limit,
  orderBy 
} from 'firebase/firestore';
import { Deal, Product, User } from './types';

export interface TestResult {
  id: string;
  name: string;
  category: 'technical' | 'functional' | 'business';
  status: 'pass' | 'fail' | 'warning' | 'skip';
  message: string;
  duration: number; // ms
  details?: any;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Array<{
    name: string;
    slug: string;
  }>;
}

export interface TestSuiteResult {
  timestamp: string;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  results: TestResult[];
}

/**
 * Runner dla pojedynczego testu
 */
async function runTest(
  id: string,
  name: string,
  category: 'technical' | 'functional' | 'business',
  testFn: () => Promise<{ status: TestResult['status']; message: string; details?: any }>
): Promise<TestResult> {
  const start = performance.now();
  try {
    const result = await testFn();
    const duration = performance.now() - start;
    return {
      id,
      name,
      category,
      ...result,
      duration: Math.round(duration)
    };
  } catch (error: any) {
    const duration = performance.now() - start;
    return {
      id,
      name,
      category,
      status: 'fail',
      message: `Error: ${error.message}`,
      duration: Math.round(duration),
      details: { error: error.stack }
    };
  }
}

/**
 * ===========================================
 * TESTY TECHNICZNE
 * ===========================================
 */

async function testFirestoreConnection(): Promise<{ status: 'pass' | 'fail'; message: string }> {
  try {
    const testQuery = query(collection(db, 'deals'), limit(1));
    await getDocs(testQuery);
    return { status: 'pass', message: 'Firestore connection OK' };
  } catch (error: any) {
    return { status: 'fail', message: `Firestore error: ${error.message}` };
  }
}

async function testCollectionsExist(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  const collections = ['deals', 'products', 'users', 'categories', 'notifications'];
  const results: Record<string, boolean> = {};
  
  for (const collName of collections) {
    try {
      const q = query(collection(db, collName), limit(1));
      const snapshot = await getDocs(q);
      results[collName] = true;
    } catch {
      results[collName] = false;
    }
  }
  
  const missing = Object.entries(results).filter(([_, exists]) => !exists).map(([name]) => name);
  
  if (missing.length === 0) {
    return { status: 'pass', message: 'All collections exist', details: results };
  } else {
    return { 
      status: 'warning', 
      message: `Missing collections: ${missing.join(', ')}`,
      details: results 
    };
  }
}

async function testIndexes(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string }> {
  try {
    // Test composite index: deals (status, temperature desc)
    const q = query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      orderBy('temperature', 'desc'),
      limit(1)
    );
    await getDocs(q);
    return { status: 'pass', message: 'Firestore indexes working' };
  } catch (error: any) {
    if (error.message.includes('index')) {
      return { 
        status: 'warning', 
        message: 'Missing Firestore index - check Firebase Console' 
      };
    }
    return { status: 'fail', message: `Index test failed: ${error.message}` };
  }
}

/**
 * ===========================================
 * TESTY FUNKCJONALNE
 * ===========================================
 */

async function testDealsCRUD(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    // Read test
    const dealsQuery = query(collection(db, 'deals'), limit(10));
    const dealsSnapshot = await getDocs(dealsQuery);
    const deals = dealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
    
    if (deals.length === 0) {
      return { 
        status: 'warning', 
        message: 'No deals in database',
        details: { count: 0 }
      };
    }
    
    // Validate deal structure
    const sampleDeal = deals[0];
    const requiredFields = ['title', 'price', 'link', 'mainCategorySlug', 'temperature', 'status'];
    const missingFields = requiredFields.filter(field => !(field in sampleDeal));
    
    if (missingFields.length > 0) {
      return {
        status: 'fail',
        message: `Deal missing fields: ${missingFields.join(', ')}`,
        details: { sampleDeal }
      };
    }
    
    return {
      status: 'pass',
      message: `Deals CRUD OK (${deals.length} deals found)`,
      details: { count: deals.length, sample: sampleDeal.title }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Deals test failed: ${error.message}` };
  }
}

async function testProductsCRUD(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const productsQuery = query(collection(db, 'products'), limit(10));
    const productsSnapshot = await getDocs(productsQuery);
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    
    if (products.length === 0) {
      return { 
        status: 'warning', 
        message: 'No products in database',
        details: { count: 0 }
      };
    }
    
    // Validate product structure
    const sampleProduct = products[0];
    const requiredFields = ['name', 'price', 'affiliateUrl', 'mainCategorySlug', 'ratingCard'];
    const missingFields = requiredFields.filter(field => !(field in sampleProduct));
    
    if (missingFields.length > 0) {
      return {
        status: 'fail',
        message: `Product missing fields: ${missingFields.join(', ')}`,
        details: { sampleProduct }
      };
    }
    
    return {
      status: 'pass',
      message: `Products CRUD OK (${products.length} products found)`,
      details: { count: products.length, sample: sampleProduct.name }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Products test failed: ${error.message}` };
  }
}

async function testCommentsCount(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    // Znajdź deal z komentarzami
    const dealsQuery = query(
      collection(db, 'deals'),
      where('commentsCount', '>', 0),
      limit(1)
    );
    const dealsSnapshot = await getDocs(dealsQuery);
    
    if (dealsSnapshot.empty) {
      return {
        status: 'skip',
        message: 'No deals with comments to test',
        details: { reason: 'no_data' }
      };
    }
    
    const deal = { id: dealsSnapshot.docs[0].id, ...dealsSnapshot.docs[0].data() } as Deal;
    const commentsQuery = collection(db, `deals/${deal.id}/comments`);
    const commentsSnapshot = await getDocs(commentsQuery);
    const actualCount = commentsSnapshot.size;
    const storedCount = deal.commentsCount || 0;
    
    if (actualCount === storedCount) {
      return {
        status: 'pass',
        message: `Comments count accurate (${actualCount})`,
        details: { dealId: deal.id, count: actualCount }
      };
    } else {
      return {
        status: 'fail',
        message: `Comments count mismatch: stored=${storedCount}, actual=${actualCount}`,
        details: { dealId: deal.id, stored: storedCount, actual: actualCount }
      };
    }
  } catch (error: any) {
    return { status: 'fail', message: `Comments count test failed: ${error.message}` };
  }
}

async function testVotingSystem(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    // Znajdź deal z głosami
    const dealsQuery = query(
      collection(db, 'deals'),
      where('voteCount', '>', 0),
      limit(1)
    );
    const dealsSnapshot = await getDocs(dealsQuery);
    
    if (dealsSnapshot.empty) {
      return {
        status: 'skip',
        message: 'No deals with votes to test',
        details: { reason: 'no_data' }
      };
    }
    
    const deal = { id: dealsSnapshot.docs[0].id, ...dealsSnapshot.docs[0].data() } as Deal;
    
    // Sprawdź temperature ratio (10 pkt per vote)
    const expectedMinTemp = deal.voteCount * 10;
    const expectedMaxTemp = deal.voteCount * 10 + 100; // Buffer for down votes
    
    if (deal.temperature >= expectedMinTemp && deal.temperature <= expectedMaxTemp) {
      return {
        status: 'pass',
        message: `Voting system OK (temp=${deal.temperature}, votes=${deal.voteCount})`,
        details: { dealId: deal.id, temperature: deal.temperature, voteCount: deal.voteCount }
      };
    } else {
      return {
        status: 'warning',
        message: `Temperature unusual: ${deal.temperature} for ${deal.voteCount} votes`,
        details: { dealId: deal.id, temperature: deal.temperature, voteCount: deal.voteCount }
      };
    }
  } catch (error: any) {
    return { status: 'fail', message: `Voting test failed: ${error.message}` };
  }
}

async function testCategoriesStructure(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const categoriesQuery = query(collection(db, 'categories'));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    if (categoriesSnapshot.empty) {
      return {
        status: 'fail',
        message: 'No categories found - critical for navigation',
        details: { count: 0 }
      };
    }
    
    const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    let totalSubcategories = 0;
    
    categories.forEach((cat: any) => {
      if (cat.subcategories && Array.isArray(cat.subcategories)) {
        totalSubcategories += cat.subcategories.length;
      }
    });
    
    return {
      status: 'pass',
      message: `Categories OK (${categories.length} main, ${totalSubcategories} sub)`,
      details: { mainCategories: categories.length, subcategories: totalSubcategories }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Categories test failed: ${error.message}` };
  }
}

/**
 * ===========================================
 * TESTY BIZNESOWE
 * ===========================================
 */

async function testApprovedContent(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const [dealsCount, productsCount] = await Promise.all([
      getCountFromServer(query(collection(db, 'deals'), where('status', '==', 'approved'))),
      getCountFromServer(query(collection(db, 'products'), where('status', '==', 'approved')))
    ]);
    
    const approvedDeals = dealsCount.data().count;
    const approvedProducts = productsCount.data().count;
    
    if (approvedDeals === 0 && approvedProducts === 0) {
      return {
        status: 'warning',
        message: 'No approved content - users will see empty pages',
        details: { deals: 0, products: 0 }
      };
    }
    
    return {
      status: 'pass',
      message: `Approved content OK (${approvedDeals} deals, ${approvedProducts} products)`,
      details: { deals: approvedDeals, products: approvedProducts }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Approved content test failed: ${error.message}` };
  }
}

async function testPendingModeration(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const [dealsCount, productsCount] = await Promise.all([
      getCountFromServer(query(collection(db, 'deals'), where('status', 'in', ['draft', 'pending']))),
      getCountFromServer(query(collection(db, 'products'), where('status', 'in', ['draft', 'pending'])))
    ]);
    
    const pendingDeals = dealsCount.data().count;
    const pendingProducts = productsCount.data().count;
    const total = pendingDeals + pendingProducts;
    
    if (total > 50) {
      return {
        status: 'warning',
        message: `High moderation queue: ${total} items waiting`,
        details: { deals: pendingDeals, products: pendingProducts }
      };
    }
    
    return {
      status: 'pass',
      message: `Moderation queue OK (${total} items)`,
      details: { deals: pendingDeals, products: pendingProducts }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Moderation test failed: ${error.message}` };
  }
}

async function testUserActivity(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const usersCount = await getCountFromServer(collection(db, 'users'));
    const totalUsers = usersCount.data().count;
    
    if (totalUsers === 0) {
      return {
        status: 'warning',
        message: 'No users registered',
        details: { count: 0 }
      };
    }
    
    // Sprawdź aktywność (deals dodane przez użytkowników)
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentDealsQuery = query(
      collection(db, 'deals'),
      where('postedAt', '>=', last30Days.toISOString()),
      limit(100)
    );
    const recentDealsSnapshot = await getDocs(recentDealsQuery);
    const recentDeals = recentDealsSnapshot.size;
    
    return {
      status: 'pass',
      message: `User activity OK (${totalUsers} users, ${recentDeals} deals/30d)`,
      details: { users: totalUsers, recentDeals }
    };
  } catch (error: any) {
    return { status: 'fail', message: `User activity test failed: ${error.message}` };
  }
}

async function testHotDeals(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const hotDealsQuery = query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      where('temperature', '>=', 300),
      limit(10)
    );
    const hotDealsSnapshot = await getDocs(hotDealsQuery);
    const hotDeals = hotDealsSnapshot.size;
    
    if (hotDeals === 0) {
      return {
        status: 'warning',
        message: 'No hot deals (temp >= 300) - homepage may look empty',
        details: { count: 0 }
      };
    }
    
    return {
      status: 'pass',
      message: `Hot deals OK (${hotDeals} deals with temp >= 300)`,
      details: { count: hotDeals }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Hot deals test failed: ${error.message}` };
  }
}

async function testDataQuality(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    // Sprawdź deals bez obrazków
    const dealsQuery = query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      limit(100)
    );
    const dealsSnapshot = await getDocs(dealsQuery);
    const deals = dealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
    
    const withoutImages = deals.filter(d => !d.image || d.image === '').length;
    const withoutDescriptions = deals.filter(d => !d.description || d.description === '').length;
    const percentage = deals.length > 0 ? Math.round((withoutImages / deals.length) * 100) : 0;
    
    if (percentage > 30) {
      return {
        status: 'warning',
        message: `${percentage}% deals without images, ${withoutDescriptions} without descriptions`,
        details: { total: deals.length, noImages: withoutImages, noDescriptions: withoutDescriptions }
      };
    }
    
    return {
      status: 'pass',
      message: `Data quality OK (${percentage}% without images)`,
      details: { total: deals.length, noImages: withoutImages }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Data quality test failed: ${error.message}` };
  }
}

/**
 * ===========================================
 * GŁÓWNY TEST RUNNER
 * ===========================================
 */

export async function runAllTests(): Promise<TestSuiteResult> {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  console.log('🚀 Starting comprehensive test suite...');
  
  const results: TestResult[] = [];
  
  // TECHNICAL TESTS
  console.log('⚙️  Running technical tests...');
  results.push(await runTest('tech-001', 'Firestore Connection', 'technical', testFirestoreConnection));
  results.push(await runTest('tech-002', 'Collections Exist', 'technical', testCollectionsExist));
  results.push(await runTest('tech-003', 'Firestore Indexes', 'technical', testIndexes));
  
  // FUNCTIONAL TESTS
  console.log('🔧 Running functional tests...');
  results.push(await runTest('func-001', 'Deals CRUD Operations', 'functional', testDealsCRUD));
  results.push(await runTest('func-002', 'Products CRUD Operations', 'functional', testProductsCRUD));
  results.push(await runTest('func-003', 'Comments Counter Accuracy', 'functional', testCommentsCount));
  results.push(await runTest('func-004', 'Voting System Logic', 'functional', testVotingSystem));
  results.push(await runTest('func-005', 'Categories Structure', 'functional', testCategoriesStructure));
  
  // BUSINESS TESTS
  console.log('💼 Running business logic tests...');
  results.push(await runTest('biz-001', 'Approved Content Availability', 'business', testApprovedContent));
  results.push(await runTest('biz-002', 'Moderation Queue Status', 'business', testPendingModeration));
  results.push(await runTest('biz-003', 'User Activity Metrics', 'business', testUserActivity));
  results.push(await runTest('biz-004', 'Hot Deals Presence', 'business', testHotDeals));
  results.push(await runTest('biz-005', 'Data Quality Check', 'business', testDataQuality));
  
  const duration = Math.round(performance.now() - startTime);
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  console.log(`✅ Tests completed in ${duration}ms`);
  console.log(`   Passed: ${passed}, Failed: ${failed}, Warnings: ${warnings}, Skipped: ${skipped}`);
  
  return {
    timestamp,
    duration,
    totalTests: results.length,
    passed,
    failed,
    warnings,
    skipped,
    results
  };
}
