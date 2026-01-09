import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/data';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    const categories = await getCategories();
    
    return NextResponse.json({
      ok: true,
      count: categories.length,
      subcount: categories.reduce((sum, c) => sum + (c.subcategories?.length || 0), 0),
      categories,
    });
  } catch (error) {
    console.error('[categories/index] Error:', error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
