/**
 * Product Import Batch Endpoint
 * 
 * POST /api/admin/products/import-batch
 * 
 * Real implementation that:
 * 1. Fetches products from external APIs (AliExpress, Allegro, etc.)
 * 2. Uses importKeywords from category definitions
 * 3. Normalizes to Product schema
 * 4. Stores as drafts in Firestore
 * 5. Queues for AI enhancement if requested
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { SmartHarvester } from '@/lib/automation/harvester';
import { logger } from '@/lib/logger';

interface ImportConfig {
  source: 'aliexpress' | 'allegro' | 'amazon' | 'ebay' | 'convertiser';
  mainCategory: string;
  subCategory: string;
  subSubCategory: string;
  itemsPerCategory: number;
  importType: 'products' | 'deals' | 'coupons';
  draftStatus: 'draft' | 'pending_ai' | 'ready_to_publish';
}

interface ImportResult {
  totalProcessed: number;
  created: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // ===== AUTH =====
    // Support two auth methods:
    // 1. Firebase admin token (normal requests)
    // 2. x-internal-secret header (requests from cron/internal services)
    const internalSecret = req.headers.get('x-internal-secret');
    const cronSecret = process.env.CRON_SECRET;
    
    const isInternalRequest = internalSecret && cronSecret && internalSecret === cronSecret;
    
    if (!isInternalRequest) {
      // Use Firebase auth for normal requests
      const authResult = await checkAdminAuth(req);
      if (!authResult.authorized) {
        return NextResponse.json(
          { error: authResult.error || 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const config = await req.json() as ImportConfig;

    // ===== VALIDATION =====
    if (!config.source || !config.mainCategory || !config.subCategory || !config.subSubCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: source, mainCategory, subCategory, subSubCategory' },
        { status: 400 }
      );
    }

    if (config.itemsPerCategory < 1 || config.itemsPerCategory > 500) {
      return NextResponse.json(
        { error: 'itemsPerCategory must be between 1 and 500' },
        { status: 400 }
      );
    }

    // ===== LOAD CATEGORY & KEYWORDS =====
    // Load from Firebase Firestore categories collection
    const mainCatDocs = await adminDb
      .collection('categories')
      .where('slug', '==', config.mainCategory)
      .limit(1)
      .get();

    if (mainCatDocs.empty) {
      return NextResponse.json(
        { error: `Main category not found: ${config.mainCategory}` },
        { status: 404 }
      );
    }

    const mainCatId = mainCatDocs.docs[0].id;
    const mainCatData = mainCatDocs.docs[0].data() as any;

    // Load subcategory
    const subCatDocs = await adminDb
      .collection('categories')
      .doc(mainCatId)
      .collection('subcategories')
      .where('slug', '==', config.subCategory)
      .limit(1)
      .get();

    if (subCatDocs.empty) {
      return NextResponse.json(
        { error: `Subcategory not found: ${config.subCategory}` },
        { status: 404 }
      );
    }

    const subCatId = subCatDocs.docs[0].id;
    const subCatData = subCatDocs.docs[0].data() as any;

    // Load sub-subcategory
    const subSubCatDocs = await adminDb
      .collection('categories')
      .doc(mainCatId)
      .collection('subcategories')
      .doc(subCatId)
      .collection('subcategories')
      .where('slug', '==', config.subSubCategory)
      .limit(1)
      .get();

    if (subSubCatDocs.empty) {
      return NextResponse.json(
        { error: `Sub-subcategory not found: ${config.subSubCategory}` },
        { status: 404 }
      );
    }

    const subSubCatData = subSubCatDocs.docs[0].data() as any;

    // Get search keywords - IMPORTANT: Use importKeywords from category definition
    const searchKeywords = subSubCatData.importKeywords || [subSubCatData.name];
    logger.info('Product import started', {
      source: config.source,
      category: `${config.mainCategory}/${config.subCategory}/${config.subSubCategory}`,
      keywords: searchKeywords,
      itemCount: config.itemsPerCategory,
    });

    // ===== HARVEST VIA M6 PIPELINE =====
    const categoryPath = `${mainCatData.slug}/${subCatData.slug}/${subSubCatData.slug}`;
    const harvesterJobId = `import_${config.source}_${Date.now()}`;
    const harvester = new SmartHarvester(harvesterJobId);

    let jobResult;
    if (config.source === 'aliexpress') {
      jobResult = await harvester.harvestProducts(
        'aliexpress',
        categoryPath,
        config.itemsPerCategory,
        undefined,
        true
      );
    } else if (config.source === 'convertiser') {
      const keyword = Array.isArray(searchKeywords) && searchKeywords.length > 0 ? String(searchKeywords[0]) : categoryPath;
      jobResult = await harvester.harvestProducts(
        'convertiser',
        keyword,
        config.itemsPerCategory,
        undefined,
        false,
        'offers',
        false
      );
    } else {
      return NextResponse.json(
        { error: `Unsupported source for M6 import: ${config.source}` },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      totalProcessed: jobResult.productsFound || 0,
      created: jobResult.productsCreated || 0,
      skipped: jobResult.duplicatesSkipped || 0,
      errors: jobResult.errors?.length || 0,
      durationMs: Date.now() - startTime,
    };

    return NextResponse.json({
      success: true,
      job: {
        id: jobResult.id,
        source: jobResult.source,
        status: jobResult.status,
        productsCreated: jobResult.productsCreated,
        dealsCreated: jobResult.dealsCreated,
      },
      result,
      errors: jobResult.errors || [],
    });

  } catch (error) {
    logger.error('Import batch failed', { error });
    return NextResponse.json(
      { error: 'Import batch failed', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

