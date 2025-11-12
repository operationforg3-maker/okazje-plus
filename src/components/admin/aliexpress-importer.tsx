"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ShoppingCart,
  DollarSign,
  Star,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useCollection } from "react-firebase-hooks/firestore";
import { collection } from "firebase/firestore";
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Category } from '@/lib/types';

type AliExpressProduct = {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  currency: string;
  productUrl: string;
  rating: number;
  orders: number;
  discount: number;
  shipping: string;
};

type ImportState = 'idle' | 'searching' | 'previewing' | 'importing' | 'completed';

export default function AliExpressImporter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [importState, setImportState] = useState<ImportState>('idle');
  const [searchResults, setSearchResults] = useState<AliExpressProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [categoryMapping, setCategoryMapping] = useState<{ [productId: string]: { main: string; sub: string } }>({});
  const [productDetails, setProductDetails] = useState<{ [productId: string]: any }>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Health check state
  const [health, setHealth] = useState<{
    loading: boolean;
    ok?: boolean;
    configured?: boolean;
    hasAppKeySecret?: boolean;
    hasAffiliateId?: boolean;
    mode?: 'signed' | 'api-key' | 'mock';
    issues?: string[];
    error?: string;
  }>({ loading: true });

  const fetchHealth = async () => {
    setHealth(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/admin/aliexpress/health', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'health_failed');
      setHealth({ loading: false, ...data });
    } catch (e: any) {
      setHealth({ loading: false, ok: false, error: String(e) });
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Pobieranie kategorii
  const [categoriesSnapshot] = useCollection(collection(db, 'categories'));
  const categoriesData: Category[] = categoriesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)) || [];

  // Mock search results - w produkcji to będzie prawdziwe API call
  const mockSearchResults: AliExpressProduct[] = [
    {
      id: 'ali-1',
      title: 'Wireless Bluetooth Earphones with Charging Case - High Quality Sound',
      imageUrl: 'https://via.placeholder.com/200',
      price: 89.99,
      originalPrice: 199.99,
      currency: 'PLN',
      productUrl: 'https://aliexpress.com/item/1234567890',
      rating: 4.8,
      orders: 15234,
      discount: 55,
      shipping: 'Darmowa dostawa'
    },
    {
      id: 'ali-2',
      title: 'Smart Watch with Heart Rate Monitor - Waterproof Fitness Tracker',
      imageUrl: 'https://via.placeholder.com/200',
      price: 149.99,
      originalPrice: 399.99,
      currency: 'PLN',
      productUrl: 'https://aliexpress.com/item/0987654321',
      rating: 4.6,
      orders: 8976,
      discount: 62,
      shipping: 'Darmowa dostawa'
    },
    {
      id: 'ali-3',
      title: 'USB-C Fast Charging Cable 2m - Durable Braided Wire',
      imageUrl: 'https://via.placeholder.com/200',
      price: 19.99,
      originalPrice: 49.99,
      currency: 'PLN',
      productUrl: 'https://aliexpress.com/item/1122334455',
      rating: 4.9,
      orders: 32145,
      discount: 60,
      shipping: 'Płatna dostawa 9.99 PLN'
    }
  ];

  // Symulacja wyszukiwania
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Wprowadź frazę wyszukiwania');
      return;
    }

    setImportState('searching');

    try {
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      if (searchCategory) params.set('category', searchCategory);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/aliexpress/search?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // If not configured, fallback to mock
        if (body?.error === 'not_configured') {
          setSearchResults(mockSearchResults);
          setImportState('previewing');
          toast.success(`Tryb developerski: wyświetlono przykładowe dane (${mockSearchResults.length})`);
          return;
        }
        throw new Error(body?.message || `AliExpress API error ${res.status}`);
      }

      const data = await res.json();

      // If proxy returned normalized products
      if (Array.isArray(data.products) && data.products.length > 0) {
        // Map provider fields to AliExpressProduct where possible — be tolerant about missing fields
        const normalized = data.products.map((p: any) => ({
          id: String(p.id || p.productId || p.itemId || p.sku || Math.random()),
          title: p.title || p.name || p.productName || p.itemTitle || '',
          imageUrl: p.imageUrl || p.image || p.thumbnail || 'https://via.placeholder.com/200',
          price: p.price || p.salePrice || p.currentPrice || 0,
          originalPrice: p.originalPrice || p.listPrice || p.marketPrice || p.price || 0,
          currency: p.currency || 'PLN',
          productUrl: p.productUrl || p.url || p.itemUrl || '',
          rating: p.rating || p.score || 0,
          orders: p.orders || p.sold || p.ordersCount || 0,
          discount: p.discount || Math.round(((p.originalPrice || p.listPrice || p.price || 0) - (p.price || 0)) / (p.originalPrice || p.price || 1) * 100) || 0,
          shipping: p.shipping || p.shippingInfo || 'Dostawa',
        } as AliExpressProduct));

        setSearchResults(normalized);
        setImportState('previewing');
        toast.success(`Znaleziono ${normalized.length} produktów`);
        return;
      }

      // raw fallback
      setSearchResults(mockSearchResults);
      setImportState('previewing');
      toast.success(`Tryb developerski: wyświetlono przykładowe dane (${mockSearchResults.length})`);
    } catch (err: any) {
      console.error('AliExpress search failed:', err);
      setSearchResults(mockSearchResults);
      setImportState('previewing');
      toast.error('Błąd połączenia z API AliExpress — użyto przykładowych danych');
    }
  };

  // Toggle product selection
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Toggle all
  const toggleAllProducts = () => {
    if (selectedProducts.size === searchResults.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(searchResults.map(p => p.id)));
    }
  };

  // Ustawienie kategorii dla produktu
  const setCategoryForProduct = (productId: string, type: 'main' | 'sub', value: string) => {
    setCategoryMapping(prev => {
      const current = prev[productId] || { main: '', sub: '' };
      if (type === 'main') {
        return { ...prev, [productId]: { main: value, sub: '' } };
      }
      return { ...prev, [productId]: { ...current, sub: value } };
    });
  };

  // Bulk category assignment
  const applyCategoriesToSelected = (mainCategory: string, subCategory: string) => {
    const newMapping: typeof categoryMapping = {};
    selectedProducts.forEach(id => {
      newMapping[id] = { main: mainCategory, sub: subCategory };
    });
    setCategoryMapping(prev => ({ ...prev, ...newMapping }));
    toast.success(`Zastosowano kategorię do ${selectedProducts.size} produktów`);
  };

  // Import wybranych produktów
  const handleImport = async () => {
    const productsToImport = searchResults
      .filter(p => selectedProducts.has(p.id))
      .filter(p => {
        const mapping = categoryMapping[p.id];
        return mapping && mapping.main && mapping.sub;
      });

    if (productsToImport.length === 0) {
      toast.error('Wybierz produkty i przypisz im kategorie');
      return;
    }

    setImportState('importing');

    try {
      // Use callable Cloud Function importAliProduct if available
      const callable = httpsCallable(functions as any, 'importAliProduct');
      let success = 0;
      for (const p of productsToImport) {
        const mapping = categoryMapping[p.id];
        const payload = { product: p, mainCategorySlug: mapping.main, subCategorySlug: mapping.sub };
        try {
          const res = await callable(payload);
          if ((res as any).data?.ok) success++;
        } catch (err: any) {
          console.error('Import failed for', p.id, err);
        }
      }
      setImportState('completed');
      toast.success(`Zaimportowano ${success} z ${productsToImport.length} produktów!`);
    } catch (err) {
      console.error('Bulk import failed:', err);
      toast.error('Import nieudany');
      setImportState('previewing');
    }
  };

  const loadDetails = async (productId: string, itemId?: string) => {
    if (loadingDetails.has(productId)) return;
    setLoadingDetails(prev => new Set(prev).add(productId));
    try {
      const id = itemId || productId;
      const res = await fetch(`/api/admin/aliexpress/item?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Upstream error');
      const body = await res.json();
      const product = body.product || body.item || body.data || body.raw || null;
      setProductDetails(prev => ({ ...prev, [productId]: product }));
      toast.success('Pobrano szczegóły produktu');
    } catch (e) {
      console.error('Load details failed', e);
      toast.error('Nie udało się pobrać szczegółów');
    } finally {
      setLoadingDetails(prev => {
        const copy = new Set(prev);
        copy.delete(productId);
        return copy;
      });
    }
  };

  // Modal preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProductId, setPreviewProductId] = useState<string | null>(null);

  const openPreview = (productId: string) => {
    setPreviewProductId(productId);
    // If details not loaded, load them
    if (!productDetails[productId]) loadDetails(productId);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewProductId(null);
  };

  const importSingle = async (productId: string) => {
    const mapping = categoryMapping[productId];
    if (!mapping || !mapping.main || !mapping.sub) {
      toast.error('Przypisz najpierw kategorię');
      return;
    }
    setImportState('importing');
    try {
      const callable = httpsCallable(functions as any, 'importAliProduct');
      const payload = { product: (productDetails[productId] || searchResults.find(p => p.id === productId)), mainCategorySlug: mapping.main, subCategorySlug: mapping.sub };
      const res = await callable(payload);
      if ((res as any).data?.ok) {
        toast.success('Produkt zaimportowany');
        closePreview();
      } else {
        toast.error('Import nie powiódł się');
      }
    } catch (e) {
      console.error('Import single failed', e);
      toast.error('Import nieudany');
    } finally {
      setImportState('previewing');
    }
  };

  // Reset
  const handleReset = () => {
    setSearchQuery('');
    setSearchCategory('');
    setMinPrice('');
    setMaxPrice('');
    setSearchResults([]);
    setSelectedProducts(new Set());
    setCategoryMapping({});
    setImportState('idle');
  };

  return (
    <div className="space-y-6">
      {/* API Configuration Status */}
      <div className="grid gap-3">
        {health.loading ? (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Sprawdzanie konfiguracji AliExpress…</AlertTitle>
            <AlertDescription>Weryfikuję obecność sekretów i tryb pracy.</AlertDescription>
          </Alert>
        ) : health.ok ? (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Integracja aktywna</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Tryb: {health.mode}</Badge>
              {health.hasAppKeySecret ? (
                <Badge className="bg-green-600">APP KEY/SECRET</Badge>
              ) : (
                <Badge variant="outline">API KEY</Badge>
              )}
              {health.hasAffiliateId ? (
                <Badge className="bg-green-600">Affiliate ID</Badge>
              ) : (
                <Badge variant="outline">Brak Affiliate ID</Badge>
              )}
              <Button size="sm" variant="outline" onClick={fetchHealth} className="ml-auto">Sprawdź ponownie</Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Integracja nieaktywna</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>Import z AliExpress wymaga konfiguracji sekretów po stronie serwera.</p>
              {health.issues && health.issues.length > 0 && (
                <ul className="list-disc list-inside text-sm">
                  {health.issues.map((i) => (<li key={i}>{i}</li>))}
                </ul>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="outline">Tryb: mock</Badge>
                <Button size="sm" variant="outline" onClick={fetchHealth}>Sprawdź ponownie</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Wyszukiwanie produktów
          </CardTitle>
          <CardDescription>
            Znajdź produkty na AliExpress i zaimportuj je do swojej platformy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="search">Wyszukiwana fraza</Label>
              <Input
                id="search"
                placeholder="np. smartwatch, słuchawki..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategoria AliExpress</Label>
              <Select value={searchCategory} onValueChange={setSearchCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Wszystkie kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Elektronika</SelectItem>
                  <SelectItem value="fashion">Moda</SelectItem>
                  <SelectItem value="home">Dom i ogród</SelectItem>
                  <SelectItem value="sports">Sport</SelectItem>
                  <SelectItem value="toys">Zabawki</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minPrice">Cena minimalna (PLN)</Label>
              <Input
                id="minPrice"
                type="number"
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPrice">Cena maksymalna (PLN)</Label>
              <Input
                id="maxPrice"
                type="number"
                placeholder="1000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleSearch} 
            className="w-full"
            disabled={importState === 'searching' || !searchQuery.trim()}
          >
            {importState === 'searching' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wyszukiwanie...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Szukaj produktów
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {searchResults.length > 0 && (
        <Tabs defaultValue="results" className="space-y-4">
          <TabsList>
            <TabsTrigger value="results">Wyniki ({searchResults.length})</TabsTrigger>
            <TabsTrigger value="selected">Wybrane ({selectedProducts.size})</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Znalezione produkty</CardTitle>
                    <CardDescription>
                      {selectedProducts.size} z {searchResults.length} wybranych
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={toggleAllProducts}>
                      {selectedProducts.size === searchResults.length ? 'Odznacz' : 'Zaznacz'} wszystkie
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Bulk Category Assignment */}
                {selectedProducts.size > 0 && (
                  <Alert className="mb-4">
                    <AlertTitle>Szybkie przypisanie kategorii</AlertTitle>
                    <AlertDescription>
                      <div className="flex gap-2 mt-2">
                        <Select onValueChange={(value) => {
                          const cat = categoriesData.find(c => c.id === value);
                          if (cat && cat.subcategories.length > 0) {
                            applyCategoriesToSelected(value, cat.subcategories[0].slug);
                          }
                        }}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Wybierz kategorię" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoriesData.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground self-center">
                          do zaznaczonych produktów
                        </span>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {searchResults.map((product) => {
                    const isSelected = selectedProducts.has(product.id);
                    const mapping = categoryMapping[product.id];
                    const mainCategory = categoriesData.find(c => c.id === mapping?.main);
                    const availableSubcategories = mainCategory?.subcategories || [];

                    return (
                      <Card key={product.id} className={!isSelected ? 'opacity-60' : ''}>
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleProductSelection(product.id)}
                              />
                              <img
                                src={product.imageUrl}
                                alt={product.title}
                                className="w-24 h-24 object-cover rounded-lg"
                              />
                              <div className="flex-1 space-y-2">
                                <h3 className="font-semibold line-clamp-2">{product.title}</h3>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                    <span>{product.rating}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <ShoppingCart className="h-4 w-4" />
                                    <span>{product.orders.toLocaleString()} zamówień</span>
                                  </div>
                                  <Badge variant="secondary">{product.shipping}</Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl font-bold text-primary">
                                    {product.price} {product.currency}
                                  </span>
                                  <span className="text-sm text-muted-foreground line-through">
                                    {product.originalPrice} {product.currency}
                                  </span>
                                  <Badge variant="destructive">-{product.discount}%</Badge>
                                </div>
                                <div className="flex gap-2">
                                  <a
                                    href={product.productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    Zobacz na AliExpress <ExternalLink className="h-3 w-3" />
                                  </a>
                                  <Button size="sm" variant="outline" onClick={() => loadDetails(product.id, product.id)}>
                                    {loadingDetails.has(product.id) ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Załaduj szczegóły'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Category Selection */}
                            <div className="flex gap-2 min-w-[300px]">
                              <div className="flex-1">
                                <Label className="text-xs">Kategoria</Label>
                                <Select
                                  value={mapping?.main || ''}
                                  onValueChange={(value) => setCategoryForProduct(product.id, 'main', value)}
                                  disabled={!isSelected}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Wybierz..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categoriesData.map(cat => (
                                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">Podkategoria</Label>
                                <Select
                                  value={mapping?.sub || ''}
                                  onValueChange={(value) => setCategoryForProduct(product.id, 'sub', value)}
                                  disabled={!isSelected || !mapping?.main}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Wybierz..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableSubcategories.map(sub => (
                                      <SelectItem key={sub.slug} value={sub.slug}>{sub.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="selected" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Wybrane do importu</CardTitle>
                <CardDescription>
                  Sprawdź listę produktów, które zostaną zaimportowane
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedProducts.size === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nie wybrano żadnych produktów
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults
                      .filter(p => selectedProducts.has(p.id))
                      .map(product => {
                        const mapping = categoryMapping[product.id];
                        const hasCategories = mapping && mapping.main && mapping.sub;

                        return (
                          <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <img src={product.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
                              <div>
                                <div className="font-medium text-sm line-clamp-1">{product.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {product.price} {product.currency}
                                </div>
                              </div>
                            </div>
                            <div>
                              {hasCategories ? (
                                <Badge variant="default">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Gotowy
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Brak kategorii
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Import Actions */}
      {searchResults.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={handleReset}>
                Nowe wyszukiwanie
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedProducts.size === 0 || importState === 'importing'}
                size="lg"
              >
                {importState === 'importing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importowanie...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Importuj wybrane ({selectedProducts.size})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Message */}
      {importState === 'completed' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Import zakończony!</AlertTitle>
          <AlertDescription>
            Produkty zostały pomyślnie zaimportowane i są dostępne w panelu produktów.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
