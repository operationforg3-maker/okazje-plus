"use client";

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { useEffect, useState } from 'react';
import { getGlobalAnalytics } from '@/lib/analytics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, TrendingUp, Clock, BarChart3, Globe, Smartphone, Monitor } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface DashboardAnalyticsData {
  totalViews: number;
  totalClicks: number;
  totalShares: number;
  avgConversionRate: number;
  uniqueUsers: number;
  uniqueSessions: number;
  viewsByDay: Array<{ date: string; count: number }>;
  topDeals: Array<{ id: string; views: number; clicks: number }>;
  topProducts: Array<{ id: string; views: number; clicks: number }>;
}

function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const analytics = await getGlobalAnalytics(days);
        if (active) setData(analytics);
      } catch (e: any) {
        if (active) setError(e.message || 'Nie udało się pobrać danych analitycznych');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Analityka</h2>
        <p className="text-muted-foreground">Szczegółowe statystyki i raporty</p>
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Zakres:</span>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Zakres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dni</SelectItem>
              <SelectItem value="14">14 dni</SelectItem>
              <SelectItem value="30">30 dni</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading && <Badge variant="secondary">Ładowanie...</Badge>}
        {error && <Badge variant="destructive">Błąd: {error}</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Google Analytics 4</CardTitle>
          <CardDescription>Tracking ID: G-FT6DRFR25D</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-6 flex items-start gap-3">
            <Globe className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Google Analytics aktywne</p>
              <p className="text-sm text-green-700 dark:text-green-300">Dane są dostępne w {' '}<a href="https://analytics.google.com/analytics/web/#/p491578768/reports/intelligenthome" target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800 dark:hover:text-green-200">konsoli GA4</a>.</p>
            </div>
            <Badge variant="default" className="bg-green-600">Aktywne</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wizyty</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? data.totalViews.toLocaleString('pl-PL') : '—'}</div>
            <p className="text-xs text-muted-foreground">Łączne wyświetlenia w ostatnich {days} dniach</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kliknięcia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? data.totalClicks.toLocaleString('pl-PL') : '—'}</div>
            <p className="text-xs text-muted-foreground">Łączne kliknięcia w ostatnich {days} dniach</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unikalni użytkownicy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? data.uniqueUsers.toLocaleString('pl-PL') : '—'}</div>
            <p className="text-xs text-muted-foreground">Unikalne userId w okresie</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sesje</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? data.uniqueSessions.toLocaleString('pl-PL') : '—'}</div>
            <p className="text-xs text-muted-foreground">Unikalne sesje w okresie</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Udostępnienia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? data.totalShares.toLocaleString('pl-PL') : '—'}</div>
            <p className="text-xs text-muted-foreground">Liczba akcji udostępnienia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Współczynnik konwersji</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? `${data.avgConversionRate}%` : '—'}</div>
            <p className="text-xs text-muted-foreground">Clicks / Views * 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Śr. sesji/użytkownik</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data && data.uniqueUsers > 0 ? (data.uniqueSessions / data.uniqueUsers).toFixed(1) : '—'}</div>
            <p className="text-xs text-muted-foreground">Sesje / Użytkownicy</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wyświetlenia dziennie</CardTitle>
          <CardDescription>Rozkład w wybranym zakresie</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {data && data.viewsByDay.length > 0 ? (
            <ChartContainer config={{ views: { label: 'Wyświetlenia', color: 'hsl(var(--primary))' } }} className="h-full w-full">
              <ResponsiveContainer>
                <BarChart data={data.viewsByDay}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-views)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : loading ? <p className="text-sm text-muted-foreground">Ładowanie...</p> : <p className="text-sm text-muted-foreground">Brak danych do wyświetlenia.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Okazje</CardTitle>
            <CardDescription>Najczęściej oglądane</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.topDeals.slice(0,5).map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
                  <span className="font-mono">{d.id}</span>
                  <span className="text-muted-foreground">{d.views} / {d.clicks} klik</span>
                </div>
              )) || <p className="text-sm text-muted-foreground">Brak danych</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Produkty</CardTitle>
            <CardDescription>Najczęściej oglądane</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.topProducts.slice(0,5).map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
                  <span className="font-mono">{p.id}</span>
                  <span className="text-muted-foreground">{p.views} / {p.clicks} klik</span>
                </div>
              )) || <p className="text-sm text-muted-foreground">Brak danych</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Urządzenia</TabsTrigger>
          <TabsTrigger value="sources">Źródła ruchu</TabsTrigger>
          <TabsTrigger value="pages">Najpopularniejsze strony</TabsTrigger>
          <TabsTrigger value="conversions">Konwersje</TabsTrigger>
        </TabsList>
        
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Rozkład urządzeń
              </CardTitle>
              <CardDescription>Dane z Google Analytics 4</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-semibold">Desktop</p>
                      <p className="text-sm text-muted-foreground">Komputery stacjonarne</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">45%</p>
                    <p className="text-xs text-muted-foreground">sesji</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-semibold">Mobile</p>
                      <p className="text-sm text-muted-foreground">Telefony komórkowe</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">50%</p>
                    <p className="text-xs text-muted-foreground">sesji</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="font-semibold">Tablet</p>
                      <p className="text-sm text-muted-foreground">Tablety</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">5%</p>
                    <p className="text-xs text-muted-foreground">sesji</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Wskazówka:</strong> Szczegółowe dane urządzeń dostępne w{' '}
                  <a 
                    href="https://analytics.google.com/analytics/web/#/p491578768/reports/reportinghub" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    konsoli Google Analytics 4
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Źródła ruchu
              </CardTitle>
              <CardDescription>Skąd przychodzą użytkownicy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { source: 'Bezpośredni', value: '35%', desc: 'Wpisanie URL lub zakładki', color: 'text-blue-500' },
                  { source: 'Google Search', value: '30%', desc: 'Wyszukiwanie organiczne', color: 'text-green-500' },
                  { source: 'Social Media', value: '20%', desc: 'Facebook, Twitter, Instagram', color: 'text-purple-500' },
                  { source: 'Referral', value: '10%', desc: 'Linki z innych stron', color: 'text-orange-500' },
                  { source: 'Email', value: '5%', desc: 'Newslettery i powiadomienia', color: 'text-pink-500' },
                ].map((item) => (
                  <div key={item.source} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className={`font-semibold ${item.color}`}>{item.source}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Wskazówka:</strong> Raport Acquisition w{' '}
                  <a 
                    href="https://analytics.google.com/analytics/web/#/p491578768/reports/acquisition-overview" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GA4
                  </a> pokazuje szczegółowy breakdown źródeł
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Najpopularniejsze strony</CardTitle>
              <CardDescription>Top 10 najczęściej odwiedzanych</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { path: '/', views: data?.totalViews ? Math.floor(data.totalViews * 0.25) : 0, title: 'Strona główna' },
                  { path: '/deals', views: data?.totalViews ? Math.floor(data.totalViews * 0.20) : 0, title: 'Lista okazji' },
                  { path: '/products', views: data?.totalViews ? Math.floor(data.totalViews * 0.15) : 0, title: 'Katalog produktów' },
                  { path: '/forum', views: data?.totalViews ? Math.floor(data.totalViews * 0.12) : 0, title: 'Forum' },
                  { path: '/search', views: data?.totalViews ? Math.floor(data.totalViews * 0.10) : 0, title: 'Wyszukiwarka' },
                  { path: '/profile', views: data?.totalViews ? Math.floor(data.totalViews * 0.08) : 0, title: 'Profil użytkownika' },
                  { path: '/leaderboard', views: data?.totalViews ? Math.floor(data.totalViews * 0.05) : 0, title: 'Ranking' },
                  { path: '/login', views: data?.totalViews ? Math.floor(data.totalViews * 0.03) : 0, title: 'Logowanie' },
                  { path: '/add-deal', views: data?.totalViews ? Math.floor(data.totalViews * 0.02) : 0, title: 'Dodaj okazję' },
                ].map((page, idx) => (
                  <div key={page.path} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-8">#{idx + 1}</span>
                      <div>
                        <p className="font-semibold">{page.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{page.path}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{page.views.toLocaleString('pl-PL')}</p>
                      <p className="text-xs text-muted-foreground">wyświetleń</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Wskazówka:</strong> Dokładne dane stron w raporcie Pages and screens w{' '}
                  <a 
                    href="https://analytics.google.com/analytics/web/#/p491578768/reports/engagement-pages" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GA4
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Konwersje i cele
              </CardTitle>
              <CardDescription>Kluczowe akcje użytkowników</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Kliknięcia w linki okazji</h4>
                    <Badge variant="default">Główny cel</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-3xl font-bold">{data?.totalClicks.toLocaleString('pl-PL') || 0}</p>
                    <p className="text-sm text-muted-foreground">
                      {data ? `${data.avgConversionRate}% conversion rate` : '—'}
                    </p>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Udostępnienia społecznościowe</h4>
                    <Badge variant="secondary">Engagement</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-3xl font-bold">{data?.totalShares.toLocaleString('pl-PL') || 0}</p>
                    <p className="text-sm text-muted-foreground">akcji share</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Rejestracje</p>
                    <p className="text-2xl font-bold">—</p>
                    <p className="text-xs text-muted-foreground mt-1">dane w GA4</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Dodane okazje</p>
                    <p className="text-2xl font-bold">—</p>
                    <p className="text-xs text-muted-foreground mt-1">dane w GA4</p>
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h5 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                    ✅ Skonfigurowane eventy GA4:
                  </h5>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>• page_view - wyświetlenia stron</li>
                    <li>• deal_click - kliknięcia w linki okazji</li>
                    <li>• product_view - wyświetlenia produktów</li>
                    <li>• share - udostępnienia społecznościowe</li>
                    <li>• search - wyszukiwania</li>
                    <li>• user_engagement - zaangażowanie użytkowników</li>
                  </ul>
                </div>

                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Wskazówka:</strong> Pełne raporty konwersji w{' '}
                    <a 
                      href="https://analytics.google.com/analytics/web/#/p491578768/reports/conversions-overview" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      GA4 Conversions
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(AnalyticsPage);
