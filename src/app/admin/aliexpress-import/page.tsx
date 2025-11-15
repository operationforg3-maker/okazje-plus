'use client';

import { useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Download, ExternalLink, Star } from 'lucide-react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<AliProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryMapping, setCategoryMapping] = useState<Record<string, { main: string; sub: string }>>({});

  const [categoriesSnapshot] = useCollection(collection(db, 'categories'));
  const categories: Category[] = categoriesSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as Category)) || [];

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

      const res = await fetch(`/api/admin/aliexpress/search?${params.toString()}`);
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      
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
        }));
      }

      if (products.length === 0) {
        // Fallback do mocka dla celów testowych
        products = generateMockProducts(searchQuery);
        toast({ title: 'Tryb demo', description: `Pokazano ${products.length} przykładowych produktów` });
      } else {
        toast({ title: 'Sukces', description: `Znaleziono ${products.length} produktów` });
      }

      setResults(products);
    } catch (err) {
      console.error('Search failed:', err);
      // Fallback do mocka
      const mockProducts = generateMockProducts(searchQuery);
      setResults(mockProducts);
      toast({ title: 'Tryb demo', description: 'Pokazano przykładowe produkty' });
    } finally {
      setLoading(false);
    }
  };

  const generateMockProducts = (query: string): AliProduct[] => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `mock-${i}`,
      title: `${query} - Produkt ${i + 1} (przykładowy)`,
      price: Math.round(Math.random() * 500 + 50),
      originalPrice: Math.round(Math.random() * 1000 + 100),
      imageUrl: `https://via.placeholder.com/200?text=Product${i + 1}`,
      productUrl: `https://aliexpress.com/item/${i}`,
      rating: Number((Math.random() * 2 + 3).toFixed(1)),
      orders: Math.round(Math.random() * 10000),
      discount: Math.round(Math.random() * 70 + 10),
    }));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const handleImport = async () => {
    const toImport = results.filter(p => selected.has(p.id));
    const invalid = toImport.filter(p => {
      const map = categoryMapping[p.id];
      return !map || !map.main || !map.sub;
    });

    if (invalid.length > 0) {
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
        
        // Przygotowanie payloadu zgodnie ze specyfikacją
        const payload = {
          name: product.title.slice(0, 200), // Max 200 znaków
          description: product.title.slice(0, 300), // Pierwsze 300 znaków
          longDescription: product.title, // Pełny opis
          price: pricePLN,
          originalPrice: originalPricePLN || pricePLN,
          image: product.imageUrl,
          imageHint: '', // TODO: AI-generated alt text
          affiliateUrl: product.productUrl,
          mainCategorySlug: map.main,
          subCategorySlug: map.sub,
          status: 'draft', // Zawsze draft przy imporcie
          ratingCard: {
            average: product.rating || 0,
            count: product.orders || 0,
            durability: product.rating || 0,
            easeOfUse: product.rating || 0,
            valueForMoney: product.rating || 0,
            versatility: product.rating || 0,
          },
          metadata: {
            source: 'aliexpress',
            originalId: product.id,
            importedAt: new Date().toISOString(),
            importedBy: user?.uid || 'unknown',
            originalPrice: product.price,
            currency: currency,
            discount: product.discount || 0,
            orders: product.orders || 0,
            shippingInfo: 'AliExpress',
          },
        };

        try {
          const res = await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            successCount++;
          } else {
            const error = await res.json();
            errors.push(`${product.title.slice(0, 30)}: ${error.error || 'Unknown error'}`);
          }
        } catch (err) {
          console.error('Import product failed:', err);
          errors.push(`${product.title.slice(0, 30)}: ${String(err)}`);
        }
      }

      if (errors.length > 0) {
        console.error('Import errors:', errors);
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

      {/* Wyszukiwarka */}
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
          </div>
          <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Szukaj
          </Button>
        </CardContent>
      </Card>

      {/* Wyniki */}
      {results.length > 0 && (
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
                <Button onClick={handleImport} disabled={selected.size === 0 || importing} size="lg">
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Importuj wybrane ({selected.size})
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default withAuth(AliExpressImportPage);
