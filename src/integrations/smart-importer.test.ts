/**
 * Smart Import Pipeline - Comprehensive Test Suite
 * 
 * Tests all 3 AI agents and the orchestration pipeline with varied product scenarios
 * to ensure quality scoring, content generation, and category mapping work correctly.
 */

import { smartImportProduct, smartImportBatch } from './smart-importer';
import { logger } from '@/lib/logging';

/**
 * Test scenarios with expected outcomes
 */
const TEST_SCENARIOS = {
  highQuality: {
    name: 'iPhone 15 Pro Max 256GB',
    input: {
      title: 'iPhone 15 Pro Max 256GB Space Black - Official Apple Product',
      description: 'Latest flagship smartphone with A18 Pro chip, ProMotion display, professional camera system',
      price: 4999,
      originalPrice: 5999,
      shippingCost: 99,
      rating: 4.9,
      soldCount: 5000,
      merchantRating: 99,
      merchant: 'TechMart Poland',
      source: 'aliexpress' as const,
      externalId: 'ali-iphone-15',
      importedBy: 'test@okazjeplus.pl',
    },
    expected: {
      qualityScore: { min: 80, max: 100 },
      recommendation: 'publish',
      categoryMain: 'elektronika',
      categorySub: 'smartfony',
    },
  },
  
  mediumQuality: {
    name: 'Budget Laptop 14" HD 256GB SSD',
    input: {
      title: 'Budget 14 inch Laptop Computer 256GB SSD 8GB RAM Windows 11',
      description: 'Affordable laptop for everyday use, web browsing, document editing',
      price: 999,
      originalPrice: 1499,
      shippingCost: 200,
      rating: 4.2,
      soldCount: 300,
      merchantRating: 87,
      merchant: 'ElectroHub',
      source: 'aliexpress' as const,
      externalId: 'ali-laptop-budget',
      importedBy: 'test@okazjeplus.pl',
    },
    expected: {
      qualityScore: { min: 50, max: 79 },
      recommendation: 'manual_review',
      categoryMain: 'elektronika',
      categorySub: 'komputery',
    },
  },
  
  lowQuality: {
    name: 'Generic Phone Case',
    input: {
      title: 'Phone Case Random Generic',
      description: 'Case for phone',
      price: 49,
      originalPrice: undefined,
      shippingCost: 30,
      rating: 2.5,
      soldCount: 5,
      merchantRating: 60,
      merchant: 'UnknownSeller',
      source: 'aliexpress' as const,
      externalId: 'ali-case-generic',
      importedBy: 'test@okazjeplus.pl',
    },
    expected: {
      qualityScore: { min: 0, max: 49 },
      recommendation: 'reject',
      categoryMain: 'elektronika',
      categorySub: 'akcesoria',
    },
  },
  
  premiumHeadphones: {
    name: 'Sony WH-1000XM5 Wireless Headphones',
    input: {
      title: 'Sony WH-1000XM5 Premium Noise Cancelling Wireless Headphones - Black',
      description: 'Premium wireless headphones with industry-leading noise cancellation, 30-hour battery life, premium sound quality',
      price: 1699,
      originalPrice: 2199,
      shippingCost: 50,
      rating: 4.8,
      soldCount: 2500,
      merchantRating: 96,
      merchant: 'AudioMart',
      source: 'aliexpress' as const,
      externalId: 'ali-headphones-sony',
      importedBy: 'test@okazjeplus.pl',
    },
    expected: {
      qualityScore: { min: 75, max: 100 },
      recommendation: 'publish',
      categoryMain: 'elektronika',
      categorySub: 'audio',
    },
  },
  
  inadequateShipping: {
    name: 'Gaming Mouse - Expensive Shipping',
    input: {
      title: 'RGB Gaming Mouse 12000 DPI Professional Esports',
      description: 'Professional gaming mouse with RGB lighting and programmable buttons',
      price: 99,
      originalPrice: 149,
      shippingCost: 150, // Shipping > 50% of price - should hurt score
      rating: 4.6,
      soldCount: 800,
      merchantRating: 94,
      merchant: 'GamingGear',
      source: 'aliexpress' as const,
      externalId: 'ali-mouse-gaming',
      importedBy: 'test@okazjeplus.pl',
    },
    expected: {
      qualityScore: { min: 40, max: 70 },
      recommendation: 'manual_review',
      categoryMain: 'elektronika',
      categorySub: 'akcesoria',
    },
  },
};

