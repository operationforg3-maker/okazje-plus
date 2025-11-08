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
  Clock
} from 'lucide-react';
import { getCounts } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Stats {
  products: number;
  deals: number;
  users: number;
}

function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const counts = await getCounts();
        setStats(counts);
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Przegląd statystyk i aktywności platformy
        </p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produkty</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.products || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 inline-flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12%
              </span>
              {' '}od ostatniego miesiąca
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Okazje</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.deals || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 inline-flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +23%
              </span>
              {' '}od ostatniego miesiąca
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 inline-flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8%
              </span>
              {' '}od ostatniego miesiąca
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Średnia temperatura</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">342°</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 inline-flex items-center">
                <TrendingDown className="h-3 w-3 mr-1" />
                -5%
              </span>
              {' '}od ostatniego miesiąca
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wyświetlenia</CardTitle>
            <CardDescription>Ostatnie 7 dni</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">45,231</div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <Eye className="h-4 w-4 mr-1" />
              6,432 dzisiaj
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Komentarze</CardTitle>
            <CardDescription>Ostatnie 7 dni</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">892</div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <MessageSquare className="h-4 w-4 mr-1" />
              127 dzisiaj
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Głosy</CardTitle>
            <CardDescription>Ostatnie 7 dni</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3,421</div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <ThumbsUp className="h-4 w-4 mr-1" />
              489 dzisiaj
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="hot-deals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hot-deals">Gorące okazje</TabsTrigger>
          <TabsTrigger value="top-products">Top produkty</TabsTrigger>
          <TabsTrigger value="categories">Kategorie</TabsTrigger>
          <TabsTrigger value="activity">Aktywność</TabsTrigger>
        </TabsList>

        <TabsContent value="hot-deals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 najgorętszych okazji</CardTitle>
              <CardDescription>
                Ranking według temperatury w ostatnich 24h
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-muted-foreground w-6">#{i}</div>
                      <div>
                        <div className="font-medium">iPhone 15 Pro Max - super okazja!</div>
                        <div className="text-sm text-muted-foreground">Elektronika → Smartfony</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="destructive" className="font-bold">
                        {520 - i * 20}°
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {i}h temu
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Najwyżej oceniane produkty</CardTitle>
              <CardDescription>
                Ranking według średniej oceny
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-muted-foreground w-6">#{i}</div>
                      <div>
                        <div className="font-medium">MacBook Pro M3 14"</div>
                        <div className="text-sm text-muted-foreground">Elektronika → Laptopy</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="font-bold">
                        ⭐ {(5.0 - i * 0.1).toFixed(1)}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {Math.floor(Math.random() * 200) + 50} ocen
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Najpopularniejsze kategorie</CardTitle>
              <CardDescription>
                Według liczby wyświetleń w ostatnim tygodniu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'Elektronika', views: 12543, icon: '💻' },
                  { name: 'Dom i Ogród', views: 8932, icon: '🏠' },
                  { name: 'Sport i Fitness', views: 6721, icon: '⚽' },
                  { name: 'Moda', views: 5432, icon: '👕' },
                  { name: 'Zdrowie i Uroda', views: 4123, icon: '💄' },
                ].map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cat.icon}</span>
                      <div>
                        <div className="font-medium">{cat.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {cat.views.toLocaleString('pl-PL')} wyświetleń
                        </div>
                      </div>
                    </div>
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2" 
                        style={{ width: `${(cat.views / 12543) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
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
                {[
                  { type: 'deal', action: 'Dodano nową okazję', details: 'iPhone 15 Pro Max', time: '2 min temu' },
                  { type: 'product', action: 'Zaktualizowano produkt', details: 'Samsung Galaxy S24', time: '15 min temu' },
                  { type: 'user', action: 'Nowy użytkownik', details: 'jan.kowalski@example.com', time: '23 min temu' },
                  { type: 'deal', action: 'Zatwierdzono okazję', details: 'Sony WH-1000XM5', time: '1h temu' },
                  { type: 'product', action: 'Dodano produkt', details: 'MacBook Air M2', time: '2h temu' },
                ].map((activity, i) => (
                  <div key={i} className="flex items-start gap-3 border-b pb-3 last:border-0">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'deal' ? 'bg-red-100 text-red-600' :
                      activity.type === 'product' ? 'bg-blue-100 text-blue-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {activity.type === 'deal' ? <Flame className="h-4 w-4" /> :
                       activity.type === 'product' ? <Package className="h-4 w-4" /> :
                       <Users className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{activity.action}</div>
                      <div className="text-sm text-muted-foreground truncate">{activity.details}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {activity.time}
                    </div>
                  </div>
                ))}
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
            Najczęściej używane funkcje
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors">
              <Flame className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Dodaj okazję</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Dodaj produkt</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Import CSV</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors">
              <Users className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Zarządzaj użytkownikami</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(AdminPage);
