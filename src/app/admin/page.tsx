'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShoppingCart, 
  Flame, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Package,
  Activity,
  Eye,
  MessageSquare,
  ThumbsUp,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { getCounts, getHotDeals, getRecommendedProducts } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Deal, Product } from '@/lib/types';

interface Stats {
  products: number;
  deals: number;
  users: number;
}

function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hotDeals, setHotDeals] = useState<Deal[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [counts, dealsData, productsData] = await Promise.all([
          getCounts(),
          getHotDeals(5),
          getRecommendedProducts(5)
        ]);
        setStats(counts);
        setHotDeals(dealsData);
        setTopProducts(productsData);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Przegląd statystyk i aktywności platformy
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px] mb-2" />
                <Skeleton className="h-3 w-[120px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-headline tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Witaj w panelu administracyjnym – przegląd statystyk i aktywności platformy
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/deals">
              <Flame className="h-4 w-4 mr-2" />
              Zarządzaj okazjami
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/products">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Zarządzaj produktami
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produkty</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.products || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 inline-flex items-center font-medium">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12%
              </span>
              {' '}od ostatniego miesiąca
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Okazje</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.deals || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 inline-flex items-center font-medium">
                <TrendingUp className="h-3 w-3 mr-1" />
                +23%
              </span>
              {' '}od ostatniego miesiąca
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 inline-flex items-center font-medium">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8%
              </span>
              {' '}od ostatniego miesiąca
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Średnia temperatura</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hotDeals.length > 0 
                ? Math.round(hotDeals.reduce((acc, d) => acc + d.temperature, 0) / hotDeals.length) 
                : 0}°
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-orange-600 inline-flex items-center font-medium">
                <Activity className="h-3 w-3 mr-1" />
                z {hotDeals.length} gorących okazji
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Wyświetlenia
            </CardTitle>
            <CardDescription>Ostatnie 7 dni</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">45,231</div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className="text-green-600 font-medium">+18%</span>
              <span className="mx-2">•</span>
              6,432 dzisiaj
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Komentarze
            </CardTitle>
            <CardDescription>Ostatnie 7 dni</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">892</div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className="text-green-600 font-medium">+12%</span>
              <span className="mx-2">•</span>
              127 dzisiaj
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-primary" />
              Głosy
            </CardTitle>
            <CardDescription>Ostatnie 7 dni</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3,421</div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className="text-green-600 font-medium">+25%</span>
              <span className="mx-2">•</span>
              489 dzisiaj
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="hot-deals" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hot-deals">
            <Flame className="h-4 w-4 mr-2" />
            Gorące okazje
          </TabsTrigger>
          <TabsTrigger value="top-products">
            <Package className="h-4 w-4 mr-2" />
            Top produkty
          </TabsTrigger>
          <TabsTrigger value="moderation">
            <AlertCircle className="h-4 w-4 mr-2" />
            Do moderacji
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Aktywność
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hot-deals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Najgorętsze okazje</CardTitle>
                <CardDescription>
                  Ranking według temperatury
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/deals">
                  Zobacz wszystkie
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {hotDeals.length > 0 ? (
                <div className="space-y-4">
                  {hotDeals.map((deal, i) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="flex items-center justify-between border-b pb-3 last:border-0 hover:bg-muted/50 -mx-2 px-2 py-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="font-semibold text-muted-foreground w-6">#{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{deal.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {deal.mainCategorySlug} {deal.subCategorySlug && `→ ${deal.subCategorySlug}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="destructive" className="font-bold">
                          {deal.temperature}°
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {deal.commentsCount || 0} <MessageSquare className="h-3 w-3 inline" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Brak gorących okazji
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Najwyżej oceniane produkty</CardTitle>
                <CardDescription>
                  Ranking według średniej oceny
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/products">
                  Zobacz wszystkie
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="space-y-4">
                  {topProducts.map((product, i) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="flex items-center justify-between border-b pb-3 last:border-0 hover:bg-muted/50 -mx-2 px-2 py-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="font-semibold text-muted-foreground w-6">#{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {product.mainCategorySlug} {product.subCategorySlug && `→ ${product.subCategorySlug}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {product.ratingCard && (
                          <Badge variant="secondary" className="font-bold">
                            ⭐ {product.ratingCard.average.toFixed(1)}
                          </Badge>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {product.ratingCard?.count || 0} ocen
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Brak produktów z ocenami
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Czeka na moderację
              </CardTitle>
              <CardDescription>
                Nowe okazje wymagające zatwierdzenia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                  <p className="text-muted-foreground">
                    Wszystko sprawdzone! Brak elementów czekających na moderację.
                  </p>
                  <Button asChild variant="outline" className="mt-4" size="sm">
                    <Link href="/admin/moderation">
                      Przejdź do moderacji
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ostatnia aktywność</CardTitle>
              <CardDescription>
                Najnowsze wydarzenia w systemie
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hotDeals.slice(0, 5).map((deal, i) => (
                  <div key={deal.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                    <div className="p-2 rounded-full bg-red-100 text-red-600">
                      <Flame className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Nowa gorąca okazja</div>
                      <div className="text-sm text-muted-foreground truncate">{deal.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(deal.postedAt).toLocaleDateString('pl-PL', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
                {hotDeals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Brak ostatniej aktywności
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Szybkie akcje</CardTitle>
          <CardDescription>
            Najczęściej używane funkcje administracyjne
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link 
              href="/admin/deals" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Flame className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Zarządzaj okazjami</span>
            </Link>
            <Link 
              href="/admin/products" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <ShoppingCart className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Zarządzaj produktami</span>
            </Link>
            <Link 
              href="/admin/import" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Package className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Import CSV</span>
            </Link>
            <Link 
              href="/admin/users" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Users className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Użytkownicy</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(AdminPage);