/**
 * Run all test scenarios
 */
export async function runSmartImportTests(): Promise<void> {
  logger.info('🧪 Starting Smart Import Pipeline Tests...');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: [] as Array<{
      scenario: string;
      passed: boolean;
      errors: string[];
      result?: any;
      processingTimeMs?: number;
    }>,
  };

  for (const [key, scenario] of Object.entries(TEST_SCENARIOS)) {
    logger.info(`\n📦 Testing scenario: ${scenario.name}`, { testCase: key });
    
    const startTime = Date.now();
    results.total++;

    try {
      const result = await smartImportProduct(scenario.input);
      const processingTime = Date.now() - startTime;
      
      const errors: string[] = [];
      
      // Verify quality score range
      if (result.qualityScore < scenario.expected.qualityScore.min || 
          result.qualityScore > scenario.expected.qualityScore.max) {
        errors.push(
          `Quality score ${result.qualityScore} outside expected range ` +
          `[${scenario.expected.qualityScore.min}, ${scenario.expected.qualityScore.max}]`
        );
      }
      
      // Verify recommendation
      if (result.qualityRecommendation !== scenario.expected.recommendation) {
        errors.push(
          `Recommendation mismatch: got "${result.qualityRecommendation}", ` +
          `expected "${scenario.expected.recommendation}"`
        );
      }
      
      // Verify category (if available)
      if (result.category) {
        if (result.category.mainCategorySlug !== scenario.expected.categoryMain) {
          errors.push(
            `Main category mismatch: got "${result.category.mainCategorySlug}", ` +
            `expected "${scenario.expected.categoryMain}"`
          );
        }
        
        if (result.category.subCategorySlug !== scenario.expected.categorySub) {
          errors.push(
            `Sub category mismatch: got "${result.category.subCategorySlug}", ` +
            `expected "${scenario.expected.categorySub}"`
          );
        }
      }
      
      // Verify generated content
      if (!result.generatedContent) {
        errors.push('Generated content is missing');
      } else {
        if (!result.generatedContent.marketingTitle) {
          errors.push('Marketing title not generated');
        }
        if (!result.generatedContent.shortDescription) {
          errors.push('Short description not generated');
        }
        if (!result.generatedContent.htmlContent) {
          errors.push('HTML content not generated');
        }
      }
      
      const passed = errors.length === 0;
      
      logger.info(`${passed ? '✅ PASS' : '❌ FAIL'}: ${scenario.name}`, {
        qualityScore: result.qualityScore,
        recommendation: result.qualityRecommendation,
        confidence: result.categoryConfidence,
        processingTimeMs: processingTime,
        errors: errors.length > 0 ? errors : undefined,
      });
      
      results.details.push({
        scenario: key,
        passed,
        errors,
        result: {
          qualityScore: result.qualityScore,
          recommendation: result.qualityRecommendation,
          categoryMain: result.category?.mainCategorySlug,
          categorySub: result.category?.subCategorySlug,
          categoryConfidence: result.categoryConfidence,
          generatedTitleLength: result.generatedContent?.marketingTitle.length,
          generatedDescriptionLength: result.generatedContent?.shortDescription.length,
        },
        processingTimeMs: processingTime,
      });
      
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
      
    } catch (error) {
      logger.error(`❌ ERROR in test scenario: ${key}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      results.failed++;
      results.details.push({
        scenario: key,
        passed: false,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  // Print summary
  logger.info('\n' + '='.repeat(80));
  logger.info('📊 TEST SUMMARY', {
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    passRate: `${((results.passed / results.total) * 100).toFixed(1)}%`,
  });
  
  // Print details
  logger.info('\nDetailed Results:');
  for (const detail of results.details) {
    const status = detail.passed ? '✅' : '❌';
    logger.info(`${status} ${detail.scenario}`, {
      processingTimeMs: detail.processingTimeMs,
      errors: detail.errors.length > 0 ? detail.errors : 'None',
      ...detail.result,
    });
  }

  logger.info('\n' + '='.repeat(80));
}

/**
 * Test batch processing performance
 */
export async function runBatchPerformanceTest(): Promise<void> {
  logger.info('🚀 Starting Batch Performance Test...');
  
  const batchSizes = [1, 5, 10, 20];
  
  for (const size of batchSizes) {
    logger.info(`\n📦 Testing batch of ${size} products...`);
    
    const batch = Array.from({ length: size }, (_, i) => ({
      title: `Test Product ${i + 1}`,
      description: `Test product description for item ${i + 1}`,
      price: 100 + Math.random() * 1000,
      originalPrice: 200 + Math.random() * 1000,
      shippingCost: 20 + Math.random() * 100,
      rating: 2 + Math.random() * 3,
      soldCount: Math.floor(Math.random() * 5000),
      merchantRating: 70 + Math.random() * 30,
      merchant: `Merchant ${i + 1}`,
      source: 'aliexpress' as const,
      externalId: `test-${i}`,
      importedBy: 'test@okazjeplus.pl',
    }));
    
    const startTime = Date.now();
    const results = await smartImportBatch(batch);
    const totalTime = Date.now() - startTime;
    
    logger.info(`✅ Batch processing complete`, {
      batchSize: size,
      totalTimeMs: totalTime,
      avgTimePerProductMs: (totalTime / size).toFixed(1),
      successful: results.stats.successful,
      rejected: results.stats.rejected,
      avgProcessingTimeMs: results.stats.avgProcessingTimeMs,
    });
  }
  
  logger.info('\n' + '='.repeat(80));
}

/**
 * Test category mapping accuracy
 */
export async function testCategoryMapping(): Promise<void> {
  logger.info('🏷️ Testing Category Mapping Accuracy...');
  
  const categoryTestCases = [
    { title: 'Samsung Galaxy S24 Ultra', expectedMain: 'elektronika', expectedSub: 'smartfony' },
    { title: 'Nike Air Force 1 Running Shoes Size 42', expectedMain: 'moda', expectedSub: 'obuwie' },
    { title: 'IKEA BILLY Bookshelf White 200cm', expectedMain: 'dom-i-ogrod', expectedSub: 'meble' },
    { title: 'Head Pro Tennis Racket 100 sq.in', expectedMain: 'sport-i-turystyka', expectedSub: 'tenis' },
    { title: 'L\'Oréal Paris Revitalift Eye Cream', expectedMain: 'zdrowie-i-uroda', expectedSub: 'pielegnacja' },
    { title: 'Michelin Pilot Sport 4 225/45R17 Tire', expectedMain: 'motoryzacja', expectedSub: 'opony' },
    { title: 'LEGO Star Wars Millennium Falcon 75257', expectedMain: 'zabawki', expectedSub: 'konstruktory' },
  ];
  
  let correct = 0;
  let total = 0;
  
  for (const testCase of categoryTestCases) {
    total++;
    logger.info(`\n📍 Testing: ${testCase.title}`);
    
    try {
      const result = await smartImportProduct({
        title: testCase.title,
        description: testCase.title,
        price: 100,
        originalPrice: 150,
        shippingCost: 20,
        rating: 4.5,
        soldCount: 100,
        merchantRating: 95,
        merchant: 'TestMerchant',
        source: 'aliexpress',
        externalId: `test-${total}`,
        importedBy: 'test@okazjeplus.pl',
      });
      
      const mainMatch = result.category?.mainCategorySlug === testCase.expectedMain;
      const subMatch = result.category?.subCategorySlug === testCase.expectedSub;
      const isCorrect = mainMatch && subMatch;
      
      if (isCorrect) correct++;
      
      logger.info(`${isCorrect ? '✅' : '⚠️'} Result`, {
        expected: `${testCase.expectedMain}/${testCase.expectedSub}`,
        got: `${result.category?.mainCategorySlug}/${result.category?.subCategorySlug}`,
        confidence: result.categoryConfidence,
        reasoning: result.categoryReasoning,
      });
      
    } catch (error) {
      logger.error('❌ Test failed', { error });
    }
  }
  
  logger.info('\n' + '='.repeat(80));
  logger.info('🏷️ CATEGORY MAPPING SUMMARY', {
    total,
    correct,
    accuracy: `${((correct / total) * 100).toFixed(1)}%`,
  });
  logger.info('='.repeat(80));
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  logger.info('\n' + '='.repeat(80));
  logger.info('🧪 SMART IMPORT PIPELINE - COMPREHENSIVE TEST SUITE');
  logger.info('='.repeat(80));
  
  await runSmartImportTests();
  await runBatchPerformanceTest();
  await testCategoryMapping();
  
  logger.info('\n✅ All tests completed!');
}

// Export for manual testing
if (typeof window !== 'undefined') {
  (window as any).smartImportTests = {
    runAllTests,
    runSmartImportTests,
    runBatchPerformanceTest,
    testCategoryMapping,
  };
}
