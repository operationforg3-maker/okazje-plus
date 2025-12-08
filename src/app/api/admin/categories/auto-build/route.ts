import { NextRequest, NextResponse } from 'next/server';
import { CATEGORY_STRUCTURE } from '@/lib/category-structure';
import { adminDb } from '@/lib/firebase-admin';
import { checkAdminAuth } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    let written = 0;
    for (const main of CATEGORY_STRUCTURE) {
      const mainRef = adminDb.collection('categories').doc(main.slug);
      await mainRef.set({
        id: main.slug,
        slug: main.slug,
        name: main.name,
        description: main.description || '',
        icon: main.icon || '📂',
        sortOrder: main.sortOrder || 0,
        updatedAt: new Date(),
      }, { merge: true });
      written++;

      const subcats = main.subcategories || [];
      for (const sub of subcats) {
        const subRef = mainRef.collection('subcategories').doc(sub.slug);
        await subRef.set({
          slug: sub.slug,
          name: sub.name,
          description: sub.description || '',
          icon: sub.icon || '',
          sortOrder: (sub as any).sortOrder || 0,
          updatedAt: new Date(),
        }, { merge: true });
        written++;

        const subsubs = sub.subcategories || [];
        for (const subsub of subsubs) {
          const subSubRef = subRef.collection('subcategories').doc(subsub.slug);
          await subSubRef.set({
            slug: subsub.slug,
            name: subsub.name,
            description: subsub.description || '',
            icon: subsub.icon || '',
            sortOrder: (subsub as any).sortOrder || 0,
            importKeywords: (subsub as any).aliexpressKeywords || (subsub as any).importKeywords || [],
            updatedAt: new Date(),
          }, { merge: true });
          written++;
        }
      }
    }

    return NextResponse.json({ success: true, created: written, categories: CATEGORY_STRUCTURE.length });
  } catch (err: any) {
    console.error('auto-build categories failed', err);
    return NextResponse.json({ error: err?.message || 'Failed to auto-build categories' }, { status: 500 });
  }
}
