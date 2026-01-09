import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const cats = await getAllCategories();
    const tree = [] as any[];
    for (const c of cats) {
      const subs = await getSubcategories(c.id);
      const subNodes = [] as any[];
      for (const s of subs) {
        const subsubs = await getSubSubcategories(c.id, s.id);
        subNodes.push({ id: s.id, name: s.name, slug: s.slug, subcategories: subsubs.map(ss => ({ id: ss.id, name: ss.name, slug: ss.slug })) });
      }
      tree.push({ id: c.id, name: c.name, slug: c.slug, subcategories: subNodes });
    }
    return NextResponse.json({ tree });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load categories' }, { status: 500 });
  }
}
