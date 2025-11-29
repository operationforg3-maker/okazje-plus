'use client';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Settings, 
  Play, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Link as LinkIcon,
  Filter,
  Database,
  Search,
  ExternalLink,
  Loader2,
  Eye,
  Package
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getCategories } from '@/lib/data';
import { Category } from '@/lib/types';
import { useAuth } from '@/lib/auth';

function AliExpressImportWizard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [importing, setImporting] = useState(false);

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Get subcategories for selected main category
  const getSubcategories = () => {
    const mainCat = categories.find(c => c.id === selectedMainCategory);
    return mainCat?.subcategories || [];
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Błąd',
        description: 'Wprowadź frazę do wyszukania',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/aliexpress/search?q=${encodeURIComponent(searchQuery)}&limit=20`
      );
      
      if (!response.ok) {
        throw new Error('Nie udało się wyszukać produktów');
      }

      const data = await response.json();
      
      // Normalize product IDs (API może zwracać różne formaty)
      const products = (data.products || []).map((p: any) => ({
        ...p,
        id: p.id || p.productId,
      }));
      
      setSearchResults(products);
      
      toast({
        title: 'Sukces',
        description: `Znaleziono ${products.length} produktów`,
      });
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message,
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (product: any) => {
    setSelectedProduct(product);
    setShowDetailsDialog(true);
    setProductDetails(null);
    
    try {
      const response = await fetch(
        `/api/admin/aliexpress/item?productId=${encodeURIComponent(product.id)}`
      );
      
      if (!response.ok) {
        throw new Error('Nie udało się pobrać szczegółów');
      }

      const data = await response.json();
      setProductDetails(data.product || data);
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleImportProduct = async (product: any) => {
    if (!selectedMainCategory || !selectedSubCategory) {
      toast({
        title: 'Błąd',
        description: 'Wybierz kategorię główną i podkategorię',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      // Get Firebase Auth token
      const fbUser = user as any;
      const idToken = fbUser?.getIdToken ? await fbUser.getIdToken() : null;
      
      const response = await fetch('/api/admin/aliexpress/import', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken && { 'Authorization': `Bearer ${idToken}` }),
        },
        body: JSON.stringify({
          product: product,
          mainCategory: selectedMainCategory,
          subCategory: selectedSubCategory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się zaimportować produktu');
      }

      const data = await response.json();
      
      toast({
        title: 'Sukces! 🎉',
        description: `Produkt został zaimportowany (ID: ${data.id})`,
      });
      
      setShowDetailsDialog(false);
      setSelectedProduct(null);
      setProductDetails(null);
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          🛍️ Import z AliExpress
        </h2>
        <p className="text-muted-foreground mt-2">
          Wyszukaj i importuj produkty z platformy AliExpress
        </p>
      </div>

      {/* OAuth Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>1. Połączenie OAuth</CardTitle>
              <CardDescription>
                Zarządzaj tokenem dostępu do AliExpress API
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/settings/oauth">
                <Settings className="mr-2 h-4 w-4" />
                Zarządzaj tokenami
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Przejdź do ustawień OAuth aby skonfigurować dostęp do AliExpress</span>
          </div>
        </CardContent>
      </Card>

      {/* Search Products */}
      <Card>
        <CardHeader>
          <CardTitle>2. Wyszukaj produkty</CardTitle>
          <CardDescription>
            Wprowadź frazę aby wyszukać produkty na AliExpress
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="search">Fraza wyszukiwania</Label>
              <Input
                id="search"
                placeholder="np. wireless headphones"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Szukaj
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">
                Wyniki ({searchResults.length})
              </h4>
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {searchResults.map((product: any) => (
                  <div
                    key={product.id}
                    className="p-3 flex items-center justify-between hover:bg-muted/50"
                  >
                    <div className="flex gap-3 flex-1">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h5 className="text-sm font-medium line-clamp-2">
                          {product.title}
                        </h5>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs font-bold text-green-600">
                            ${product.price}
                          </Badge>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-xs text-muted-foreground line-through">
                              ${product.originalPrice}
                            </span>
                          )}
                          {product.discount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              -{product.discount}%
                            </Badge>
                          )}
                          {product.orders > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {product.orders} zamówień
                            </span>
                          )}
                          {product.rating > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ⭐ {product.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {product.productUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(product)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Szczegóły
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Szczegóły produktu i import</DialogTitle>
            <DialogDescription>
              Sprawdź szczegóły i wybierz kategorię przed importem
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4">
              {/* Product Info */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex gap-4">
                  {selectedProduct.imageUrl && (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.title}
                      className="w-32 h-32 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">{selectedProduct.title}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge className="font-bold text-green-600">${selectedProduct.price}</Badge>
                        {selectedProduct.originalPrice && (
                          <span className="text-muted-foreground line-through">
                            ${selectedProduct.originalPrice}
                          </span>
                        )}
                        {selectedProduct.discount > 0 && (
                          <Badge variant="destructive">-{selectedProduct.discount}%</Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {selectedProduct.orders > 0 && `${selectedProduct.orders} zamówień • `}
                        {selectedProduct.rating > 0 && `⭐ ${selectedProduct.rating.toFixed(1)}`}
                      </div>
                      {selectedProduct.shippingInfo && (
                        <div className="text-xs text-muted-foreground">
                          {selectedProduct.shippingInfo.warehouse && `📦 ${selectedProduct.shippingInfo.warehouse} • `}
                          {selectedProduct.shippingInfo.freeShipping && '🚚 Darmowa wysyłka'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedProduct.description && (
                  <div className="text-sm text-muted-foreground">
                    <p className="line-clamp-3">{selectedProduct.description}</p>
                  </div>
                )}

                {/* Image Gallery */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Galeria ({selectedProduct.images.length} zdjęć)
                    </Label>
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {selectedProduct.images.slice(0, 6).map((img: string, idx: number) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`${selectedProduct.title} ${idx + 1}`}
                          className="w-16 h-16 object-cover rounded border"
                        />
                      ))}
                      {selectedProduct.images.length > 6 && (
                        <div className="w-16 h-16 flex items-center justify-center border rounded bg-muted text-xs">
                          +{selectedProduct.images.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Category Selection */}
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div>
                  <Label htmlFor="mainCategory" className="font-semibold">
                    Kategoria główna <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedMainCategory}
                    onValueChange={(value) => {
                      setSelectedMainCategory(value);
                      setSelectedSubCategory('');
                    }}
                  >
                    <SelectTrigger id="mainCategory">
                      <SelectValue placeholder="Wybierz kategorię główną" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subCategory" className="font-semibold">
                    Podkategoria <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedSubCategory}
                    onValueChange={setSelectedSubCategory}
                    disabled={!selectedMainCategory}
                  >
                    <SelectTrigger id="subCategory">
                      <SelectValue placeholder="Wybierz podkategorię" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSubcategories().map((sub) => (
                        <SelectItem key={sub.slug} value={sub.slug}>
                          {sub.icon} {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Additional Details (if loaded) */}
              {productDetails && (
                <div className="border rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Dodatkowe informacje</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {productDetails.merchant && <div>🏪 Sprzedawca: {productDetails.merchant}</div>}
                    {productDetails.categoryName && <div>📁 Kategoria AliExpress: {productDetails.categoryName}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDetailsDialog(false)}
              disabled={importing}
            >
              Anuluj
            </Button>
            <Button
              onClick={() => selectedProduct && handleImportProduct(selectedProduct)}
              disabled={importing || !selectedMainCategory || !selectedSubCategory}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importowanie...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Importuj produkt
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Dokumentacja i zasoby</CardTitle>
          <CardDescription>
            Przewodniki i informacje techniczne
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <h4 className="font-semibold mb-2">Dostępne zasoby:</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <code className="text-xs bg-muted px-1 py-0.5 rounded">docs/integration/aliexpress.md</code> - Pełna dokumentacja</li>
              <li>• <code className="text-xs bg-muted px-1 py-0.5 rounded">src/integrations/aliexpress/</code> - Kod integracji</li>
              <li>• Cloud Function: <code className="text-xs bg-muted px-1 py-0.5 rounded">scheduleAliExpressSync</code> - Automatyczna synchronizacja</li>
            </ul>
          </div>
          <div className="pt-2 border-t">
            <h4 className="font-semibold text-sm mb-2">Backend API:</h4>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-muted-foreground">/api/admin/aliexpress/search</code>
                <CheckCircle className="h-3 w-3 text-green-600" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-muted-foreground">/api/admin/aliexpress/item</code>
                <CheckCircle className="h-3 w-3 text-green-600" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">POST</Badge>
                <code className="text-muted-foreground">/api/admin/aliexpress/import</code>
                <CheckCircle className="h-3 w-3 text-green-600" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(AliExpressImportWizard);
