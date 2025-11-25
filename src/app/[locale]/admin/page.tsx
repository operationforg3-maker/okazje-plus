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
import { getCounts, getHotDeals, getRecommendedProducts, getAdminDashboardStats } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Deal, Product } from '@/lib/types';
import TestsTab from '@/components/admin/tests-tab';

interface Stats {
  products: number;
  deals: number;
  users: number;
}

interface DashboardStats {
  totals: Stats;
  pending: {
    deals: number;
    products: number;
  };
  new24h: {
    deals: number;
    users: number;
  };
  avgTemperature: number;
  topCategories: Array<{ slug: string; count: number }>;
  recentActivity: number;
  analytics: {
    views: {
      total: number;
      today: number;
      trend: number;
    };
    clicks: {
      total: number;
      today: number;
      trend: number;
    };
    shares: {
      total: number;
    };
    conversionRate: number;
  };
  growth: {
    deals: number;
    products: number;
    users: number;
  };
}

function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [hotDeals, setHotDeals] = useState<Deal[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [dashStats, dealsData, productsData] = await Promise.all([
          getAdminDashboardStats(),
          getHotDeals(5),
          getRecommendedProducts(5)
        ]);
        setDashboardStats(dashStats);
        setStats(dashStats.totals);
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
              {dashboardStats?.growth.products !== undefined && (
                <span className={`inline-flex items-center font-medium ${
                  dashboardStats.growth.products >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardStats.growth.products >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {dashboardStats.growth.products >= 0 ? '+' : ''}{dashboardStats.growth.products}%
                </span>
              )}
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
              {dashboardStats?.growth.deals !== undefined && (
                <span className={`inline-flex items-center font-medium ${
                  dashboardStats.growth.deals >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardStats.growth.deals >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {dashboardStats.growth.deals >= 0 ? '+' : ''}{dashboardStats.growth.deals}%
                </span>
              )}
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
              {dashboardStats?.growth.users !== undefined && (
                <span className={`inline-flex items-center font-medium ${
                  dashboardStats.growth.users >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardStats.growth.users >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {dashboardStats.growth.users >= 0 ? '+' : ''}{dashboardStats.growth.users}%
                </span>
              )}
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
              {dashboardStats?.avgTemperature || 0}°
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-orange-600 inline-flex items-center font-medium">
                <Activity className="h-3 w-3 mr-1" />
                ostatnie 7 dni aktywności
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row - Moderation & Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Oczekuje moderacji
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {(dashboardStats?.pending.deals || 0) + (dashboardStats?.pending.products || 0)}
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {dashboardStats?.pending.deals || 0} okazji, {dashboardStats?.pending.products || 0} produktów
            </p>
            <Button asChild variant="link" size="sm" className="px-0 h-auto mt-2 text-amber-700 dark:text-amber-300">
              <Link href="/admin/moderation">
                Przejdź do moderacji <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
              Nowe (24h)
            </CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {dashboardStats?.new24h.deals || 0}
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              okazji, {dashboardStats?.new24h.users || 0} nowych użytkowników
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Aktywność (7 dni)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {dashboardStats?.recentActivity || 0}
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              aktywnych okazji z komentarzami/głosami
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Top kategoria
            </CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
              {dashboardStats?.topCategories[0]?.slug || 'N/A'}
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
              {dashboardStats?.topCategories[0]?.count || 0} okazji
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
            <div className="text-3xl font-bold">
              {dashboardStats?.analytics.views.total.toLocaleString() || 0}
            </div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className={`font-medium ${
                (dashboardStats?.analytics.views.trend || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(dashboardStats?.analytics.views.trend || 0) >= 0 ? '+' : ''}
                {dashboardStats?.analytics.views.trend || 0}%
              </span>
              <span className="mx-2">•</span>
              {dashboardStats?.analytics.views.today.toLocaleString() || 0} dzisiaj
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Kliknięcia
            </CardTitle>
            <CardDescription>W linki zewnętrzne (ostatnie 7 dni)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {dashboardStats?.analytics.clicks.total.toLocaleString() || 0}
            </div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className={`font-medium ${
                (dashboardStats?.analytics.clicks.trend || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(dashboardStats?.analytics.clicks.trend || 0) >= 0 ? '+' : ''}
                {dashboardStats?.analytics.clicks.trend || 0}%
              </span>
              <span className="mx-2">•</span>
              {dashboardStats?.analytics.clicks.today.toLocaleString() || 0} dzisiaj
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-primary" />
              Konwersja
            </CardTitle>
            <CardDescription>Współczynnik kliknięć</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {dashboardStats?.analytics.conversionRate || 0}%
            </div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className="font-medium text-blue-600">
                {dashboardStats?.analytics.shares.total || 0} udostępnień
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="hot-deals" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
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
          <TabsTrigger value="ai">
            <span className="flex items-center gap-2">
              🤖 AI Tools
            </span>
          </TabsTrigger>
          <TabsTrigger value="tests">
            <CheckCircle className="h-4 w-4 mr-2" />
            Testy
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

        <TabsContent value="tests" className="space-y-4">
          <TestsTab />
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

        <TabsContent value="ai" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* AI Catalog Management */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🚀 Zarządzanie Katalogiem AI
                </CardTitle>
                <CardDescription>
                  Automatyczne wypełnianie bazy danych produktami i dealami z AliExpress
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  asChild 
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                  size="lg"
                >
                  <Link href="/pl/admin/ai">
                    🤖 Otwórz Konsolę AI
                  </Link>
                </Button>
                <div className="text-sm text-muted-foreground space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span>Wypełnij katalog produktami (struktura Pepper.pl)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span>Pobierz hot deale z promocjami {'>'}50% zniżki</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span>Wyczyść bazę danych (reset)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Enhancement Tools */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ✨ Narzędzia AI Enhancement
                </CardTitle>
                <CardDescription>
                  Ulepszanie i optymalizacja treści przy pomocy AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/products">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Produkty
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/deals">
                      <Flame className="h-4 w-4 mr-2" />
                      Deale
                    </Link>
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground space-y-2 mt-4">
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-xs">AI</Badge>
                    <span>Automatyczne tłumaczenia i SEO</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-xs">AI</Badge>
                    <span>Sugestie kategorii i tagów</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-xs">AI</Badge>
                    <span>Ocena jakości treści</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AliExpress Integration */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🛒 Integracja AliExpress
                </CardTitle>
                <CardDescription>
                  Import produktów bezpośrednio z AliExpress API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full" size="lg">
                  <Link href="/admin/aliexpress-import">
                    Import z AliExpress
                  </Link>
                </Button>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Status: Aktywny</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>• Wyszukiwanie produktów</div>
                    <div>• Podgląd przed importem</div>
                    <div>• Automatyczne mapowanie kategorii</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Import Tools */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📦 Masowy Import
                </CardTitle>
                <CardDescription>
                  Narzędzia do importu dużych ilości danych
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/bulk-import">
                      CSV Import
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/deals-import">
                      Deale CSV
                    </Link>
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                  <div className="text-xs space-y-1">
                    <div>• Import CSV z walidacją</div>
                    <div>• Podgląd przed zapisem</div>
                    <div>• Obsługa duplikatów</div>
                    <div>• Historie importów</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Command History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historia Poleceń AI
              </CardTitle>
              <CardDescription>
                Ostatnie operacje wykonane przez system AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Button asChild variant="outline">
                  <Link href="/pl/admin/ai/history">
                    Zobacz pełną historię
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Link 
              href="/admin/deals" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Flame className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Okazje</span>
            </Link>
            <Link 
              href="/admin/products" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <ShoppingCart className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Produkty</span>
            </Link>
            <Link 
              href="/admin/moderation" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors"
            >
              <AlertCircle className="h-8 w-8 text-orange-500" />
              <span className="text-sm font-medium text-center">Moderacja</span>
            </Link>
            <Link 
              href="/admin/users" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Users className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Użytkownicy</span>
            </Link>
            <Link 
              href="/admin/categories" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Package className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Kategorie</span>
            </Link>
            <Link 
              href="/pl/admin/ai" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 transition-all"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </span>
              <span className="text-sm font-medium text-center">
                AI Tools
                <Badge variant="secondary" className="ml-1 text-xs">Beta</Badge>
              </span>
            </Link>
            <Link 
              href="/admin/aliexpress-import" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors"
            >
              <span className="text-2xl">🛒</span>
              <span className="text-sm font-medium text-center">AliExpress</span>
            </Link>
            <Link 
              href="/admin/bulk-import" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="text-2xl">📦</span>
              <span className="text-sm font-medium text-center">Bulk Import</span>
            </Link>
            <Link 
              href="/admin/analytics" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <TrendingUp className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Analityka</span>
            </Link>
            <Link 
              href="/admin/settings" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="text-2xl">⚙️</span>
              <span className="text-sm font-medium text-center">Ustawienia</span>
            </Link>
            <Link 
              href="/admin/navigation" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="text-2xl">🗺️</span>
              <span className="text-sm font-medium text-center">Nawigacja</span>
            </Link>
            <Link 
              href="/admin/duplicates" 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950 transition-colors"
            >
              <span className="text-2xl">🔍</span>
              <span className="text-sm font-medium text-center">Duplikaty</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(AdminPage);
