import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { requireAdmin } from '@/lib/auth-server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
