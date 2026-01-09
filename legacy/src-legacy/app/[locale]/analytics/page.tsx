'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Package, Users, Award, Calendar } from 'lucide-react';

export default function AnalyticsDashboard() {
  // Mock data - w produkcji pobierane z API
  const stats = {
    totalSavings: 12450,
    dealsUsed: 45,
    favoriteCategory: 'Elektronika',
    memberSince: '2024-01-15',
    level: 7,
    rank: 342,
  };

  return (
    <div className="page-container py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            Twoje Statystyki
          </h1>
          <p className="text-muted-foreground">
            Przeglądaj swoje osiągnięcia i oszczędności
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zaoszczędzone</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.totalSavings.toLocaleString()} zł</div>
              <p className="text-xs text-muted-foreground">Łączne oszczędności</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wykorzystane okazje</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.dealsUsed}</div>
              <p className="text-xs text-muted-foreground">Udanych zakupów</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ranking</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">#{stats.rank}</div>
              <p className="text-xs text-muted-foreground">Level {stats.level}</p>
            </CardContent>
          </Card>
        </div>

        {/* Savings Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Oszczędności w czasie</CardTitle>
            <CardDescription>Twoje miesięczne oszczędności w ostatnim roku</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <TrendingUp className="h-12 w-12 mx-auto opacity-50" />
                <p>Wykres oszczędności pojawi się tutaj</p>
                <p className="text-sm">Integracja z biblioteką wykresów w trakcie...</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ulubione kategorie</CardTitle>
              <CardDescription>Gdzie najczęściej szukasz okazji</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Elektronika', 'Dom i ogród', 'Sport i fitness', 'Moda'].map((cat, i) => (
                  <div key={cat} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cat}</span>
                        <span className="text-sm text-muted-foreground">{[45, 28, 18, 9][i]}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${[45, 28, 18, 9][i]}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aktywność</CardTitle>
              <CardDescription>Twoja ostatnia aktywność</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Dodano okazję</p>
                    <p className="text-xs text-muted-foreground">2 godziny temu</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Nowy obserwujący</p>
                    <p className="text-xs text-muted-foreground">5 godzin temu</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Zdobyto badge</p>
                    <p className="text-xs text-muted-foreground">1 dzień temu</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">💡 Wskazówka</h3>
              <p className="text-sm text-muted-foreground">
                Śledź swoje ulubione kategorie aby otrzymywać powiadomienia o nowych okazjach!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
