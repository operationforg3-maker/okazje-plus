'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { getHotDeals, getCategories, getNavigationShowcase, getProductById, getDealsByCategory } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';
import { Deal, Category, Product } from '@/lib/types';
import DealCard from '@/components/deal-card';
import DealListCard from '@/components/deal-list-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Search, ChevronRight, Flame, Sparkles, ArrowRight, Filter, Menu, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'grid';

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [productOfTheDay, setProductOfTheDay] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Wczytaj zapisany tryb widoku przy pierwszym renderze
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('deals_view_mode');
      if (savedView === 'list' || savedView === 'grid') {
        setViewMode(savedView);
      }
    } catch {
      // localStorage może być niedostępny w trybie incognito - ignoruj
    }
  }, []);

  // Wczytaj zapisaną kategorię / podkategorię gdy tylko będą dostępne kategorie
  useEffect(() => {
    if (categories.length === 0) return;
    // Jeśli użytkownik już coś wybrał w tej sesji – nie nadpisuj
    if (selectedCategory) return;
    try {
      const savedCatId = localStorage.getItem('deals_selected_category');
      if (savedCatId) {
        const found = categories.find(c => c.id === savedCatId);
        if (found) {
          setSelectedCategory(found);
          const savedSub = localStorage.getItem('deals_selected_subcategory');
          if (savedSub) setSelectedSubcategory(savedSub);
        }
      }
    } catch {}
  }, [categories]);

  // Persistuj view mode
  useEffect(() => {
    try { 
      localStorage.setItem('deals_view_mode', viewMode); 
    } catch {
      // localStorage może być niedostępny - ignoruj
    }
  }, [viewMode]);

  // Persistuj kategorię
  useEffect(() => {
    try {
      if (selectedCategory) {
        localStorage.setItem('deals_selected_category', selectedCategory.id);
      } else {
        localStorage.removeItem('deals_selected_category');
      }
    } catch {
      // localStorage może być niedostępny - ignoruj
    }
  }, [selectedCategory]);

  // Persistuj podkategorię
  useEffect(() => {
    try {
      if (selectedSubcategory) {
        localStorage.setItem('deals_selected_subcategory', selectedSubcategory);
      } else {
        localStorage.removeItem('deals_selected_subcategory');
      }
    } catch {
      // localStorage może być niedostępny - ignoruj
    }
  }, [selectedSubcategory]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [fetchedCategories, showcaseConfig, hotDeals] = await Promise.all([
          getCategories(),
          getNavigationShowcase(),
          getHotDeals(100), // Pobierz gorące okazje na start
        ]);
        
        setCategories(fetchedCategories);
        setDeals(hotDeals); // Ustaw deals od razu
        // NIE ustawiamy selectedCategory - pozostaw null aby pokazać wszystkie

        // Pobierz product of the day
        if (showcaseConfig?.productOfTheDayId) {
          const product = await getProductById(showcaseConfig.productOfTheDayId);
          setProductOfTheDay(product);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Pobierz deals przy zmianie kategorii / subkategorii / wyszukiwaniu
  useEffect(() => {
    let cancelled = false;
    async function fetchDeals() {
      setIsLoading(true);
      try {
        const q = searchTerm.trim();
        if (q.length > 1) {
          // Wyszukiwanie
          const results = await searchDealsTypesense(q, {
            mainCategorySlug: selectedCategory?.id,
            subCategorySlug: selectedSubcategory || undefined,
            limit: 100,
          });
          if (!cancelled) setDeals(results);
        } else if (selectedCategory) {
          // Filtrowanie według kategorii
          const categoryDeals = await getDealsByCategory(
            selectedCategory.id,
            selectedSubcategory || undefined,
            undefined, // subSubCategorySlug - na razie nie używamy
            100
          );
          if (!cancelled) setDeals(categoryDeals);
        } else {
          // Brak filtrów - pokaż gorące okazje
          const hotDeals = await getHotDeals(100);
          if (!cancelled) setDeals(hotDeals);
        }
      } catch (error) {
        console.error('Error fetching deals:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    const t = setTimeout(fetchDeals, 250); // debounce
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedCategory, selectedSubcategory, searchTerm]);

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = !searchTerm || 
      deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const priceFormatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  });

  // Sidebar Content (reusable for desktop and mobile) – na wzór strony produktów
  const SidebarContent = () => (
    <div className="space-y-2">
      <h2 className="font-headline text-lg font-semibold mb-4">Kategorie</h2>
      <ScrollArea className="h-[calc(100vh-200px)] lg:h-[600px] pr-1">
        {/* Przycisk "Wszystkie" */}
        <div className="mb-1">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedSubcategory(null);
              setIsMobileSidebarOpen(false);
            }}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group",
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <Flame className="h-5 w-5" />
            <span className="font-medium flex-1">Wszystkie okazje</span>
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              !selectedCategory ? "rotate-90" : "group-hover:translate-x-1"
            )} />
          </button>
        </div>

        {categories.map((category) => {
          const isActive = selectedCategory?.id === category.id;
          return (
            <div key={category.id} className="mb-1">
              <button
                onClick={() => {
                  setSelectedCategory(category);
                  setSelectedSubcategory(null);
                  setIsMobileSidebarOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {category.icon && <span className="text-xl">{category.icon}</span>}
                <span className="font-medium flex-1">{category.name}</span>
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  isActive ? "rotate-90" : "group-hover:translate-x-1"
                )} />
              </button>

              {isActive && category.subcategories.length > 0 && (
                <div className="mt-1 ml-2 space-y-1 border-l pl-3">
                  {category.subcategories.map((sub) => {
                    const subActive = selectedSubcategory === sub.slug;
                    return (
                      <button
                        key={sub.slug}
                        onClick={() => setSelectedSubcategory(subActive ? null : sub.slug)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                          subActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted"
                        )}
                      >
                        {sub.icon && <span className="text-base">{sub.icon}</span>}
                        <span className="flex-1 truncate">{sub.name}</span>
                        {sub.highlight && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">Nowość</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Strona główna
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">Okazje</span>
            {selectedCategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedCategory.name}</span>
              </>
            )}
            {selectedSubcategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedSubcategory}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Mega Menu Style */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 py-4 lg:py-6">
            {/* Mobile Filter Button */}
            <div className="lg:hidden col-span-1 mb-2">
              <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Filter className="mr-2 h-4 w-4" />
                    Kategorie i filtry
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] p-6">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
            </div>

            {/* Left Sidebar - Categories (Desktop only) */}
            <div className="hidden lg:block lg:col-span-3">
              <SidebarContent />
            </div>

            {/* Center Content - Subcategories & Deals */}
            <div className="col-span-1 lg:col-span-6">
              {/* Search Bar */}
              <div className="mb-4 lg:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj w okazjach..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Subcategories */}
              {selectedCategory && (
                <div className="mb-4 lg:mb-6">
                  <h3 className="font-headline text-base font-semibold mb-3">
                    {selectedCategory.name}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedCategory.subcategories.map((sub) => (
                      <button
                        key={sub.slug}
                        onClick={() => setSelectedSubcategory(
                          selectedSubcategory === sub.slug ? null : sub.slug
                        )}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all duration-200 hover:border-primary",
                          selectedSubcategory === sub.slug
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {sub.icon && <span className="text-lg">{sub.icon}</span>}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{sub.name}</p>
                            {sub.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {sub.description}
                              </p>
                            )}
                          </div>
                          {sub.highlight && (
                            <Badge variant="secondary" className="text-xs">Nowość</Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Deals List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-headline text-base font-semibold">
                    🔥 Okazje ({filteredDeals.length})
                  </h3>
                  
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 border rounded-lg p-1">
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8 px-3"
                    >
                      <List className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Lista</span>
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="h-8 px-3"
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Kafelki</span>
                    </Button>
                  </div>
                </div>
                {isLoading ? (
                  <div className={cn(
                    viewMode === 'list' ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"
                  )}>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={cn(
                        "bg-muted animate-pulse rounded-lg",
                        viewMode === 'list' ? "h-48" : "h-96"
                      )} />
                    ))}
                  </div>
                ) : filteredDeals.length > 0 ? (
                  viewMode === 'list' ? (
                    <div className="space-y-4">
                      {filteredDeals.slice(0, 20).map((deal) => (
                        <DealListCard key={deal.id} deal={deal} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredDeals.slice(0, 20).map((deal) => (
                        <DealCard key={deal.id} deal={deal} />
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Brak okazji w tej kategorii</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar - Product of the Day & Promo (Hidden on mobile/tablet) */}
            <div className="hidden xl:block xl:col-span-3 space-y-6">
              {/* Product of the Day */}
              {productOfTheDay && (
                <Card className="overflow-hidden border-2 border-primary/20">
                  <CardContent className="p-0">
                    <div className="relative">
                      {productOfTheDay.image && (
                        <Image
                          src={productOfTheDay.image}
                          alt={productOfTheDay.name}
                          width={300}
                          height={200}
                          className="w-full aspect-video object-cover"
                        />
                      )}
                      <Badge className="absolute top-2 left-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Produkt Dnia
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <h4 className="font-headline font-semibold line-clamp-2">
                        {productOfTheDay.name}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          {priceFormatter.format(productOfTheDay.price)}
                        </span>
                        {productOfTheDay.ratingCard && (
                          <Badge variant="secondary">
                            ⭐ {productOfTheDay.ratingCard.average.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/products/${productOfTheDay.id}`}>
                          Zobacz produkt
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Promoted Category */}
              {selectedCategory?.promo && (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {selectedCategory.promo.image && (
                      <div className="relative">
                        <Image
                          src={selectedCategory.promo.image}
                          alt={selectedCategory.promo.title}
                          width={300}
                          height={150}
                          className="w-full aspect-[2/1] object-cover"
                        />
                        {selectedCategory.promo.badge && (
                          <Badge className="absolute top-2 right-2">
                            {selectedCategory.promo.badge}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <h4 className="font-headline font-semibold">
                        {selectedCategory.promo.title}
                      </h4>
                      {selectedCategory.promo.description && (
                        <p className="text-sm text-muted-foreground">
                          {selectedCategory.promo.description}
                        </p>
                      )}
                      {selectedCategory.promo.link && (
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link href={selectedCategory.promo.link}>
                            {selectedCategory.promo.cta || 'Zobacz więcej'}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Gorące okazje</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sprawdź produkty z najwyższymi ocenami i opiniami
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href="/products">
                        Zobacz produkty
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

