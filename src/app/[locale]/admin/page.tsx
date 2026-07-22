'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShoppingCart, 
  Flame, 
  Users, 
  TrendingUp, 
  Package,
  Activity,
  Eye,
  MessageSquare,
  ThumbsUp,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { getHotDeals, getAdminDashboardStats } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Deal } from '@/lib/types';
import TestsTab from '@/components/admin/tests-tab';
import { ExchangeRateAlert } from '@/components/admin/exchange-rate-alert';
import { BackgroundProcessControl } from '@/components/admin/background-process-control';

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
  categories?: {
    total: number;
    main: number;
    sub: number;
    subSub: number;
  };
  imports?: {
    running: number;
    queued: number;
    completed24h: number;
    failed24h: number;
  };
  harvester?: {
    running: number;
    created24h: number;
  };
}

interface AdminHealth {
  status: 'ok' | 'error';
  checkedAt?: string;
  system?: {
    smokeReady?: boolean;
    aliexpress?: {
      appKeyConfigured?: boolean;
      appSecretConfigured?: boolean;
    };
  };
  totals?: {
    deals: number;
    products: number;
    users: number;
  };
}

function AdminPage() {
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [hotDeals, setHotDeals] = useState<Deal[]>([]);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const { getIdToken } = useAuth();

  const localePrefix = (() => {
    const first = pathname.split('/')[1];
    return ['pl', 'en', 'de'].includes(first) ? `/${first}` : '';
  })();

  const adminHref = (path: string) => `${localePrefix}${path}`;

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setHealth({ status: 'error' });
        return;
      }

      const response = await fetch('/api/admin/health', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Health endpoint failed: ${response.status}`);
      }

      const data = await response.json();
      setHealth(data);
    } catch {
      setHealth({ status: 'error' });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = await getIdToken();
        const [dashStats, dealsData] = await Promise.all([
          getAdminDashboardStats(token || undefined),
          getHotDeals(5)
        ]);
        setDashboardStats(dashStats);
        setStats(dashStats?.totals || { deals: 0, products: 0, users: 0 });
        setHotDeals(dealsData);
        await fetchHealth();
      } catch (error) {
        // Fallback to zeroed stats to keep UI stable when API fails
        const fallback: DashboardStats = {
          totals: { deals: 0, products: 0, users: 0 },
          pending: { deals: 0, products: 0 },
          new24h: { deals: 0, users: 0 },
          avgTemperature: 0,
          topCategories: [],
          recentActivity: 0,
          analytics: {
            views: { total: 0, today: 0, trend: 0 },
            clicks: { total: 0, today: 0, trend: 0 },
            shares: { total: 0 },
            conversionRate: 0,
          },
          growth: { deals: 0, products: 0, users: 0 },
          categories: { total: 0, main: 0, sub: 0, subSub: 0 },
          imports: { running: 0, queued: 0, completed24h: 0, failed24h: 0 },
          harvester: { running: 0, created24h: 0 },
        };
        setDashboardStats(fallback);
        setStats(fallback.totals);
        await fetchHealth();
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [getIdToken]);

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
          <ExchangeRateAlert />
          <Button asChild variant="outline" size="sm">
            <Link href={adminHref('/admin/setup')}>
              <Settings className="h-4 w-4 mr-2" />
              Setup i seeding
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={adminHref('/admin/analytics')}>
              <Activity className="h-4 w-4 mr-2" />
              Analityka
            </Link>
          </Button>
        </div>
      </div>

      {/* Control Procesów w Tle (Master Switch) */}
      <BackgroundProcessControl />

      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-600" />
            Health Check panelu admina
          </CardTitle>
          <CardDescription>
            Szybki status backendu admina, kluczy AliExpress i liczników kolekcji.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Status API</div>
              <div className="mt-1 font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {health?.status === 'ok' ? 'OK' : 'Błąd'}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">AliExpress smoke-ready</div>
              <div className="mt-1 font-semibold">
                {health?.system?.smokeReady ? 'Tak' : 'Nie'}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Skan danych</div>
              <div className="mt-1 text-sm">
                D: {health?.totals?.deals ?? '—'} · P: {health?.totals?.products ?? '—'} · U: {health?.totals?.users ?? '—'}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={healthLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
            Odśwież health
          </Button>
        </CardContent>
      </Card>

      {/* Quick Action Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Okazje</CardTitle>
              <Flame className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.deals ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {dashboardStats?.pending?.deals ?? 0} oczekujących
                {(dashboardStats?.pending?.deals ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1">!</Badge>
                )}
              </p>
              {(dashboardStats?.growth?.deals ?? 0) > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{dashboardStats?.growth?.deals} (24h)
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produkty</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.products ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {dashboardStats?.pending?.products ?? 0} oczekujących
                {(dashboardStats?.pending?.products ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1">!</Badge>
                )}
              </p>
              {(dashboardStats?.growth?.products ?? 0) > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{dashboardStats?.growth?.products} (24h)
                </p>
              )}
            </CardContent>
          </Card>

        <Link href={adminHref('/admin/users')}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.users ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aktywni użytkownicy
              </p>
              {(dashboardStats?.growth?.users ?? 0) > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{dashboardStats?.growth?.users} (24h)
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href={adminHref('/admin/forum/moderation')}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Forum</CardTitle>
              <MessageSquare className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Aktywne</div>
              <p className="text-xs text-muted-foreground mt-1">
                Moderacja wątków
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* System Status & Categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prototypy UX</CardTitle>
            <Eye className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Szybki dostęp do wszystkich ukrytych wariantów podglądowych.</p>
            <div className="grid gap-2">
              <Link href={adminHref('/preview')} className="rounded-xl border border-muted px-4 py-3 text-sm text-slate-700 transition hover:border-primary hover:bg-primary/5">
                Podgląd główny /preview
              </Link>
              <Link href={adminHref('/preview/design-1')} className="rounded-xl border border-muted px-4 py-3 text-sm text-slate-700 transition hover:border-primary hover:bg-primary/5">
                Design 1 — AI Concierge
              </Link>
              <Link href={adminHref('/preview/design-2')} className="rounded-xl border border-muted px-4 py-3 text-sm text-slate-700 transition hover:border-primary hover:bg-primary/5">
                Design 2 — Editorial Magazine
              </Link>
              <Link href={adminHref('/preview/design-3')} className="rounded-xl border border-muted px-4 py-3 text-sm text-slate-700 transition hover:border-primary hover:bg-primary/5">
                Design 3 — Speedboard
              </Link>
              <Link href={adminHref('/preview/design-4')} className="rounded-xl border border-muted px-4 py-3 text-sm text-slate-700 transition hover:border-primary hover:bg-primary/5">
                Design 4 — Conversational Funnel
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Categories Card */}
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kategorie</CardTitle>
            <Package className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats?.categories?.total ?? 0}</div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Główne:</span>
                <span className="font-medium">{dashboardStats?.categories?.main ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Podkategorie (L2):</span>
                <span className="font-medium">{dashboardStats?.categories?.sub ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pod-podkategorie (L3):</span>
                <span className="font-medium">{dashboardStats?.categories?.subSub ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import & Pipeline Status Card */}
        <Link href={adminHref('/admin/import')}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-indigo-500 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Import & Pipeline</CardTitle>
              <Activity className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats?.harvester?.created24h || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">produktów importowanych (24h)</p>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Aktywne joby:</span>
                  <span className="font-medium text-blue-600">{dashboardStats?.harvester?.running || 0}</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t">
                <span className="text-xs text-blue-600 hover:underline">Centrum importu →</span>
              </div>
            </CardContent>
          </Card>
        </Link>


        {/* Average Temperature Card */}
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Średnia temperatura</CardTitle>
            <Flame className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats?.avgTemperature?.toFixed(0) || '—'}°
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Aktywność społeczności
            </p>
            <div className="mt-2 flex items-center gap-2">
              {(dashboardStats?.avgTemperature ?? 0) > 50 && (
                <Badge variant="default" className="bg-orange-500">Gorąco 🔥</Badge>
              )}
              {(dashboardStats?.avgTemperature ?? 0) <= 50 && (dashboardStats?.avgTemperature ?? 0) > 20 && (
                <Badge variant="secondary">Normalnie</Badge>
              )}
              {(dashboardStats?.avgTemperature ?? 0) <= 20 && (
                <Badge variant="outline">Zimno ❄️</Badge>
              )}
            </div>
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
              {(dashboardStats?.pending?.deals || 0) + (dashboardStats?.pending?.products || 0)}
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {dashboardStats?.pending?.deals || 0} okazji, {dashboardStats?.pending?.products || 0} produktów
            </p>
            <Button asChild variant="link" size="sm" className="px-0 h-auto mt-2 text-amber-700 dark:text-amber-300">
              <Link href={adminHref('/admin/moderation')}>
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
            <CardDescription>Całkowite (All time)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(dashboardStats?.analytics?.views?.total || 0).toLocaleString?.() || 0}
            </div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className={`font-medium ${
                (dashboardStats?.analytics?.views?.trend ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(dashboardStats?.analytics?.views?.trend ?? 0) >= 0 ? '+' : ''}
                {dashboardStats?.analytics?.views?.trend ?? 0}%
              </span>
              <span className="mx-2">•</span>
              {(dashboardStats?.analytics?.views?.today || 0).toLocaleString?.() || 0} dzisiaj
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Kliknięcia
            </CardTitle>
            <CardDescription>W linki zewnętrzne (Całkowite)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(dashboardStats?.analytics?.clicks?.total || 0).toLocaleString?.() || 0}
            </div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <span className={`font-medium ${
                (dashboardStats?.analytics?.clicks?.trend ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(dashboardStats?.analytics?.clicks?.trend ?? 0) >= 0 ? '+' : ''}
                {dashboardStats?.analytics?.clicks?.trend ?? 0}%
              </span>
              <span className="mx-2">•</span>
              {(dashboardStats?.analytics?.clicks?.today || 0).toLocaleString?.() || 0} dzisiaj
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
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Aktywność
          </TabsTrigger>
          <TabsTrigger value="tests">
            <CheckCircle className="h-4 w-4 mr-2" />
            Testy
          </TabsTrigger>
        </TabsList>

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
                {hotDeals.slice(0, 5).map((deal) => (
                  <div key={deal.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                    <div className="p-2 rounded-full bg-red-100 text-red-600">
                      <Flame className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Nowa gorąca okazja</div>
                      <div className="text-sm text-muted-foreground truncate">{deal.title?.pl || deal.title?.en || 'Bez tytułu'}</div>
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

        <TabsContent value="tests" className="space-y-4">
          <TestsTab />
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
              href={adminHref('/admin/moderation')} 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors"
            >
              <AlertCircle className="h-8 w-8 text-orange-500" />
              <span className="text-sm font-medium text-center">Moderacja</span>
            </Link>
            <Link 
              href={adminHref('/admin/users')} 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Users className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Użytkownicy</span>
            </Link>
            <Link 
              href={adminHref('/admin/analytics')} 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <TrendingUp className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-center">Analityka</span>
            </Link>
            <Link 
              href={adminHref('/admin/settings')} 
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="text-2xl">⚙️</span>
              <span className="text-sm font-medium text-center">Ustawienia</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(AdminPage);
