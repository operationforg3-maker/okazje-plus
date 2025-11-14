'use client';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

function AliExpressImportWizard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

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
        `/api/admin/aliexpress/search?query=${encodeURIComponent(searchQuery)}&pageSize=10`
      );
      
      if (!response.ok) {
        throw new Error('Nie udało się wyszukać produktów');
      }

      const data = await response.json();
      setSearchResults(data.products || []);
      
      toast({
        title: 'Sukces',
        description: `Znaleziono ${data.products?.length || 0} produktów`,
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

  const handleImportProduct = async (productId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/aliexpress/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          skipDuplicates: true,
          autoApprove: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Nie udało się zaimportować produktu');
      }

      const data = await response.json();
      
      toast({
        title: 'Sukces',
        description: `Produkt został zaimportowany (ID: ${data.productId})`,
      });
      
      setSelectedProduct(null);
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
                    key={product.productId}
                    className="p-3 flex items-center justify-between hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <h5 className="text-sm font-medium line-clamp-1">
                        {product.productTitle}
                      </h5>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {product.targetSalePrice} {product.targetSalePriceCurrency}
                        </Badge>
                        {product.productId && (
                          <span className="text-xs text-muted-foreground">
                            ID: {product.productId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {product.productDetailUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a
                            href={product.productDetailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() =>
                          handleImportProduct(product.productId)
                        }
                        disabled={loading}
                      >
                        Importuj
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
