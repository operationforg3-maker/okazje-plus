import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { requireAdmin } from '@/lib/auth-server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Fallback embedded tools data (13 tools)
const DEFAULT_TOOLS_CSV = `category,tool,description,purpose,howItWorks,hasUI,hasAPI,hasBackend,hasTests,lastModified,owner,ui,apiCount,apis,backendModules,testFiles,notes
Import,AliExpress Integration,"Scrapes products from AliExpress via API and imports into platform","Automates product discovery and import workflow from AliExpress marketplace","Uses AliExpress API to fetch product data, validates schema, enriches with translations, imports to Firestore",✅,✅,✅,❌,2025-01-15,system,src/app/admin/aliexpress-import/page.tsx,2,"src/app/api/admin/aliexpress/route.ts
src/app/api/admin/import/route.ts","src/ai/flows/aliexpress.ts
src/ai/flows/importer.ts",,
Import,Allegro Integration,"Fetches deals and products from Allegro Polish marketplace","Enables automated deal discovery from Allegro via official API","Calls Allegro REST API, parses deal/product listings, applies filters, stores in Firestore",❌,✅,❌,❌,2025-01-10,system,,1,src/app/api/admin/allegro/route.ts,,,
Import,CSV Bulk Import,"Accepts CSV uploads with product/deal data for bulk processing","Allows partners to batch-upload products via structured CSV format","Validates CSV schema, parses rows, performs duplicate checks, queues import jobs, processes asynchronously",✅,✅,✅,❌,2025-01-14,system,src/app/admin/smart-import/page.tsx,3,"src/app/api/admin/smart-import/route.ts
src/app/api/admin/import/route.ts
src/app/api/admin/products/bulk/route.ts","src/ai/flows/import-validator.ts",,
Enhancement,Price Monitoring,"Tracks price changes over time for deals and products","Detects price drops and triggers notifications to users","Scheduled Cloud Function samples product prices daily, calculates deltas, flags hot deals",❌,✅,✅,❌,2025-01-12,system,,2,"src/app/api/admin/products/price/route.ts
src/app/api/admin/deals/price/route.ts",src/ai/flows/price-monitor.ts,,
Enhancement,Product Enrichment (AI),"Uses Vertex AI Gemini to enhance product descriptions and categories","Improves product data quality and searchability via AI-generated enhancements","Genkit flow calls Gemini with product schema, generates better title/description/tags",✅,✅,✅,❌,2025-01-15,system,src/app/admin/ai-tools/page.tsx,2,"src/app/api/admin/products/ai/route.ts
src/app/api/admin/deals/ai/route.ts",src/ai/flows/enrichment.ts,,
Enhancement,Image Processing,"Validates, optimizes, and stores product images in Firebase Storage","Ensures image quality, handles multiple formats, generates thumbnails","Downloads from source URLs, validates dimensions/format, resizes for web, uploads to Firebase with CDN",❌,✅,✅,❌,2025-01-11,system,,1,src/app/api/admin/products/images/route.ts,src/ai/flows/image-processor.ts,,
Enhancement,Category Mapping,"Maps external marketplace categories to platform 3-level hierarchy","Normalizes diverse marketplace categories into consistent platform taxonomy","Genkit flow analyzes category names, matches against predefined mappings, suggests categories",❌,✅,✅,❌,2025-01-13,system,,1,src/app/api/admin/categories/map/route.ts,src/ai/flows/category-mapper.ts,,
Translation,Multi-Language UI (next-intl),"i18n framework for Polish/English/German UI translation","Provides route-based locale switching and translated UI components","next-intl middleware intercepts by locale segment, loads JSON catalogs, provides hooks",✅,❌,❌,❌,2024-12-01,system,src/app/[locale]/admin/layout.tsx,0,,,
Translation,Product Description Translation,"Translates product titles and descriptions to multiple languages via Genkit","Makes products discoverable in German/English markets","Genkit flow detects Polish text, calls Gemini to translate, validates quality, stores translations",✅,✅,✅,❌,2025-01-14,system,src/app/admin/products/page.tsx,1,src/app/api/admin/products/translate/route.ts,src/ai/flows/translation.ts,,
Translation,Comment Localization,"Optionally translates user comments for cross-language visibility","Enables cross-language community engagement","On comment creation, detects language, triggers translation flow, stores original + translations",❌,✅,✅,❌,2025-01-12,system,,1,src/app/api/admin/comments/translate/route.ts,src/ai/flows/comment-translate.ts,,
Data Quality,Duplicate Detection,"Identifies and merges duplicate products from multiple import sources","Prevents duplicate listings and improves catalog cleanliness","Compares product title/URL/SKU against catalog, calculates similarity score, flags/merges duplicates",❌,✅,✅,❌,2025-01-11,system,,1,src/app/api/admin/products/deduplicate/route.ts,src/ai/flows/dedup.ts,,
Monitoring,Import Job Status Tracking,"Real-time monitoring of background import jobs and processing status","Provides admins with visibility into import queue, completion rates, error logs","Cloud Function stores job state in Firestore, UI polls endpoint, displays progress and errors",✅,✅,✅,❌,2025-01-15,system,src/app/admin/imports/page.tsx,1,src/app/api/admin/import-jobs/route.ts,src/functions/import-processor.ts,,
Monitoring,Voting & Temperature Algorithm,"Heat-based ranking system that surfaces trending deals/products","Dynamically ranks content based on user engagement without raw vote counts","Calculates temperature from votes + time decay, periodically recalculates hot deals, caches in Redis",✅,✅,✅,✅,2025-01-15,system,src/app/[locale]/deals/page.tsx,2,"src/app/api/admin/deals/heat/route.ts
src/app/api/deals/vote/route.ts",src/lib/data.ts,src/components/deals-list.test.ts,`;

