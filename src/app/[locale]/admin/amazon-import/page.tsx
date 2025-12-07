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
import { Loader2, Search, Download, ExternalLink, DollarSign, AlertCircle } from 'lucide-react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Category } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useLocale, useFormatter } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AmazonProduct {
  asin: string;
  title: string;
  price: {
    current: number;
    original?: number;
    currency: string;
  };
  imageUrls: string[];
  productUrl: string;
  rating?: {
    score: number;
    count: number;
  };
  merchantInfo?: {
    name: string;
    rating?: number;
  };
  description?: string;
}

function AmazonImportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const locale = useLocale();
  const format = useFormatter();
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<AmazonProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryMapping, setCategoryMapping] = useState<Record<string, { main: string; sub: string; subSub?: string }>>({});
  const [step, setStep] = useState<'search' | 'import'>('search');

  const [categoriesSnapshot] = useCollection(collection(db, 'categories'));
  const categories: Category[] = categoriesSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as Category)) || [];

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Błąd',
        description: 'Wpisz frazę wyszukiwania',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Brak tokenu');

      const res = await fetch('/api/admin/amazon/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          keywords: searchQuery,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          limit: 50
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Błąd wyszukiwania');
      }

      const data = await res.json();
      setResults(data.products || []);
      
      if (data.products?.length === 0) {
        toast({
          title: 'Brak wyników',
          description: 'Spróbuj zmienić parametry wyszukiwania'
        });
      } else {
        toast({
          title: 'Znaleziono produktów',
          description: `${data.products?.length || 0} produktów`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Błąd wyszukiwania',
        description: error.message || 'Nie udało się wyszukać produktów',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryMap = (productId: string, mainSlug: string, subSlug: string, subSubSlug?: string) => {
    setCategoryMapping(prev => ({
      ...prev,
      [productId]: { main: mainSlug, sub: subSlug, subSub: subSubSlug }
    }));
  };

  const handleImport = async () => {
    const productsToImport = Array.from(selected).filter(id => {
      const mapping = categoryMapping[id];
      return mapping && mapping.main && mapping.sub;
    });

    if (productsToImport.length === 0) {
      toast({
        title: 'Błąd',
        description: 'Wybierz produkty i przypisz im kategorie',
        variant: 'destructive'
      });
      return;
    }

    setImporting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Brak tokenu');

      let success = 0;
      let failed = 0;

      for (const productId of productsToImport) {
        try {
          const product = results.find(p => p.asin === productId);
          if (!product) continue;

          const mapping = categoryMapping[productId];

          const res = await fetch('/api/admin/amazon/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              product: {
                asin: product.asin,
                title: product.title,
                price: product.price.current,
                originalPrice: product.price.original,
                currency: product.price.currency,
                imageUrl: product.imageUrls[0],
                productUrl: product.productUrl,
                description: product.description || '',
                rating: product.rating?.score || 0,
                merchant: product.merchantInfo?.name || 'Amazon',
              },
              mainCategory: mapping.main,
              subCategory: mapping.sub,
              subSubCategory: mapping.subSub
            })
          });

          if (res.ok) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      }

      toast({
        title: 'Import zakończony',
        description: `Pomyślnie: ${success}, Błędy: ${failed}`,
        variant: failed === 0 ? 'default' : 'destructive'
      });

      if (success > 0) {
        setSelected(new Set());
        setStep('search');
        setResults([]);
      }
    } catch (error: any) {
      toast({
        title: 'Błąd importu',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  const getSubCategories = (mainSlug: string) => {
    const main = categories.find(c => c.slug === mainSlug);
    return main?.subcategories || [];
  };

  const getSubSubCategories = (mainSlug: string, subSlug: string) => {
    const main = categories.find(c => c.slug === mainSlug);
    const sub = main?.subcategories?.find(s => s.slug === subSlug);
    return sub?.subcategories || [];
  };

  if (step === 'search') {
    return (
      <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">🟠 Amazon Importer</h1>
          <p className="text-muted-foreground">Importuj produkty z Amazon.com z automatyczną konwersją cen (USD/EUR → PLN)</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Wyszukiwanie produktów</CardTitle>
            <CardDescription>Wpisz frazę wyszukiwania, aby znaleźć produkty na Amazon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="search">Fraza wyszukiwania</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="search"
                  placeholder="np. laptop, monitor 4K..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Szukaj
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minPrice">Cena minimalna (PLN)</Label>
                <Input
                  id="minPrice"
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="maxPrice">Cena maksymalna (PLN)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  placeholder="999999"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Wyniki wyszukiwania ({results.length}) - zaznaczono {selected.size}
              </h2>
              {selected.size > 0 && (
                <Button onClick={() => setStep('import')} size="lg">
                  Przejdź do importu ({selected.size})
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              {results.map(product => (
                <Card key={product.asin} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <img
                          src={product.imageUrls[0]}
                          alt={product.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold line-clamp-2">{product.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              Sprzedawca: {product.merchantInfo?.name || 'Amazon'}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={product.productUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-lg">
                            {format.number(product.price.current, { style: 'currency', currency: 'PLN' })}
                          </span>
                          {product.price.original && product.price.original > product.price.current && (
                            <span className="text-sm line-through text-muted-foreground">
                              {format.number(product.price.original, { style: 'currency', currency: 'PLN' })}
                            </span>
                          )}
                          {product.rating && (
                            <Badge variant="outline">
                              ⭐ {product.rating.score.toFixed(1)} ({product.rating.count} opinii)
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <div>
                            <Label className="text-xs">Kategoria główna</Label>
                            <Select value={categoryMapping[product.asin]?.main || ''} onValueChange={(v) => handleCategoryMap(product.asin, v, '', undefined)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Wybierz..." />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(cat => (
                                  <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {categoryMapping[product.asin]?.main && (
                            <div>
                              <Label className="text-xs">Podkategoria</Label>
                              <Select value={categoryMapping[product.asin]?.sub || ''} onValueChange={(v) => handleCategoryMap(product.asin, categoryMapping[product.asin].main, v, undefined)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Wybierz..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {getSubCategories(categoryMapping[product.asin].main).map(sub => (
                                    <SelectItem key={sub.id} value={sub.slug}>{sub.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {categoryMapping[product.asin]?.sub && (
                            <div>
                              <Label className="text-xs">Pod-podkategoria</Label>
                              <Select value={categoryMapping[product.asin]?.subSub || ''} onValueChange={(v) => handleCategoryMap(product.asin, categoryMapping[product.asin].main, categoryMapping[product.asin].sub, v)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Opcjonalnie" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getSubSubCategories(categoryMapping[product.asin].main, categoryMapping[product.asin].sub).map(subsub => (
                                    <SelectItem key={subsub.id} value={subsub.slug}>{subsub.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <Checkbox
                          checked={selected.has(product.asin)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selected);
                            if (checked) {
                              newSelected.add(product.asin);
                            } else {
                              newSelected.delete(product.asin);
                            }
                            setSelected(newSelected);
                          }}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Import step
  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Potwierdzenie importu</h1>
        <p className="text-muted-foreground">Aby kontynuować, upewnij się że wszystkie produkty mają przypisane kategorie</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Będzie importować {selected.size} produktów z Amazon. Ceny będą automatycznie przeliczone na PLN.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {Array.from(selected).map(productId => {
          const product = results.find(p => p.asin === productId);
          const mapping = categoryMapping[productId];
          if (!product || !mapping) return null;

          return (
            <Card key={productId}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <img src={product.imageUrls[0]} alt={product.title} className="w-20 h-20 object-cover rounded" />
                  <div className="flex-1">
                    <h3 className="font-semibold line-clamp-1">{product.title}</h3>
                    <p className="text-sm text-muted-foreground">{format.number(product.price.current, { style: 'currency', currency: 'PLN' })}</p>
                    <div className="flex gap-2 mt-2">
                      {categories.find(c => c.slug === mapping.main) && (
                        <Badge>{categories.find(c => c.slug === mapping.main)?.name}</Badge>
                      )}
                      {mapping.sub && (
                        <Badge variant="outline">
                          {categories.find(c => c.slug === mapping.main)?.subcategories?.find(s => s.slug === mapping.sub)?.name || mapping.sub}
                        </Badge>
                      )}
                      {mapping.subSub && (
                        <Badge variant="secondary">
                          {categories.find(c => c.slug === mapping.main)?.subcategories?.find(s => s.slug === mapping.sub)?.subcategories?.find(ss => ss.slug === mapping.subSub)?.name || mapping.subSub}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setStep('search')} variant="outline" disabled={importing}>
          Wróć
        </Button>
        <Button onClick={handleImport} disabled={importing} size="lg">
          {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Importuj ({selected.size})
        </Button>
      </div>
    </div>
  );
}

export default withAuth(AmazonImportPage);
