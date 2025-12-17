import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAdmin } from '@/lib/auth-server';

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const format = req.nextUrl.searchParams.get('format') || 'json';
    const reportsDir = path.join(process.cwd(), 'docs', 'reports');

    if (format === 'csv') {
      const csvPath = path.join(reportsDir, 'tools-inventory.csv');
      const csv = await fs.readFile(csvPath, 'utf-8');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="tools-inventory.csv"',
        },
      });
    }

    if (format === 'md') {
      const mdPath = path.join(reportsDir, 'tools-inventory.md');
      const md = await fs.readFile(mdPath, 'utf-8');
      return new NextResponse(md, {
        headers: { 'Content-Type': 'text/markdown' },
      });
    }

    // Parse CSV to JSON
    const csvPath = path.join(reportsDir, 'tools-inventory.csv');
    const csv = await fs.readFile(csvPath, 'utf-8');
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    
    const tools = lines.slice(1).map(line => {
      // Simple CSV parser (handles quoted fields)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
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
        obj[header] = values[i] || '';
      });
      return obj;
    });

    // Calculate stats
    const stats = {
      total: tools.length,
      byCategory: {} as Record<string, number>,
      coverage: {
        hasUI: tools.filter(t => t.hasUI === 'yes').length,
        hasAPI: tools.filter(t => t.hasAPI === 'yes').length,
        hasBackend: tools.filter(t => t.hasBackend === 'yes').length,
        hasTests: tools.filter(t => t.hasTests === 'yes').length,
      },
      fullyCovered: tools.filter(t => 
        t.hasUI === 'yes' && 
        t.hasAPI === 'yes' && 
        t.hasBackend === 'yes' && 
        t.hasTests === 'yes'
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
      { error: 'Failed to read tools inventory' },
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
