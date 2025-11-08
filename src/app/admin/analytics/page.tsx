'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Eye,
  Clock,
  Globe,
  Smartphone,
  Monitor
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analityka</h2>
        <p className="text-muted-foreground">
          Szczegółowe statystyki i raporty
        </p>
      </div>

      {/* Google Analytics Integration Placeholder */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Google Analytics 4
          </CardTitle>
          <CardDescription>
            Integracja z Google Analytics będzie dostępna w następnej wersji
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-8 text-center">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Aby włączyć Google Analytics, skonfiguruj ID śledzenia w ustawieniach
            </p>
            <Badge variant="secondary">Wkrótce dostępne</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Traffic Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wizyty</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45,231</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 inline-flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +20.1%
              </span>
              {' '}od ostatniego tygodnia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unikalni użytkownicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,543</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 inline-flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +15.3%
              </span>
              {' '}od ostatniego tygodnia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Śr. czas na stronie</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3m 24s</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 inline-flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8.2%
              </span>
              {' '}od ostatniego tygodnia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Współczynnik odrzuceń</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42.3%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 inline-flex items-center">
                <TrendingUp className="h-3 w-3 mr-1 rotate-180" />
                -3.1%
              </span>
              {' '}od ostatniego tygodnia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Urządzenia</TabsTrigger>
          <TabsTrigger value="sources">Źródła ruchu</TabsTrigger>
          <TabsTrigger value="pages">Najpopularniejsze strony</TabsTrigger>
          <TabsTrigger value="conversions">Konwersje</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Podział urządzeń</CardTitle>
                <CardDescription>Według typu urządzenia</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">Mobile</div>
                        <div className="text-sm text-muted-foreground">28,432 sesji</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">63%</div>
                      <div className="w-24 bg-muted rounded-full h-2 mt-1">
                        <div className="bg-primary rounded-full h-2" style={{ width: '63%' }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">Desktop</div>
                        <div className="text-sm text-muted-foreground">14,321 sesji</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">32%</div>
                      <div className="w-24 bg-muted rounded-full h-2 mt-1">
                        <div className="bg-primary rounded-full h-2" style={{ width: '32%' }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">Tablet</div>
                        <div className="text-sm text-muted-foreground">2,478 sesji</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">5%</div>
                      <div className="w-24 bg-muted rounded-full h-2 mt-1">
                        <div className="bg-primary rounded-full h-2" style={{ width: '5%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top systemy operacyjne</CardTitle>
                <CardDescription>Najpopularniejsze platformy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Android', sessions: 18432, percent: 41 },
                    { name: 'iOS', sessions: 12321, percent: 27 },
                    { name: 'Windows', sessions: 10123, percent: 22 },
                    { name: 'macOS', sessions: 3421, percent: 8 },
                    { name: 'Inne', sessions: 934, percent: 2 },
                  ].map((os) => (
                    <div key={os.name} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{os.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {os.sessions.toLocaleString('pl-PL')} sesji
                        </div>
                      </div>
                      <div className="font-semibold">{os.percent}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Źródła ruchu</CardTitle>
              <CardDescription>Skąd przychodzą użytkownicy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { source: 'Organic Search', sessions: 18432, percent: 41, change: '+12%' },
                  { source: 'Direct', sessions: 12321, percent: 27, change: '+8%' },
                  { source: 'Social Media', sessions: 8123, percent: 18, change: '+25%' },
                  { source: 'Referral', sessions: 4234, percent: 9, change: '+5%' },
                  { source: 'Email', sessions: 2121, percent: 5, change: '-2%' },
                ].map((source) => (
                  <div key={source.source} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <div className="font-medium">{source.source}</div>
                      <div className="text-sm text-muted-foreground">
                        {source.sessions.toLocaleString('pl-PL')} sesji
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary">{source.change}</Badge>
                      <div className="text-right">
                        <div className="font-semibold">{source.percent}%</div>
                        <div className="w-24 bg-muted rounded-full h-2 mt-1">
                          <div className="bg-primary rounded-full h-2" style={{ width: `${source.percent}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Najpopularniejsze strony</CardTitle>
              <CardDescription>Według liczby wyświetleń</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { page: '/', views: 12432, avgTime: '2m 34s' },
                  { page: '/deals', views: 9821, avgTime: '4m 12s' },
                  { page: '/products', views: 8234, avgTime: '3m 45s' },
                  { page: '/deals/[id]', views: 6543, avgTime: '5m 23s' },
                  { page: '/products/[id]', views: 5432, avgTime: '4m 56s' },
                  { page: '/search', views: 3421, avgTime: '2m 12s' },
                  { page: '/login', views: 2134, avgTime: '1m 34s' },
                ].map((page) => (
                  <div key={page.page} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="font-mono text-sm">{page.page}</div>
                      <div className="text-xs text-muted-foreground">
                        {page.views.toLocaleString('pl-PL')} wyświetleń
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {page.avgTime}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Konwersje</CardTitle>
              <CardDescription>Działania użytkowników</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { action: 'Kliknięcia w linki afiliacyjne', count: 3421, rate: '7.6%' },
                  { action: 'Dodane komentarze', count: 892, rate: '2.0%' },
                  { action: 'Oddane głosy', count: 2134, rate: '4.7%' },
                  { action: 'Rejestracje użytkowników', count: 234, rate: '0.5%' },
                  { action: 'Dodane okazje', count: 156, rate: '0.3%' },
                ].map((conversion) => (
                  <div key={conversion.action} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <div className="font-medium">{conversion.action}</div>
                      <div className="text-sm text-muted-foreground">
                        {conversion.count.toLocaleString('pl-PL')} działań
                      </div>
                    </div>
                    <Badge>{conversion.rate}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(AnalyticsPage);
