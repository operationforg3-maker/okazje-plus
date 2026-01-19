"use client";

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChevronRight, FolderTree, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';

interface SubSubcategory { name: string; slug: string; }
interface Subcategory { name: string; slug: string; subcategories?: SubSubcategory[]; }
interface CategoryDoc { id: string; name: string; slug?: string; subcategories?: Subcategory[]; }

export function CategoryFilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const mainCategory = searchParams.get('mainCategory');
  const subCategory = searchParams.get('subCategory');
  const subSubCategory = searchParams.get('subSubCategory');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'categories'));
        const cats: CategoryDoc[] = await Promise.all(
          snap.docs.map(async (doc) => {
            const data = doc.data() as any;
            
            // Załaduj podkategorie z subcollection
            const subcategoriesRef = collection(db, 'categories', doc.id, 'subcategories');
            const subSnap = await getDocs(subcategoriesRef);
            
            let subcategories: Subcategory[] = [];
            if (!subSnap.empty) {
              subcategories = await Promise.all(
                subSnap.docs.map(async (subDoc) => {
                  const subData = subDoc.data() as any;
                  
                  // Załaduj sub-subkategorie
                  const subSubRef = collection(db, 'categories', doc.id, 'subcategories', subDoc.id, 'subcategories');
                  const subSubSnap = await getDocs(subSubRef);
                  
                  let subSubcategories: SubSubcategory[] = [];
                  if (!subSubSnap.empty) {
                    subSubcategories = subSubSnap.docs.map((ssDoc) => ({
                      name: ssDoc.data().name || ssDoc.id,
                      slug: ssDoc.data().slug || ssDoc.id,
                    }));
                  }
                  
                  return {
                    name: subData.name || subDoc.id,
                    slug: subData.slug || subDoc.id,
                    subcategories: subSubcategories.length > 0 ? subSubcategories : (subData.subcategories || []),
                  };
                })
              );
            } else if (Array.isArray(data.subcategories)) {
              subcategories = data.subcategories;
            }
            
            return {
              id: doc.id,
              name: data.name || doc.id,
              slug: data.slug || doc.id,
              subcategories,
            };
          })
        );
        setCategories(cats);
        
        // Auto-expand aktywnej kategorii
        if (mainCategory) {
          const cat = cats.find(c => (c.slug || c.id) === mainCategory);
          if (cat) {
            setExpandedCats({ [cat.id]: true });
            if (subCategory) {
              setExpandedSubs({ [`${cat.id}::${subCategory}`]: true });
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mainCategory, subCategory]);

  const toggleCat = (id: string) => setExpandedCats(p => ({ ...p, [id]: !p[id] }));
  const toggleSub = (key: string) => setExpandedSubs(p => ({ ...p, [key]: !p[key] }));

  const updateUrl = (main?: string, sub?: string, subsub?: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    
    if (main) {
      params.set('mainCategory', main);
    } else {
      params.delete('mainCategory');
    }
    
    if (sub) {
      params.set('subCategory', sub);
    } else {
      params.delete('subCategory');
    }
    
    if (subsub) {
      params.set('subSubCategory', subsub);
    } else {
      params.delete('subSubCategory');
    }
    
    router.replace(`?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete('mainCategory');
    params.delete('subCategory');
    params.delete('subSubCategory');
    router.replace(`?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="w-64 border-r border-border p-4">
        <div className="text-sm text-muted-foreground">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Kategorie
          </div>
          {(mainCategory || subCategory || subSubCategory) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {(mainCategory || subCategory || subSubCategory) && (
          <div className="text-xs text-muted-foreground">
            Aktywne filtry:
            {mainCategory && <div className="mt-1 truncate">• {mainCategory}</div>}
            {subCategory && <div className="truncate">• {subCategory}</div>}
            {subSubCategory && <div className="truncate">• {subSubCategory}</div>}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {categories.map(cat => {
            const catSlug = cat.slug || cat.id;
            const isCatOpen = expandedCats[cat.id];
            const isCatActive = mainCategory === catSlug;
            
            return (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleCat(cat.id)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-muted rounded transition-colors flex-1',
                      isCatActive && 'bg-primary/10 font-medium'
                    )}
                  >
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <ChevronRight className={cn('h-3 w-3 transition-transform shrink-0', isCatOpen && 'rotate-90')} />
                    )}
                    <span className="truncate flex-1 text-left">{cat.name}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateUrl(catSlug)}
                    className={cn('h-7 px-2 text-xs', isCatActive && 'bg-primary text-primary-foreground')}
                  >
                    Filtruj
                  </Button>
                </div>
                
                {isCatOpen && cat.subcategories && cat.subcategories.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {cat.subcategories.map(sub => {
                      const subKey = `${cat.id}::${sub.slug}`;
                      const isSubOpen = expandedSubs[subKey];
                      const isSubActive = mainCategory === catSlug && subCategory === sub.slug;
                      
                      return (
                        <div key={sub.slug} className="space-y-1">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleSub(subKey)}
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 text-xs hover:bg-muted rounded transition-colors flex-1',
                                isSubActive && 'bg-primary/10 font-medium'
                              )}
                            >
                              {sub.subcategories && sub.subcategories.length > 0 && (
                                <ChevronRight className={cn('h-3 w-3 transition-transform shrink-0', isSubOpen && 'rotate-90')} />
                              )}
                              <span className="truncate flex-1 text-left">{sub.name}</span>
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateUrl(catSlug, sub.slug)}
                              className={cn('h-6 px-1.5 text-xs', isSubActive && 'bg-primary text-primary-foreground')}
                            >
                              Filtruj
                            </Button>
                          </div>
                          
                          {isSubOpen && sub.subcategories && sub.subcategories.length > 0 && (
                            <div className="ml-4 space-y-0.5">
                              {sub.subcategories.map(subsub => {
                                const isSubSubActive = mainCategory === catSlug && subCategory === sub.slug && subSubCategory === subsub.slug;
                                
                                return (
                                  <div key={subsub.slug} className="flex items-center gap-1">
                                    <span className={cn(
                                      'px-2 py-1 text-xs rounded flex-1 truncate',
                                      isSubSubActive && 'bg-primary/10 font-medium'
                                    )}>
                                      {subsub.name}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => updateUrl(catSlug, sub.slug, subsub.slug)}
                                      className={cn('h-6 px-1.5 text-xs', isSubSubActive && 'bg-primary text-primary-foreground')}
                                    >
                                      Filtruj
                                    </Button>
                                  </div>
                                );
                              })}
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
      </div>
    </div>
  );
}
