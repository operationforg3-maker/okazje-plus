'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getRecommendedProducts, getProductsByCategory, getCategories, getDealById, getNavigationShowcase } from '@/lib/data';
import { searchProductsTypesense } from '@/lib/search';
import ProductCard from '@/components/product-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Search, ChevronRight, Flame, Sparkles, ArrowRight, Filter } from 'lucide-react';
import { Category, Product, Deal } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dealOfTheDay, setDealOfTheDay] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Wczytaj kategorie i ustaw z URL
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [fetchedCategories, showcaseConfig] = await Promise.all([
          getCategories(),
          getNavigationShowcase(),
        ]);
        
        setCategories(fetchedCategories);
        
        // Sprawdź parametry URL
        const mainCategoryParam = searchParams.get('mainCategory');
        const subCategoryParam = searchParams.get('subCategory');
        
        if (mainCategoryParam && fetchedCategories.length > 0) {
          const foundCategory = fetchedCategories.find(c => c.id === mainCategoryParam || c.slug === mainCategoryParam);
          if (foundCategory) {
            setSelectedCategory(foundCategory);
            if (subCategoryParam) {
              setSelectedSubcategory(subCategoryParam);
            }
          } else {
            // Fallback do pierwszej kategorii
            setSelectedCategory(fetchedCategories[0]);
          }
        } else if (fetchedCategories.length > 0) {
          setSelectedCategory(fetchedCategories[0]);
        }

        // Pobierz deal of the day
        if (showcaseConfig?.dealOfTheDayId) {
          const deal = await getDealById(showcaseConfig.dealOfTheDayId);
          setDealOfTheDay(deal);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [searchParams]);

  // Pobierz produkty przy zmianie kategorii / subkategorii / wyszukiwaniu
  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      if (!selectedCategory) return;
      setIsLoading(true);
      try {
        const q = searchTerm.trim();
        if (q.length > 1) {
          const results = await searchProductsTypesense(q, {
            mainCategorySlug: selectedCategory.id,
            subCategorySlug: selectedSubcategory || undefined,
            limit: 100,
          });
          if (!cancelled) setProducts(results);
        } else {
          const categoryProducts = await getProductsByCategory(
            selectedCategory.id,
            selectedSubcategory || undefined,
            undefined,
            100
          );
          if (!cancelled) setProducts(categoryProducts);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    const t = setTimeout(fetchProducts, 250); // drobny debounce
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedCategory, selectedSubcategory, searchTerm]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const priceFormatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  });

  // Sidebar Content (reusable for desktop and mobile)
  const SidebarContent = () => (
    <div className="space-y-2">
      <h2 className="font-headline text-lg font-semibold mb-4">Kategorie</h2>
      <ScrollArea className="h-[calc(100vh-200px)] lg:h-[600px] pr-1">
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
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
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
            <span className="font-medium text-foreground">Katalog produktów</span>
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

            {/* Center Content - Subcategories & Products */}
            <div className="col-span-1 lg:col-span-6">
              {/* Search Bar */}
              <div className="mb-4 lg:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj w produktach..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Subcategories przeniesione do lewego panelu */}

              {/* Products Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-headline text-base font-semibold">
                    Produkty ({filteredProducts.length})
                  </h3>
                </div>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredProducts.slice(0, 12).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Brak produktów w tej kategorii</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar - Deal of the Day & Promo (Hidden on mobile/tablet) */}
            <div className="hidden xl:block xl:col-span-3 space-y-6">
              {/* Deal of the Day */}
              {dealOfTheDay && (
                <Card className="overflow-hidden border-2 border-primary/20">
                  <CardContent className="p-0">
                    <div className="relative">
                      {dealOfTheDay.image && (
                        <Image
                          src={dealOfTheDay.image}
                          alt={dealOfTheDay.title}
                          width={300}
                          height={200}
                          className="w-full aspect-video object-cover"
                        />
                      )}
                      <Badge className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-orange-500 text-white">
                        <Flame className="mr-1 h-3 w-3" />
                        Deal Dnia
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <h4 className="font-headline font-semibold line-clamp-2">
                        {dealOfTheDay.title}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          {priceFormatter.format(dealOfTheDay.price)}
                        </span>
                        <Badge variant="secondary">
                          <Flame className="mr-1 h-3 w-3" />
                          {dealOfTheDay.temperature} pkt
                        </Badge>
                      </div>
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/deals/${dealOfTheDay.id}`}>
                          Zobacz ofertę
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
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Najlepsze oferty</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sprawdź nasze polecane produkty z najwyższymi ocenami
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href="/deals">
                        Zobacz okazje
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

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    }>
      <ProductsPageContent />
    </Suspense>
  );
}
