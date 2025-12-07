"use client";

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ChevronRight, FolderTree, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubSubcategory { name: string; slug: string; }
interface Subcategory { name: string; slug: string; subcategories?: SubSubcategory[]; }
interface CategoryDoc { id: string; name: string; slug?: string; subcategories?: Subcategory[]; }

export function SidebarCategoryTree() {
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [catCounts, setCatCounts] = useState<Record<string, { products: number; deals: number }>>({});
  const [subCounts, setSubCounts] = useState<Record<string, { products: number; deals: number }>>({});

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

  // Fuzzy search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    const term = searchTerm.toLowerCase();
    return categories
      .map(cat => {
        const matchCat = (cat.name || '').toLowerCase().includes(term);
        const subs = Array.isArray(cat.subcategories)
          ? cat.subcategories.filter(s => (s.name || '').toLowerCase().includes(term))
          : [];
        if (matchCat || subs.length > 0) {
          return { ...cat, subcategories: subs.length > 0 ? subs : cat.subcategories };
        }
        return null;
      })
      .filter(Boolean) as CategoryDoc[];
  }, [categories, searchTerm]);

  // Lazy liczniki dla kategorii
  useEffect(() => {
    async function loadCountsForCategory(cat: CategoryDoc) {
      const catSlug = cat.slug || cat.id;
      try {
        const dealsQ = query(collection(db, 'deals'), where('mainCategorySlug', '==', catSlug), where('status', '==', 'approved'));
        const productsQ = query(collection(db, 'products'), where('mainCategorySlug', '==', catSlug), where('status', '==', 'approved'));
        const [c1, c2] = await Promise.all([
          getCountFromServer(dealsQ),
          getCountFromServer(productsQ)
        ]);
        setCatCounts(prev => ({
          ...prev,
          [cat.id]: { deals: c1.data().count, products: c2.data().count }
        }));
      } catch {
        // ignore
      }
    }
    Object.entries(expandedCats).forEach(([id, open]) => {
      if (open) {
        const cat = categories.find(c => c.id === id);
        if (cat && !catCounts[id]) loadCountsForCategory(cat);
      }
    });
  }, [expandedCats, categories, catCounts]);

  // Lazy liczniki dla podkategorii
  useEffect(() => {
    async function loadCountsForSub(cat: CategoryDoc, sub: Subcategory) {
      const catSlug = cat.slug || cat.id;
      const key = `${cat.id}::${sub.slug}`;
      try {
        const dealsQ = query(collection(db, 'deals'), where('mainCategorySlug', '==', catSlug), where('subCategorySlug', '==', sub.slug), where('status', '==', 'approved'));
        const productsQ = query(collection(db, 'products'), where('mainCategorySlug', '==', catSlug), where('subCategorySlug', '==', sub.slug), where('status', '==', 'approved'));
        const [c1, c2] = await Promise.all([
          getCountFromServer(dealsQ),
          getCountFromServer(productsQ)
        ]);
        setSubCounts(prev => ({
          ...prev,
          [key]: { deals: c1.data().count, products: c2.data().count }
        }));
      } catch {
        // ignore
      }
    }
    Object.entries(expandedCats).forEach(([catId, open]) => {
      if (open) {
        const cat = categories.find(c => c.id === catId);
        if (cat && Array.isArray(cat.subcategories)) {
          cat.subcategories.forEach(sub => {
            const key = `${catId}::${sub.slug}`;
            if (!subCounts[key]) loadCountsForSub(cat, sub);
          });
        }
      }
    });
  }, [expandedCats, categories, subCounts]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <FolderTree className="h-3 w-3" /> Szybka nawigacja
        </div>
        <div className="relative">
          <Search className="h-3 w-3 absolute left-1.5 top-1.5 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Szukaj..."
            className="pl-6 pr-2 py-1 text-[10px] border rounded bg-background w-32"
          />
        </div>
      </div>
      {loading && (
        <div className="text-[10px] text-muted-foreground">Ładowanie...</div>
      )}
      {!loading && filteredCategories.length === 0 && (
        <div className="text-[10px] text-muted-foreground">Brak kategorii</div>
      )}
      {filteredCategories.map(cat => {
        const catSlug = cat.slug || cat.id;
        const isCatOpen = expandedCats[cat.id];
        const counts = catCounts[cat.id];
        return (
          <div key={cat.id} className="border rounded bg-card/30">
            <button
              onClick={() => toggleCat(cat.id)}
              className={cn('w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs hover:bg-muted rounded transition-colors', isCatOpen && 'bg-muted')}
            >
              <ChevronRight className={cn('h-3 w-3 transition-transform shrink-0', isCatOpen && 'rotate-90')} />
              <span className="flex-1 truncate text-xs font-medium">{cat.name}</span>
              {counts && (
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span className="px-1 py-0.5 rounded bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">{counts.deals}</span>
                  <span className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{counts.products}</span>
                </div>
              )}
            </button>
            {isCatOpen && Array.isArray(cat.subcategories) && cat.subcategories.length > 0 && (
              <div className="px-1.5 py-1 space-y-0.5 bg-muted/30">
                {cat.subcategories.map((sub) => {
                  const subKey = `${cat.id}::${sub.slug}`;
                  const subC = subCounts[subKey];
                  return (
                    <div key={sub.slug} className="space-y-0.5">
                      <Link
                        href={`/admin/products?mainCategory=${catSlug}&subCategory=${sub.slug}`}
                        className="flex items-center gap-1.5 px-2 py-1 text-[10px] hover:bg-background rounded transition-colors group"
                      >
                        <span className="flex-1 truncate group-hover:text-primary">{sub.name}</span>
                        {subC && (
                          <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                            <span className="px-1 py-0.5 rounded bg-background">{subC.deals}D</span>
                            <span className="px-1 py-0.5 rounded bg-background">{subC.products}P</span>
                          </div>
                        )}
                      </Link>
                      {Array.isArray(sub.subcategories) && sub.subcategories.length > 0 && (
                        <div className="pl-3 border-l border-dashed border-muted-foreground/40 space-y-0.5">
                          {sub.subcategories.map(subsub => (
                            <Link
                              key={subsub.slug}
                              href={`/admin/products?mainCategory=${catSlug}&subCategory=${sub.slug}&subSubCategory=${subsub.slug}`}
                              className="flex items-center gap-1.5 px-2 py-1 text-[9px] hover:bg-background rounded transition-colors"
                            >
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">{subsub.name}</span>
                            </Link>
                          ))}
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
