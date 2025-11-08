"use client";

import { useState } from 'react';
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
import { db } from '@/lib/firebase';
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
    
    // Symulacja API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSearchResults(mockSearchResults);
    setImportState('previewing');
    toast.success(`Znaleziono ${mockSearchResults.length} produktów`);
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

    // TODO: Wywołanie Firebase Cloud Function do zapisania produktów
    // const createProduct = httpsCallable(functions, 'createProduct');
    // await createProduct({ products: productsToImport.map(...) });

    await new Promise(resolve => setTimeout(resolve, 2000));

    setImportState('completed');
    toast.success(`Zaimportowano ${productsToImport.length} produktów!`);
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
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Integracja w fazie rozwoju</AlertTitle>
        <AlertDescription>
          Import z AliExpress API wymaga konfiguracji kluczy API. 
          Skonfiguruj App Key, App Secret i Tracking ID w ustawieniach, aby aktywować tę funkcję.
          Obecnie wyświetlane są przykładowe dane.
        </AlertDescription>
      </Alert>

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
                                <a
                                  href={product.productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  Zobacz na AliExpress <ExternalLink className="h-3 w-3" />
                                </a>
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
