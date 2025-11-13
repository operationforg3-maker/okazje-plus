"use client";

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { useEffect, useState } from 'react';
import { getGlobalAnalytics, getLatestKPISnapshot, calculateKPISnapshot } from '@/lib/analytics';
import { getSegmentDistribution } from '@/lib/segmentation';
import { listRecentExportJobs } from '@/lib/bigquery-export';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  Globe, 
  Users, 
  Activity,
  Download,
  Target,
  Zap
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { KPISnapshot, BigQueryExportJob } from '@/lib/types';

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

const SEGMENT_COLORS = {
  price_sensitive: '#ef4444',
  fast_delivery: '#3b82f6',
  brand_lover: '#8b5cf6',
  deal_hunter: '#f59e0b',
  quality_seeker: '#10b981',
  impulse_buyer: '#ec4899',
};

const SEGMENT_LABELS = {
  price_sensitive: 'Wrażliwi na cenę',
  fast_delivery: 'Szybka dostawa',
  brand_lover: 'Miłośnicy marek',
  deal_hunter: 'Łowcy okazji',
  quality_seeker: 'Poszukiwacze jakości',
  impulse_buyer: 'Impulsywni kupujący',
};

function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);
  const [kpiData, setKpiData] = useState<KPISnapshot | null>(null);
  const [segmentData, setSegmentData] = useState<Record<string, number> | null>(null);
  const [exportJobs, setExportJobs] = useState<BigQueryExportJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingKPI, setIsGeneratingKPI] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [analytics, kpi, segments, jobs] = await Promise.all([
          getGlobalAnalytics(days),
          getLatestKPISnapshot('daily'),
          getSegmentDistribution(),
          listRecentExportJobs(10),
        ]);
        
        if (active) {
          setData(analytics);
          setKpiData(kpi);
          setSegmentData(segments);
          setExportJobs(jobs);
        }
      } catch (e: any) {
        if (active) setError(e.message || 'Nie udało się pobrać danych analitycznych');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [days]);

  const handleGenerateKPI = async () => {
    setIsGeneratingKPI(true);
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 1);
      
      const newKPI = await calculateKPISnapshot('daily', startDate, endDate);
      setKpiData(newKPI);
    } catch (error) {
      console.error('Failed to generate KPI:', error);
    } finally {
      setIsGeneratingKPI(false);
    }
  };

  // Prepare segment chart data
  const segmentChartData = segmentData
    ? Object.entries(segmentData).map(([type, count]) => ({
        name: SEGMENT_LABELS[type as keyof typeof SEGMENT_LABELS] || type,
        value: count,
        fill: SEGMENT_COLORS[type as keyof typeof SEGMENT_COLORS] || '#6b7280',
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">📊 Analityka & KPI</h2>
        <p className="text-muted-foreground">Szczegółowe statystyki, segmentacja użytkowników i eksporty danych</p>
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
        <Button
          onClick={handleGenerateKPI}
          disabled={isGeneratingKPI}
          variant="outline"
          size="sm"
          className="ml-auto"
        >
          <Zap className="h-4 w-4 mr-2" />
          {isGeneratingKPI ? 'Generowanie...' : 'Generuj KPI'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Google Analytics 4
          </CardTitle>
          <CardDescription>Tracking ID: G-4M4NQB0PQD</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-6 flex items-start gap-3">
            <Globe className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Google Analytics aktywne</p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Dane są dostępne w <a href="https://analytics.google.com/analytics/web/#/p491578768/reports/intelligenthome" target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800 dark:hover:text-green-200">konsoli GA4</a>.
              </p>
            </div>
            <Badge variant="default" className="bg-green-600">Aktywne</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Przegląd</TabsTrigger>
          <TabsTrigger value="kpis">KPI Szczegółowe</TabsTrigger>
          <TabsTrigger value="segments">Segmentacja</TabsTrigger>
          <TabsTrigger value="exports">Eksporty BigQuery</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
                <Users className="h-4 w-4 text-muted-foreground" />
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
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data ? `${data.avgConversionRate}%` : '—'}</div>
                <p className="text-xs text-muted-foreground">Clicks / Views * 100</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Śr. sesji/użytkownik</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data && data.uniqueUsers > 0 ? (data.uniqueSessions / data.uniqueUsers).toFixed(1) : '—'}
                </div>
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
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          {kpiData ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpiData.metrics.bounceRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Procent sesji z jedną stroną</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Śr. czas sesji</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(kpiData.metrics.avgSessionDuration)}s</div>
                    <p className="text-xs text-muted-foreground">Średni czas trwania sesji</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Strony/sesja</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpiData.metrics.avgPagesPerSession.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">Średnia liczba stron na sesję</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpiData.metrics.totalInteractions.toLocaleString('pl-PL')}</div>
                    <p className="text-xs text-muted-foreground">Łączna liczba interakcji</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Kategorie</CardTitle>
                  <CardDescription>Najpopularniejsze kategorie w okresie KPI</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {kpiData.topContent.topCategories.slice(0, 10).map((cat, idx) => (
                      <div key={cat.slug} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-6">{idx + 1}.</span>
                        <span className="text-sm flex-1">{cat.slug}</span>
                        <Badge variant="secondary">{cat.views} wyświetleń</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Brak danych KPI. Kliknij "Generuj KPI" aby utworzyć snapshot.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Rozkład segmentów użytkowników</CardTitle>
                <CardDescription>Automatyczna klasyfikacja bazowana na zachowaniach</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {segmentChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={segmentChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {segmentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Brak danych segmentacji</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Szczegóły segmentów</CardTitle>
                <CardDescription>Liczba użytkowników w każdym segmencie</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {segmentChartData.map((segment) => (
                    <div key={segment.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: segment.fill }}
                        />
                        <span className="text-sm font-medium">{segment.name}</span>
                      </div>
                      <Badge variant="secondary">{segment.value} użytkowników</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Charakterystyka segmentów</CardTitle>
              <CardDescription>Opisy i cechy charakterystyczne każdego segmentu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">💰 Wrażliwi na cenę</h4>
                  <p className="text-sm text-muted-foreground">
                    Użytkownicy szukający najlepszych promocji i rabatów. Preferują produkty z niższą ceną i wysokimi zniżkami.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">🚀 Szybka dostawa</h4>
                  <p className="text-sm text-muted-foreground">
                    Priorytet to szybkość dostawy. Preferują produkty z darmową i szybką dostawą.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">⭐ Miłośnicy marek</h4>
                  <p className="text-sm text-muted-foreground">
                    Lojalni wobec określonych marek. Konsekwentnie wybierają produkty od tych samych sprzedawców.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">🎯 Łowcy okazji</h4>
                  <p className="text-sm text-muted-foreground">
                    Bardzo aktywni użytkownicy z wysokim poziomem zaangażowania i współczynnikiem konwersji.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">✨ Poszukiwacze jakości</h4>
                  <p className="text-sm text-muted-foreground">
                    Koncentrują się na jakości produktów. Preferują droższe przedmioty z wysokimi ocenami.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">⚡ Impulsywni kupujący</h4>
                  <p className="text-sm text-muted-foreground">
                    Wysoki współczynnik konwersji. Szybko podejmują decyzje zakupowe bez długich analiz.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Ostatnie eksporty do BigQuery
              </CardTitle>
              <CardDescription>
                Historia eksportów danych analitycznych do BigQuery dla zaawansowanej analizy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exportJobs.length > 0 ? (
                <div className="space-y-2">
                  {exportJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              job.status === 'completed' ? 'default' :
                              job.status === 'failed' ? 'destructive' :
                              job.status === 'running' ? 'secondary' : 'outline'
                            }
                          >
                            {job.status}
                          </Badge>
                          <span className="font-medium">{job.dataType}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(job.startedAt).toLocaleString('pl-PL')} • 
                          {job.recordCount ? ` ${job.recordCount} rekordów` : ''}
                          {job.durationMs ? ` • ${(job.durationMs / 1000).toFixed(1)}s` : ''}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        Szczegóły
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    Brak historii eksportów. Eksporty uruchamiane są automatycznie codziennie.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Konfiguracja BigQuery</CardTitle>
              <CardDescription>
                Automatyczne eksporty danych do BigQuery dla głębokiej analizy i raportowania
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
                  <h4 className="font-semibold text-sm mb-2">📊 Dostępne tabele w BigQuery:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• <code>okazje_plus_interactions</code> - Interakcje użytkowników</li>
                    <li>• <code>okazje_plus_sessions</code> - Metryki sesji</li>
                    <li>• <code>okazje_plus_kpis</code> - Snapshoty KPI</li>
                    <li>• <code>okazje_plus_segments</code> - Segmentacja użytkowników</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  Eksporty są wykonywane automatycznie codziennie o północy. Dane są dostępne w projekcie BigQuery dla zaawansowanych zapytań SQL i integracji z narzędziami BI.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(AnalyticsPage);
