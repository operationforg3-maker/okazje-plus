"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ChevronRight, FolderTree, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubSubcategory { name: string; slug: string; }
interface Subcategory { name: string; slug: string; }
interface CategoryDoc { id: string; name: string; slug?: string; subcategories?: Subcategory[]; }

export function SidebarCategoryTree() {
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'categories'));
        const cats: CategoryDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setCategories(cats);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleCat = (id: string) => setExpandedCats(p => ({ ...p, [id]: !p[id] }));
  const toggleSub = (key: string) => setExpandedSubs(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <FolderTree className="h-3.5 w-3.5" /> Katalog kategorii
      </div>
      {loading && (
        <div className="text-[11px] text-muted-foreground">Ładowanie kategorii...</div>
      )}
      {!loading && categories.length === 0 && (
        <div className="text-[11px] text-muted-foreground">Brak kategorii</div>
      )}
      {categories.map(cat => {
        const catSlug = cat.slug || cat.id;
        const isCatOpen = expandedCats[cat.id];
        return (
          <div key={cat.id} className="border rounded-md bg-card/50">
            <button
              onClick={() => toggleCat(cat.id)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted rounded-t-md', isCatOpen && 'bg-muted')}
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', isCatOpen && 'rotate-90')} />
              <span className="flex-1 truncate">{cat.name}</span>
              <Link href={`/admin/products?mainCategory=${catSlug}`} className="text-[10px] text-primary hover:underline">Produkty</Link>
              <Link href={`/admin/deals?mainCategory=${catSlug}`} className="text-[10px] text-orange-600 hover:underline">Okazje</Link>
            </button>
            {isCatOpen && Array.isArray(cat.subcategories) && cat.subcategories.length > 0 && (
              <div className="px-2 py-1 space-y-1">
                {cat.subcategories.map((sub) => {
                  const subKey = `${cat.id}::${sub.slug}`;
                  const isSubOpen = expandedSubs[subKey];
                  return (
                    <div key={sub.slug} className="rounded border bg-background/50">
                      <button
                        onClick={() => toggleSub(subKey)}
                        className={cn('w-full flex items-center gap-2 px-2 py-1 text-left text-xs hover:bg-muted', isSubOpen && 'bg-muted')}
                      >
                        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isSubOpen && 'rotate-90')} />
                        <span className="flex-1 truncate">{sub.name}</span>
                        <Link href={`/admin/products?mainCategory=${catSlug}&subCategory=${sub.slug}`} className="text-[10px] text-primary hover:underline">P</Link>
                        <Link href={`/admin/deals?mainCategory=${catSlug}&subCategory=${sub.slug}`} className="text-[10px] text-orange-600 hover:underline">O</Link>
                      </button>
                      {isSubOpen && (
                        <div className="ml-4 py-1 space-y-0.5">
                          {/* TODO: Load sub-subcategories from nested subcollection if needed */}
                          <div className="text-[10px] text-muted-foreground italic pl-2 flex items-center gap-1"><Boxes className="h-3 w-3" /> Brak głębszych poziomów</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
