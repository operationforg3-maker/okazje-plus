'use client';

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Download, ExternalLink, Star, CheckSquare, ChevronRight } from 'lucide-react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Category } from '@/lib/types';
import { convertToPLN } from '@/lib/currency';
import { useAuth } from '@/lib/auth';

interface AliProduct {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  productUrl: string;
  rating?: number;
  orders?: number;
  discount?: number;
  currency?: string;
}

function AliExpressImportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('__all__');
  const [aliCategories, setAliCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<AliProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryMapping, setCategoryMapping] = useState<Record<string, { main: string; sub: string }>>({});
  const [step, setStep] = useState<'search' | 'review' | 'import'>('search');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [details, setDetails] = useState<Record<string, any>>({});
  const [fieldSelection, setFieldSelection] = useState<Record<string, { title: boolean; description: boolean; images: boolean; price: boolean; rating: boolean }>>({});
  const [aiTestLoading, setAiTestLoading] = useState(false);

  const [categoriesSnapshot] = useCollection(collection(db, 'categories'));
  const categories: Category[] = categoriesSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as Category)) || [];

  // Fetch AliExpress categories on mount
  useEffect(() => {
    fetch('/api/admin/aliexpress/categories')
      .then(res => res.json())
      .then(data => setAliCategories(data.categories || []))
      .catch(err => console.error('Failed to load AliExpress categories:', err));
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: 'Błąd', description: 'Wpisz frazę wyszukiwania', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Wywołanie API proxy AliExpress
      const params = new URLSearchParams({ q: searchQuery, limit: '50' });
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (selectedCategory && selectedCategory !== '__all__') params.set('category', selectedCategory);

      console.log('[AliExpress Import] Searching with params:', Object.fromEntries(params));

      const res = await fetch(`/api/admin/aliexpress/search?${params.toString()}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('[AliExpress Import] API error:', errorData);
        throw new Error(`API error: ${res.status} - ${errorData.message || errorData.error}`);
      }

      const data = await res.json();
      console.log('[AliExpress Import] API response:', data);
      
      // Normalizacja wyników z różnych formatów API
      let products: AliProduct[] = [];
      
      if (Array.isArray(data.products)) {
        products = data.products.map((p: any) => ({
          id: String(p.id || p.productId || p.item_id || Math.random()),
          title: p.title || p.name || p.product_title || '',
          price: Number(p.price || p.sale_price || p.target_sale_price || 0),
          originalPrice: p.originalPrice || p.original_price || p.target_original_price || null,
          imageUrl: p.imageUrl || p.image || p.product_main_image_url || '',
          productUrl: p.productUrl || p.promotion_link || p.product_detail_url || '',
          rating: p.rating || p.evaluate_rate || 0,
          orders: p.orders || p.volume || p.lastest_volume || 0,
          discount: p.discount || 0,
          currency: p.currency || 'USD',
        }));
      }

      if (products.length === 0) {
        console.warn('[AliExpress Import] No products returned');
        toast({ title: 'Brak wyników', description: 'Brak pasujących produktów dla podanych kryteriów' });
      } else {
        console.log('[AliExpress Import] Products fetched:', products.length);
        toast({ title: 'Sukces', description: `Znaleziono ${products.length} produktów` });
      }

      setResults(products);
    } catch (err) {
      console.error('[AliExpress Import] Search failed:', err);
      toast({ 
        title: 'Błąd wyszukiwania', 
        description: String(err), 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // AI Pipeline Test (NEW - requires ImportProfile)
  const testAIPipeline = async () => {
    setAiTestLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Brak tokena autoryzacji');

      toast({
        title: '🤖 AI Pipeline Info',
        description: 'Nowy endpoint /api/admin/products/ingest wymaga ImportProfile. Zobacz console log dla szczegółów.',
      });

      console.log('=== AI IMPORT SYSTEM ===');
      console.log('Endpoint: POST /api/admin/products/ingest');
      console.log('Auth: Bearer token (admin role required)');
      console.log('Body: { profileId, dryRun?, maxItems? }');
      console.log('');
      console.log('🔥 AI Pipeline Stages:');
      console.log('1. Quality Score (0-100) → skip if < 70');
      console.log('2. Title Normalization → clean Polish title');
      console.log('3. Category Mapping → auto 3-level categorization');
      console.log('4. SEO Generation → unique 300-500 word descriptions');
      console.log('');
      console.log('📊 Check imported products:');
      console.log('  - product.ai.quality.score');
      console.log('  - product.ai.titleNormalization');
      console.log('  - product.ai.categoryMapping');
      console.log('  - product.ai.seo');
      console.log('');
      console.log('📍 To create ImportProfile, add to Firestore:');
      console.log('Collection: importProfiles');
      console.log('Example: { name: "Test", vendorId: "aliexpress", enabled: true, ... }');

    } catch (error) {
      console.error('[AI Test]', error);
      toast({
        title: 'Błąd',
        description: error instanceof Error ? error.message : 'Nieznany błąd',
        variant: 'destructive',
      });
    } finally {
      setAiTestLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map(p => p.id)));
    }
  };

  const setCategory = (productId: string, type: 'main' | 'sub', value: string) => {
    setCategoryMapping(prev => {
      const current = prev[productId] || { main: '', sub: '' };
      if (type === 'main') {
        return { ...prev, [productId]: { main: value, sub: '' } };
      }
      return { ...prev, [productId]: { ...current, sub: value } };
    });
  };

  const gotoReview = async () => {
    const toImport = results.filter(p => selected.has(p.id));
    if (toImport.length === 0) {
      toast({ title: 'Brak wyboru', description: 'Zaznacz co najmniej jeden produkt' });
      return;
    }
    // Validate categories first
    const invalid = toImport.filter(p => !categoryMapping[p.id]?.main || !categoryMapping[p.id]?.sub);
    if (invalid.length > 0) {
      toast({ title: 'Błąd', description: 'Każdy produkt musi mieć wybraną kategorię', variant: 'destructive' });
      return;
    }
    setReviewLoading(true);
    setStep('review');
    try {
      const loaded: Record<string, any> = {};
      const selections: Record<string, any> = {};
      await Promise.all(toImport.map(async (p) => {
        try {
          const r = await fetch(`/api/admin/aliexpress/item?id=${encodeURIComponent(p.id)}`);
          const j = await r.json();
          loaded[p.id] = j.product || j.raw || {};
          selections[p.id] = { title: true, description: true, images: true, price: true, rating: true };
        } catch (e) {
          console.error('Detail fetch failed', p.id, e);
          selections[p.id] = { title: true, description: false, images: true, price: true, rating: true };
        }
      }));
      setDetails(loaded);
      setFieldSelection(selections);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleImport = async () => {
    const toImport = results.filter(p => selected.has(p.id));
    
    console.log('[AliExpress Import] Starting import:', {
      selected: toImport.length,
      products: toImport.map(p => ({ id: p.id, title: p.title.slice(0, 30) }))
    });
    
    const invalid = toImport.filter(p => {
      const map = categoryMapping[p.id];
      return !map || !map.main || !map.sub;
    });

    if (invalid.length > 0) {
      console.error('[AliExpress Import] Invalid products (missing category):', invalid.map(p => p.id));
      toast({ title: 'Błąd', description: 'Wszystkie wybrane produkty muszą mieć przypisaną kategorię', variant: 'destructive' });
      return;
    }

    setImporting(true);
    let successCount = 0;
    const errors: string[] = [];

    try {
      for (const product of toImport) {
        const map = categoryMapping[product.id];
        
        // Konwersja cen do PLN jeśli potrzebna
        const currency = product.currency || 'USD';
        const pricePLN = currency !== 'PLN' ? convertToPLN(product.price, currency) : product.price;
        const originalPricePLN = product.originalPrice && currency !== 'PLN' 
          ? convertToPLN(product.originalPrice, currency) 
          : product.originalPrice;
        
        // Merge selection with details for richer import
        const det = details[product.id] || {};
        const sel = fieldSelection[product.id] || { title: true, description: true, images: true, price: true, rating: true };

        const chosenTitle = sel.title ? (det.title || product.title) : product.title;
        const chosenImage = sel.images ? (det.mainImage || (Array.isArray(det.images) && det.images[0]) || product.imageUrl) : product.imageUrl;
        const chosenPrice = sel.price ? (Number(det.price || det.sale_price || product.price) || product.price) : product.price;
        const chosenOriginal = sel.price ? (Number(det.originalPrice || det.original_price || product.originalPrice) || product.originalPrice || null) : (product.originalPrice || null);
        const chosenRating = sel.rating ? (det.rating != null ? Number(det.rating) : product.rating) : product.rating;
        const chosenOrders = sel.rating ? (det.orders != null ? Number(det.orders) : product.orders) : product.orders;
        const chosenDescription = sel.description ? (det.descriptionHtml || det.description || product.title) : product.title;

        // Przygotowanie payloadu zgodnie ze specyfikacją
        // Przygotuj listę obrazów (limit 10) jeśli zaznaczono import zdjęć
        const imageArray: string[] = sel.images && Array.isArray(det.images)
          ? det.images.filter((u: any) => typeof u === 'string').slice(0, 10)
          : [chosenImage];

        const payload = {
          name: String(chosenTitle || product.title).slice(0, 200), // Max 200 znaków
          description: String(chosenDescription || chosenTitle || product.title).slice(0, 300),
          longDescription: String(chosenDescription || chosenTitle || product.title),
          price: currency !== 'PLN' ? convertToPLN(chosenPrice, currency) : chosenPrice,
          originalPrice: (() => {
            const base = chosenOriginal ?? chosenPrice;
            return currency !== 'PLN' ? convertToPLN(base as number, currency) : base;
          })(),
          image: chosenImage,
          gallery: imageArray.map((url, idx) => ({
            id: `img_${idx}`,
            type: 'url',
            src: url,
            isPrimary: idx === 0,
            source: 'aliexpress',
            addedAt: new Date().toISOString(),
          })),
          imageHint: '', // TODO: AI-generated alt text
          affiliateUrl: product.productUrl,
          mainCategorySlug: map.main,
          subCategorySlug: map.sub,
          status: 'draft', // Zawsze draft przy imporcie
          ratingCard: {
            average: chosenRating || 0,
            count: chosenOrders || 0,
            durability: chosenRating || 0,
            easeOfUse: chosenRating || 0,
            valueForMoney: chosenRating || 0,
            versatility: chosenRating || 0,
          },
          ratingSources: {
            external: {
              average: chosenRating || 0,
              count: chosenOrders || undefined,
              source: 'aliexpress',
              updatedAt: new Date().toISOString(),
            },
            users: { average: 0, count: 0, updatedAt: new Date().toISOString() },
          },
          metadata: {
            source: 'aliexpress',
            originalId: product.id,
            importedAt: new Date().toISOString(),
            importedBy: user?.uid || 'unknown',
            originalPrice: product.price,
            currency: currency,
            discount: product.discount || 0,
            orders: chosenOrders || 0,
            shippingInfo: det.shipping || 'AliExpress',
          },
        };

        console.log('[AliExpress Import] Importing product:', {
          id: product.id,
          title: product.title.slice(0, 50),
          price: `${product.price} ${currency} → ${pricePLN} PLN`,
          category: `${map.main}/${map.sub}`,
        });

        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) {
            throw new Error('Brak tokenu uwierzytelniającego. Zaloguj się ponownie.');
          }
          const res = await fetch('/api/admin/aliexpress/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ product: {
              id: product.id,
              title: payload.name,
              description: payload.description,
              price: payload.price,
              originalPrice: payload.originalPrice,
              currency: 'PLN',
              productUrl: payload.affiliateUrl,
              imageUrl: payload.image,
              images: imageArray,
              orders: payload.metadata?.orders,
              shipping: payload.metadata?.shippingInfo,
              merchant: 'AliExpress'
            }, mainCategory: payload.mainCategorySlug, subCategory: payload.subCategorySlug }),
          });

          if (res.ok) {
            const result = await res.json();
            console.log('[AliExpress Import] Product imported successfully:', result);
            successCount++;
          } else {
            const error = await res.json();
            console.error('[AliExpress Import] Product import failed:', error);
            errors.push(`${product.title.slice(0, 30)}: ${error.error || 'Unknown error'}`);
          }
        } catch (err) {
          console.error('[AliExpress Import] Product import exception:', err);
          errors.push(`${product.title.slice(0, 30)}: ${String(err)}`);
        }
      }

      if (errors.length > 0) {
        console.error('[AliExpress Import] Import completed with errors:', errors);
      } else {
        console.log('[AliExpress Import] All products imported successfully');
      }

      toast({ 
        title: successCount > 0 ? 'Sukces' : 'Błąd', 
        description: `Zaimportowano ${successCount} z ${toImport.length} produktów${errors.length > 0 ? `. Błędy: ${errors.length}` : ''}`,
        variant: successCount === 0 ? 'destructive' : 'default',
      });
      
      // Reset tylko przy sukcesie
      if (successCount > 0) {
        setResults([]);
        setSelected(new Set());
        setCategoryMapping({});
        setSearchQuery('');
      }
    } catch (err) {
      console.error('Bulk import failed:', err);
      toast({ title: 'Błąd', description: 'Import nie powiódł się', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Import AliExpress</h2>
        <p className="text-muted-foreground">Wyszukaj i zaimportuj produkty z AliExpress</p>
      </div>

      {/* NEW: AI Pipeline Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <span>AI-Powered Import System (NOWE!)</span>
          </CardTitle>
          <CardDescription>
            Zaimplementowano automatyczny system importu z 4-stopniowym AI pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="secondary">1</Badge>
                <div>
                  <div className="font-medium">Quality Score</div>
                  <div className="text-muted-foreground">Ocena jakości 0-100, skip jeśli &lt; 70</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary">2</Badge>
                <div>
                  <div className="font-medium">Title Normalization</div>
                  <div className="text-muted-foreground">Czysty polski tytuł, usunięcie spamu</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="secondary">3</Badge>
                <div>
                  <div className="font-medium">Category Mapping</div>
                  <div className="text-muted-foreground">Auto-kategoryzacja 3-poziomowa</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary">4</Badge>
                <div>
                  <div className="font-medium">SEO Generation</div>
                  <div className="text-muted-foreground">Unikalne opisy 300-500 słów PL</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={testAIPipeline} 
              disabled={aiTestLoading}
              variant="outline"
              size="sm"
            >
              {aiTestLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <span className="mr-2">ℹ️</span>
              )}
              Pokaż info AI Pipeline
            </Button>
            <Badge variant="outline" className="text-xs">
              Endpoint: /api/admin/products/ingest
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Krok 1: Wyszukiwarka */}
      {step === 'search' && (
      <Card>
        <CardHeader>
          <CardTitle>Wyszukiwanie produktów</CardTitle>
          <CardDescription>Wprowadź frazę i opcjonalne filtry</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Fraza wyszukiwania</Label>
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="np. smartwatch, słuchawki..."
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label>Min cena (PLN)</Label>
              <Input
                type="number"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max cena (PLN)</Label>
              <Input
                type="number"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                placeholder="1000"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Kategoria AliExpress (opcjonalne)</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Wszystkie kategorie</SelectItem>
                  {aliCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Szukaj
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Krok 1: Wyniki */}
      {step === 'search' && results.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Wyniki ({results.length})</CardTitle>
                  <CardDescription>{selected.size} zaznaczonych</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selected.size === results.length ? 'Odznacz' : 'Zaznacz'} wszystkie
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.map(product => {
                const isSelected = selected.has(product.id);
                const map = categoryMapping[product.id];
                const mainCat = categories.find(c => c.id === map?.main);
                const subcats = mainCat?.subcategories || [];

                return (
                  <Card key={product.id} className={!isSelected ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(product.id)} />
                        <img src={product.imageUrl} alt="" className="w-20 h-20 object-cover rounded" />
                        <div className="flex-1 space-y-2">
                          <h4 className="font-medium line-clamp-2">{product.title}</h4>
                          <div className="flex items-center gap-4 text-sm">
                            {product.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                <span>{product.rating}</span>
                              </div>
                            )}
                            {product.orders && <span>{product.orders.toLocaleString()} zamówień</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{product.price} PLN</span>
                            {product.originalPrice && product.originalPrice > product.price && (
                              <>
                                <span className="text-sm line-through text-muted-foreground">{product.originalPrice} PLN</span>
                                <Badge variant="destructive">-{product.discount}%</Badge>
                              </>
                            )}
                          </div>
                          <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
                            Zobacz na AliExpress <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="flex gap-2 min-w-[300px]">
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs">Kategoria</Label>
                            <Select value={map?.main || ''} onValueChange={v => setCategory(product.id, 'main', v)} disabled={!isSelected}>
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Wybierz..." />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs">Podkategoria</Label>
                            <Select value={map?.sub || ''} onValueChange={v => setCategory(product.id, 'sub', v)} disabled={!isSelected || !map?.main}>
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Wybierz..." />
                              </SelectTrigger>
                              <SelectContent>
                                {subcats.map(s => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => { setResults([]); setSelected(new Set()); }}>
                  Nowe wyszukiwanie
                </Button>
                <div className="flex gap-2">
                  <Button onClick={gotoReview} disabled={selected.size === 0} size="lg">
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Przejdź do przeglądu ({selected.size})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Krok 2: Przegląd szczegółów i wybór pól */}
      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Przegląd i wybór pól</CardTitle>
            <CardDescription>Sprawdź szczegóły z AliExpress i wybierz, co zaimportować</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviewLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Pobieranie szczegółów...
              </div>
            ) : (
              results.filter(p => selected.has(p.id)).map(p => {
                const det = details[p.id] || {};
                const sel = fieldSelection[p.id] || { title: true, description: true, images: true, price: true, rating: true };
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-4">
                        <img src={(det.mainImage || p.imageUrl) as string} className="w-20 h-20 object-cover rounded" alt="" />
                        <div className="flex-1">
                          <div className="font-medium line-clamp-2">{det.title || p.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: (det.descriptionHtml || '').slice(0, 200) }} />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-5 gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={sel.title} onCheckedChange={() => setFieldSelection(s => ({...s, [p.id]: {...sel, title: !sel.title}}))} />
                          Tytuł
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={sel.description} onCheckedChange={() => setFieldSelection(s => ({...s, [p.id]: {...sel, description: !sel.description}}))} />
                          Opis (HTML)
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={sel.images} onCheckedChange={() => setFieldSelection(s => ({...s, [p.id]: {...sel, images: !sel.images}}))} />
                          Zdjęcia
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={sel.price} onCheckedChange={() => setFieldSelection(s => ({...s, [p.id]: {...sel, price: !sel.price}}))} />
                          Cena
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={sel.rating} onCheckedChange={() => setFieldSelection(s => ({...s, [p.id]: {...sel, rating: !sel.rating}}))} />
                          Oceny/Zamówienia
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('search')}>Wstecz</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckSquare className="h-4 w-4 mr-2" />}
                Importuj zaznaczone pola
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default withAuth(AliExpressImportPage);
