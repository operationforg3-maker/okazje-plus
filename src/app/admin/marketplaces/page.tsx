'use client';

import { useEffect, useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ShoppingBag, 
  Plus, 
  Settings, 
  TrendingUp,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { getEnabledMarketplaces } from '@/lib/multi-marketplace';
import { Marketplace } from '@/lib/types';
import Link from 'next/link';

function MarketplacesPage() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarketplaces() {
      try {
        const data = await getEnabledMarketplaces();
        setMarketplaces(data);
      } catch (error) {
        console.error('Error fetching marketplaces:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMarketplaces();
  }, []);

  const totalProducts = marketplaces.reduce((sum, m) => sum + (m.stats?.totalProducts || 0), 0);
  const totalDeals = marketplaces.reduce((sum, m) => sum + (m.stats?.totalDeals || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">
            Zarządzaj integracjami z zewnętrznymi platformami
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/marketplaces/new">
            <Plus className="mr-2 h-4 w-4" />
            Dodaj marketplace
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywne marketplace</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketplaces.length}</div>
            <p className="text-xs text-muted-foreground">
              Połączone platformy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produkty</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Ze wszystkich źródeł
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Okazje</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeals.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Ze wszystkich źródeł
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketplaces List */}
      <Card>
        <CardHeader>
          <CardTitle>Połączone marketplace</CardTitle>
          <CardDescription>
            Lista aktywnych integracji z zewnętrznymi platformami
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Ładowanie...</p>
            </div>
          ) : marketplaces.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Brak połączonych marketplace. Dodaj pierwszy!
              </p>
              <Button asChild className="mt-4">
                <Link href="/admin/marketplaces/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Dodaj marketplace
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Kraj</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produkty</TableHead>
                  <TableHead>Okazje</TableHead>
                  <TableHead>Ostatnia sync</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketplaces.map((marketplace) => (
                  <TableRow key={marketplace.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {marketplace.logo && (
                          <div 
                            className="w-8 h-8 rounded flex items-center justify-center text-white"
                            style={{ backgroundColor: marketplace.color || '#666' }}
                          >
                            {marketplace.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div>{marketplace.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {marketplace.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {marketplace.country} ({marketplace.currency})
                    </TableCell>
                    <TableCell>
                      {marketplace.enabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Aktywny
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Nieaktywny
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {(marketplace.stats?.totalProducts || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {(marketplace.stats?.totalDeals || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {marketplace.updatedAt ? (
                        <span className="text-xs">
                          {new Date(marketplace.updatedAt).toLocaleDateString('pl-PL')}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/marketplaces/${marketplace.id}`}>
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Configuration Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Przewodnik konfiguracji</CardTitle>
          <CardDescription>
            Jak skonfigurować integracje z marketplace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">🛒 Amazon</h3>
            <p className="text-sm text-muted-foreground">
              Wymaga Product Advertising API credentials (Access Key, Secret Key, Partner Tag).
              Dostępne marketplace: amazon.pl, amazon.com, amazon.de
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">🇵🇱 Allegro</h3>
            <p className="text-sm text-muted-foreground">
              Wymaga OAuth 2.0 (Client ID, Client Secret). Największy polski marketplace.
              Dostępne API: REST API z WebAPI
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">🌍 eBay</h3>
            <p className="text-sm text-muted-foreground">
              Wymaga OAuth 2.0 credentials (Client ID, Client Secret). Globalny marketplace.
              Dostępne API: Browse API, Buy API
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">🇨🇳 AliExpress</h3>
            <p className="text-sm text-muted-foreground">
              Wymaga App Key i App Secret. Już skonfigurowane w systemie.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(MarketplacesPage);
