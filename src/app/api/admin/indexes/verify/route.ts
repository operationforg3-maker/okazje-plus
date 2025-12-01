/**
 * Admin API: Firestore indexes verification and building
 * POST /api/admin/indexes/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { checkAdminAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IndexDefinition {
  collection: string;
  fields: Array<{
    fieldPath: string;
    order?: 'ASCENDING' | 'DESCENDING';
    arrayConfig?: 'CONTAINS';
  }>;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
}

/**
 * Required indexes for okazje-plus platform
 */
const REQUIRED_INDEXES: IndexDefinition[] = [
  // Deals indexes
  {
    collection: 'deals',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'temperature', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collection: 'deals',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'mainCategorySlug', order: 'ASCENDING' },
      { fieldPath: 'temperature', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collection: 'deals',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'postedAt', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collection: 'deals',
    fields: [
      { fieldPath: 'mainCategorySlug', order: 'ASCENDING' },
      { fieldPath: 'subCategorySlug', order: 'ASCENDING' },
      { fieldPath: 'temperature', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // Products indexes
  {
    collection: 'products',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collection: 'products',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'mainCategorySlug', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collection: 'products',
    fields: [
      { fieldPath: 'mainCategorySlug', order: 'ASCENDING' },
      { fieldPath: 'subCategorySlug', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // Comments indexes
  {
    collection: 'comments',
    fields: [
      { fieldPath: 'entityType', order: 'ASCENDING' },
      { fieldPath: 'entityId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // Votes indexes
  {
    collection: 'votes',
    fields: [
      { fieldPath: 'entityType', order: 'ASCENDING' },
      { fieldPath: 'entityId', order: 'ASCENDING' },
      { fieldPath: 'userId', order: 'ASCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // User activity indexes
  {
    collection: 'userActivity',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  }
];

/**
 * Check if index exists by querying with it
 * If query fails with index error, index doesn't exist
 */
async function verifyIndexExists(indexDef: IndexDefinition): Promise<{
  exists: boolean;
  error?: string;
  consoleUrl?: string;
}> {
  try {
    let query = adminDb.collection(indexDef.collection);
    
    // Build query using the index fields
    for (const field of indexDef.fields) {
      if (field.order) {
        const direction = field.order === 'ASCENDING' ? 'asc' : 'desc';
        query = query.orderBy(field.fieldPath, direction) as any;
      }
    }
    
    // Try to execute query with limit 1
    await query.limit(1).get();
    
    return { exists: true };
    
  } catch (error: any) {
    // Check if error is about missing index
    if (error.code === 9 || error.message?.includes('index')) {
      // Extract console URL from error message if available
      const urlMatch = error.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
      
      return {
        exists: false,
        error: error.message,
        consoleUrl: urlMatch ? urlMatch[0] : undefined
      };
    }
    
    // Other error - assume index exists but query failed for different reason
    return {
      exists: true,
      error: `Query error (non-index): ${error.message}`
    };
  }
}

/**
 * Generate firestore.indexes.json content
 */
function generateIndexesJson(): object {
  const indexes = REQUIRED_INDEXES.map(idx => ({
    collectionGroup: idx.collection,
    queryScope: idx.queryScope,
    fields: idx.fields.map(f => ({
      fieldPath: f.fieldPath,
      ...(f.order && { order: f.order }),
      ...(f.arrayConfig && { arrayConfig: f.arrayConfig })
    }))
  }));
  
  return {
    indexes,
    fieldOverrides: []
  };
}

export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action } = await req.json();
    
    if (action === 'verify') {
      // Verify all indexes
      const results = await Promise.all(
        REQUIRED_INDEXES.map(async (indexDef) => {
          const verification = await verifyIndexExists(indexDef);
          
          return {
            collection: indexDef.collection,
            fields: indexDef.fields.map(f => `${f.fieldPath}:${f.order || f.arrayConfig}`).join(', '),
            exists: verification.exists,
            error: verification.error,
            consoleUrl: verification.consoleUrl
          };
        })
      );
      
      const missingCount = results.filter(r => !r.exists).length;
      const existingCount = results.filter(r => r.exists).length;
      
      return NextResponse.json({
        success: true,
        summary: {
          total: REQUIRED_INDEXES.length,
          existing: existingCount,
          missing: missingCount
        },
        indexes: results,
        message: missingCount > 0
          ? `⚠️ Brakuje ${missingCount} indeksów. Kliknij linki w konsoli Firebase aby je utworzyć.`
          : `✅ Wszystkie ${existingCount} indeksów istnieją!`
      });
    }
    
    if (action === 'generate') {
      // Generate firestore.indexes.json content
      const indexesJson = generateIndexesJson();
      
      return NextResponse.json({
        success: true,
        indexesJson,
        message: 'Wygenerowano konfigurację indeksów. Zapisz do firestore.indexes.json i uruchom: firebase deploy --only firestore:indexes'
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "verify" or "generate"' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Index verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Return list of required indexes
    return NextResponse.json({
      requiredIndexes: REQUIRED_INDEXES.map(idx => ({
        collection: idx.collection,
        fields: idx.fields.map(f => `${f.fieldPath}:${f.order || f.arrayConfig}`).join(', '),
        queryScope: idx.queryScope
      }))
    });

  } catch (error: any) {
    console.error('Get indexes error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
