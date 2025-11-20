'use client';

import { useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  ExternalLink,
  Package
} from 'lucide-react';
import { PriceComparison } from '@/lib/types';
import { searchPriceComparisons } from '@/lib/multi-marketplace';

function ComparisonPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const results = await searchPriceComparisons(searchQuery);
      setComparisons(results);
    } catch (error) {
      console.error('Search failed:', error);
      setComparisons([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Porównywarka Cen</h1>
        <p className="text-muted-foreground">
          Porównuj ceny produktów z różnych marketplace
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Wyszukaj produkt</CardTitle>
          <CardDescription>
            Wprowadź nazwę produktu aby porównać ceny
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="np. iPhone 15 Pro"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Szukaj
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {comparisons.length > 0 && (
        <div className="space-y-4">
          {comparisons.map((comparison) => (
            <Card key={comparison.id}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <img
                    src={comparison.canonicalImage}
                    alt={comparison.productName}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <CardTitle>{comparison.productName}</CardTitle>
                    <div className="flex gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Najniższa: </span>
                        <span className="font-bold text-green-600">
                          {comparison.lowestPrice.toFixed(2)} PLN
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Najwyższa: </span>
                        <span className="font-bold text-red-600">
                          {comparison.highestPrice.toFixed(2)} PLN
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Różnica: </span>
                        <span className="font-bold">
                          {comparison.priceSpread.toFixed(2)} PLN
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>Cena</TableHead>
                      <TableHead>Dostępność</TableHead>
                      <TableHead>Ocena</TableHead>
                      <TableHead>Opinie</TableHead>
                      <TableHead>Dostawa</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.prices
                      .sort((a, b) => a.price - b.price)
                      .map((price, index) => (
                        <TableRow key={`${price.marketplaceId}-${price.productId}`}>
                          <TableCell className="font-medium">
                            {price.marketplaceName}
                            {index === 0 && (
                              <Badge variant="default" className="ml-2">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Najniższa
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-bold">
                              {price.price.toFixed(2)} {price.currency}
                            </div>
                            {price.originalPrice && (
                              <div className="text-xs text-muted-foreground line-through">
                                {price.originalPrice.toFixed(2)} {price.currency}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {price.inStock ? (
                              <Badge variant="default">W magazynie</Badge>
                            ) : (
                              <Badge variant="secondary">Brak</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {price.rating ? (
                              <div className="flex items-center">
                                ⭐ {price.rating.toFixed(1)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {price.reviewCount ? (
                              <span>{price.reviewCount.toLocaleString()}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {price.shippingCost !== undefined ? (
                              price.shippingCost === 0 ? (
                                <Badge variant="outline">Darmowa</Badge>
                              ) : (
                                <span className="text-sm">
                                  {price.shippingCost.toFixed(2)} {price.currency}
                                </span>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <a 
                                href={price.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Zobacz
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <div className="mt-4 text-xs text-muted-foreground">
                  Ostatnia aktualizacja: {new Date(comparison.lastUpdated).toLocaleString('pl-PL')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && comparisons.length === 0 && searchQuery && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Brak wyników</h3>
            <p className="text-sm text-muted-foreground">
              Nie znaleziono produktu &quot;{searchQuery}&quot; w porównywarce
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Jak działa porównywarka?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Porównywarka automatycznie wykrywa identyczne produkty z różnych marketplace
          </p>
          <p>
            • Wykorzystuje AI do analizy tytułów, obrazów i atrybutów produktów
          </p>
          <p>
            • Ceny aktualizowane są automatycznie co 24 godziny
          </p>
          <p>
            • Możesz ręcznie połączyć produkty używając panelu zarządzania duplikatami
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(ComparisonPage);