// Parse CSV with quoted fields support
function parseCSV(csv: string) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  
  const tools = lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header.trim()] = (values[i] || '').trim();
    });
    return obj;
  });

  return tools;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const format = req.nextUrl.searchParams.get('format') || 'json';
    
    let csv: string = DEFAULT_TOOLS_CSV;
    
    // Try to get fresh data from GCS
    try {
      const storage = new Storage();
      const bucketName = process.env.GCS_BUCKET || 'okazje-plus-reports';
      const bucket = storage.bucket(bucketName);
      const file = bucket.file('tools-inventory/current.csv');
      const [content] = await file.download();
      csv = content.toString('utf-8');
    } catch (error) {
      // Use embedded/default CSV (no error logged - this is expected before GCS setup)
    }

    // Handle different formats
    if (format === 'csv') {
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="tools-inventory.csv"',
        },
      });
    }

    if (format === 'md') {
      // TODO: Add markdown format support
      const tools = parseCSV(csv);
      const mdLines = ['# Tools Inventory', '', '(Markdown format coming soon)'];
      return new NextResponse(mdLines.join('\n'), {
        headers: { 'Content-Type': 'text/markdown' },
      });
    }

    // Parse CSV to JSON
    const tools = parseCSV(csv);

    // Calculate stats
    const stats = {
      total: tools.length,
      byCategory: {} as Record<string, number>,
      coverage: {
        hasUI: tools.filter(t => t.hasUI === '✅').length,
        hasAPI: tools.filter(t => t.hasAPI === '✅').length,
        hasBackend: tools.filter(t => t.hasBackend === '✅').length,
        hasTests: tools.filter(t => t.hasTests === '✅').length,
      },
      fullyCovered: tools.filter(t => 
        t.hasUI === '✅' && 
        t.hasAPI === '✅' && 
        t.hasBackend === '✅' && 
        t.hasTests === '✅'
      ).length,
    };

    tools.forEach(t => {
      const cat = t.category;
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    return NextResponse.json({ tools, stats });
  } catch (error) {
    console.error('Error reading tools inventory:', error);
    return NextResponse.json(
      { error: 'Failed to read tools inventory', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const { action } = await req.json();

    if (action === 'regenerate') {
      // Run the inventory script
      const { stdout, stderr } = await execAsync('npm run report:tools', {
        cwd: process.cwd(),
      });

      return NextResponse.json({
        success: true,
        message: 'Inventory regenerated successfully',
        output: stdout,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error regenerating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate inventory' },
      { status: 500 }
    );
  }
}
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  
  const tools = lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header.trim()] = (values[i] || '').trim();
    });
    return obj;
  });

  return tools;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const format = req.nextUrl.searchParams.get('format') || 'json';
    
    // Read from Cloud Storage
    const storage = new Storage();
    const bucketName = process.env.GCS_BUCKET || 'okazje-plus-reports';
    const bucket = storage.bucket(bucketName);
    const file = bucket.file('tools-inventory/current.csv');

    let csv: string;
    try {
      const [content] = await file.download();
      csv = content.toString('utf-8');
    } catch (gcsError) {
      // Fallback: try local file if GCS not available
      try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        const csvPath = path.join(process.cwd(), 'docs', 'reports', 'tools-inventory.csv');
        csv = await fs.readFile(csvPath, 'utf-8');
      } catch (fsError) {
        // Final fallback: return empty inventory (prevents 500 errors during migration)
        console.warn('Tools inventory unavailable (GCS + local file not found). Returning empty.');
        return NextResponse.json({
          tools: [],
          stats: {
            total: 0,
            byCategory: {},
            coverage: { hasUI: 0, hasAPI: 0, hasBackend: 0, hasTests: 0 },
            fullyCovered: 0,
          },
          note: 'Inventory temporarily unavailable. GCS bucket not configured yet.'
        });
      }
    }

    // Handle different formats
    if (format === 'csv') {
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="tools-inventory.csv"',
        },
      });
    }

    if (format === 'md') {
      // Try to get markdown from GCS
      try {
        const mdFile = bucket.file('tools-inventory/current.md');
        const [content] = await mdFile.download();
        const md = content.toString('utf-8');
        return new NextResponse(md, {
          headers: { 'Content-Type': 'text/markdown' },
        });
      } catch {
        // Fallback to local MD file
        const { promises: fs } = await import('fs');
        const path = await import('path');
        const mdPath = path.join(process.cwd(), 'docs', 'reports', 'tools-inventory.md');
        const md = await fs.readFile(mdPath, 'utf-8');
        return new NextResponse(md, {
          headers: { 'Content-Type': 'text/markdown' },
        });
      }
    }

    // Parse CSV to JSON
    const tools = parseCSV(csv);

    // Calculate stats
    const stats = {
      total: tools.length,
      byCategory: {} as Record<string, number>,
      coverage: {
        hasUI: tools.filter(t => t.hasUI === '✅').length,
        hasAPI: tools.filter(t => t.hasAPI === '✅').length,
        hasBackend: tools.filter(t => t.hasBackend === '✅').length,
        hasTests: tools.filter(t => t.hasTests === '✅').length,
      },
      fullyCovered: tools.filter(t => 
        t.hasUI === '✅' && 
        t.hasAPI === '✅' && 
        t.hasBackend === '✅' && 
        t.hasTests === '✅'
      ).length,
    };

    tools.forEach(t => {
      const cat = t.category;
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    return NextResponse.json({ tools, stats });
  } catch (error) {
    console.error('Error reading tools inventory:', error);
    return NextResponse.json(
      { error: 'Failed to read tools inventory', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const { action } = await req.json();

    if (action === 'regenerate') {
      // Run the inventory script
      const { stdout, stderr } = await execAsync('npm run report:tools', {
        cwd: process.cwd(),
      });

      return NextResponse.json({
        success: true,
        message: 'Inventory regenerated successfully',
        output: stdout,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error regenerating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate inventory' },
      { status: 500 }
    );
  }
}
