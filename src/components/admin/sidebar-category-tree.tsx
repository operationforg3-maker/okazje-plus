"use client";

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ChevronRight, FolderTree, Boxes, Filter, Search, RefreshCcw, CheckCircle, XCircle, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubSubcategory { name: string; slug: string; }
interface Subcategory { name: string; slug: string; }
interface CategoryDoc { id: string; name: string; slug?: string; subcategories?: Subcategory[]; }

export function SidebarCategoryTree() {
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [moderationFilter, setModerationFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'high-discount'>('all');
  const [catCounts, setCatCounts] = useState<Record<string, { products: number; deals: number; pendingDeals: number }>>({});
  const [subCounts, setSubCounts] = useState<Record<string, { products: number; deals: number; pendingDeals: number }>>({});

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

  // Fuzzy search (prosty lowercase contains)
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

  // Lazy liczniki dla otwartych węzłów
  useEffect(() => {
    async function loadCountsForCategory(cat: CategoryDoc) {
      const catSlug = cat.slug || cat.id;
      try {
        const dealsApprovedQ = query(collection(db, 'deals'), where('mainCategorySlug', '==', catSlug), where('status', '==', 'approved'));
        const dealsPendingQ = query(collection(db, 'deals'), where('mainCategorySlug', '==', catSlug), where('status', '==', 'pending'));
        const productsQ = query(collection(db, 'products'), where('mainCategorySlug', '==', catSlug), where('status', '==', 'approved'));
        const [c1, c2, c3] = await Promise.all([
          getCountFromServer(dealsApprovedQ),
          getCountFromServer(dealsPendingQ),
          getCountFromServer(productsQ)
        ]);
        setCatCounts(prev => ({
          ...prev,
          [cat.id]: { deals: c1.data().count, pendingDeals: c2.data().count, products: c3.data().count }
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

  useEffect(() => {
    async function loadCountsForSub(cat: CategoryDoc, sub: Subcategory) {
      const catSlug = cat.slug || cat.id;
      const key = `${cat.id}::${sub.slug}`;
      try {
        const dealsApprovedQ = query(collection(db, 'deals'), where('mainCategorySlug', '==', catSlug), where('subCategorySlug', '==', sub.slug), where('status', '==', 'approved'));
        const dealsPendingQ = query(collection(db, 'deals'), where('mainCategorySlug', '==', catSlug), where('subCategorySlug', '==', sub.slug), where('status', '==', 'pending'));
        const productsQ = query(collection(db, 'products'), where('mainCategorySlug', '==', catSlug), where('subCategorySlug', '==', sub.slug), where('status', '==', 'approved'));
        const [c1, c2, c3] = await Promise.all([
          getCountFromServer(dealsApprovedQ),
          getCountFromServer(dealsPendingQ),
          getCountFromServer(productsQ)
        ]);
        setSubCounts(prev => ({
          ...prev,
          [key]: { deals: c1.data().count, pendingDeals: c2.data().count, products: c3.data().count }
        }));
      } catch {
        // ignore
      }
    }
    Object.entries(expandedSubs).forEach(([key, open]) => {
      if (open) {
        const [catId, subSlug] = key.split('::');
        const cat = categories.find(c => c.id === catId);
        const sub = cat?.subcategories?.find(s => s.slug === subSlug);
        if (cat && sub && !subCounts[key]) loadCountsForSub(cat, sub);
      }
    });
  }, [expandedSubs, categories, subCounts]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <FolderTree className="h-3.5 w-3.5" /> Katalog kategorii
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Filter className="h-3 w-3" />
            <select
              className="border rounded px-1 py-0.5 text-[11px] bg-background"
              value={moderationFilter}
              onChange={e => setModerationFilter(e.target.value as any)}
            >
              <option value="all">Wszystko</option>
              <option value="pending">Oczekujące</option>
              <option value="approved">Zaakceptowane</option>
              <option value="rejected">Odrzucone</option>
              <option value="high-discount">Duży rabat</option>
            </select>
          </div>
          <div className="relative">
            <Search className="h-3 w-3 absolute left-1 top-1.5 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Szukaj kategorii"
              className="pl-5 pr-2 py-1 text-[11px] border rounded bg-background w-40"
            />
          </div>
        </div>
      </div>
      {loading && (
        <div className="text-[11px] text-muted-foreground">Ładowanie kategorii...</div>
      )}
      {!loading && categories.length === 0 && (
        <div className="text-[11px] text-muted-foreground">Brak kategorii</div>
      )}
      {filteredCategories.map(cat => {
        const catSlug = cat.slug || cat.id;
        const isCatOpen = expandedCats[cat.id];
        const counts = catCounts[cat.id];
        return (
          <div key={cat.id} className="border rounded-md bg-card/50">
            <button
              onClick={() => toggleCat(cat.id)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted rounded-t-md', isCatOpen && 'bg-muted')}
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', isCatOpen && 'rotate-90')} />
              <span className="flex-1 truncate">{cat.name}</span>
              {counts && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" /> {counts.deals}
                  <span className="px-1 rounded bg-muted">P: {counts.products}</span>
                  <span className="px-1 rounded bg-muted">Ocz: {counts.pendingDeals}</span>
                </span>
              )}
              <Link href={`/admin/products?mainCategory=${catSlug}&filter=${moderationFilter}`} className="text-[10px] text-primary hover:underline">Produkty</Link>
              <Link href={`/admin/deals?mainCategory=${catSlug}&filter=${moderationFilter}`} className="text-[10px] text-orange-600 hover:underline">Okazje</Link>
            </button>
            {isCatOpen && Array.isArray(cat.subcategories) && cat.subcategories.length > 0 && (
              <div className="px-2 py-1 space-y-1">
                {cat.subcategories.map((sub) => {
                  const subKey = `${cat.id}::${sub.slug}`;
                  const isSubOpen = expandedSubs[subKey];
                  const subC = subCounts[subKey];
                  return (
                    <div key={sub.slug} className="rounded border bg-background/50">
                      <button
                        onClick={() => toggleSub(subKey)}
                        className={cn('w-full flex items-center gap-2 px-2 py-1 text-left text-xs hover:bg-muted', isSubOpen && 'bg-muted')}
                      >
                        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isSubOpen && 'rotate-90')} />
                        <span className="flex-1 truncate">{sub.name}</span>
                        {subC && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            P:{subC.products} O:{subC.deals} Ocz:{subC.pendingDeals}
                          </span>
                        )}
                        <Link href={`/admin/products?mainCategory=${catSlug}&subCategory=${sub.slug}&filter=${moderationFilter}`} className="text-[10px] text-primary hover:underline">P</Link>
                        <Link href={`/admin/deals?mainCategory=${catSlug}&subCategory=${sub.slug}&filter=${moderationFilter}`} className="text-[10px] text-orange-600 hover:underline">O</Link>
                      </button>
                      {isSubOpen && (
                        <div className="ml-4 py-1 space-y-0.5">
                          {/* TODO: Load sub-subcategories from nested subcollection if needed */}
                          <div className="text-[10px] text-muted-foreground italic pl-2 flex items-center gap-1"><Boxes className="h-3 w-3" /> Brak głębszych poziomów</div>
                          <div className="flex items-center gap-2 pl-2">
                            <Link href={`/admin/moderation/bulk?action=approve&mainCategory=${catSlug}&subCategory=${sub.slug}`} className="text-[10px] text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="h-3 w-3" />Akceptuj wszystkie oczekujące</Link>
                            <Link href={`/admin/moderation/bulk?action=reject&mainCategory=${catSlug}&subCategory=${sub.slug}`} className="text-[10px] text-red-600 hover:underline flex items-center gap-1"><XCircle className="h-3 w-3" />Odrzuć wszystkie oczekujące</Link>
                            <Link href={`/admin/ai-tools?run=fillDeals&mainCategory=${catSlug}&subCategory=${sub.slug}`} className="text-[10px] text-primary hover:underline flex items-center gap-1"><RefreshCcw className="h-3 w-3" />Odśwież import okazji</Link>
                          </div>
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
