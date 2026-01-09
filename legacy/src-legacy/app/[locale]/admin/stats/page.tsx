'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  Flame,
  Users,
  Eye,
  MessageSquare,
  Heart,
  TrendingUp,
  Calendar,
  Zap,
  Clock,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  Package,
  DollarSign,
  Activity
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Stats {
  // Główne statystyki
  totalProducts: number;
  totalDeals: number;
  totalUsers: number;
  totalComments: number;
  totalViews: number;
  totalFavorites: number;
  
  // Status produktów/dealów
  approvedProducts: number;
  pendingProducts: number;
  draftProducts: number;
  rejectedProducts: number;
  
  approvedDeals: number;
  pendingDeals: number;
  draftDeals: number;
  rejectedDeals: number;
  
  // Ciekawostki
  hotDeals: number; // temperatura > 300
  topRatedProducts: number; // rating > 4.5
  productsWithDiscount: number;
  avgProductPrice: number;
  avgDealPrice: number;
  mostActiveUsers: number; // użytkownicy z > 5 postami
  todayDeals: number;
  weekDeals: number;
  monthDeals: number;
  
  // Dodatkowe
  totalVotes: number;
  avgDealTemperature: number;
  productsFromAliExpress: number;
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  loading 
}: { 
  title: string; 
  value: string | number; 
  description?: string; 
  icon: any; 
  trend?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-24" />
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <Badge variant="secondary" className="mt-2">
            {trend}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);

        // Fetch products
        const productsSnap = await getDocs(collection(db, 'products'));
        const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Fetch deals
        const dealsSnap = await getDocs(collection(db, 'deals'));
        const deals = dealsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Fetch users
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Fetch comments (all subcollections)
        let totalComments = 0;
        for (const deal of deals) {
          const commentsSnap = await getDocs(collection(db, 'deals', deal.id, 'comments'));
          totalComments += commentsSnap.size;
        }
        for (const product of products) {
          const commentsSnap = await getDocs(collection(db, 'products', product.id, 'comments'));
          totalComments += commentsSnap.size;
        }
        
        // Fetch favorites
        const favoritesSnap = await getDocs(collection(db, 'favorites'));
        
        // Fetch analytics for views
        const analyticsSnap = await getDocs(
          query(collection(db, 'analytics'), where('type', '==', 'view'), limit(1000))
        );
        
        // Calculate stats
        const approvedProducts = products.filter((p: any) => p.status === 'approved').length;
        const pendingProducts = products.filter((p: any) => p.status === 'pending').length;
        const draftProducts = products.filter((p: any) => p.status === 'draft').length;
        const rejectedProducts = products.filter((p: any) => p.status === 'rejected').length;
        
        const approvedDeals = deals.filter((d: any) => d.status === 'approved').length;
        const pendingDeals = deals.filter((d: any) => d.status === 'pending').length;
        const draftDeals = deals.filter((d: any) => d.status === 'draft').length;
        const rejectedDeals = deals.filter((d: any) => d.status === 'rejected').length;
        
        const hotDeals = deals.filter((d: any) => (d.temperature || 0) > 300).length;
        const topRatedProducts = products.filter((p: any) => {
          const rating = p.ratingCard?.average || p.rating || 0;
          return rating >= 4.5;
        }).length;
        
        const productsWithDiscount = products.filter((p: any) => 
          p.originalPrice && p.originalPrice > p.price
        ).length;
        
        const avgProductPrice = products.length > 0
          ? products.reduce((sum: number, p: any) => sum + (p.price || 0), 0) / products.length
          : 0;
          
        const avgDealPrice = deals.length > 0
          ? deals.reduce((sum: number, d: any) => sum + (d.price || 0), 0) / deals.length
          : 0;
        
        // Users with > 5 posts
        const userPostCounts = new Map<string, number>();
        deals.forEach((d: any) => {
          const uid = d.postedBy || d.userId;
          if (uid) userPostCounts.set(uid, (userPostCounts.get(uid) || 0) + 1);
        });
        const mostActiveUsers = Array.from(userPostCounts.values()).filter(c => c > 5).length;
        
        // Time-based deals
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const todayDeals = deals.filter((d: any) => {
          const postedAt = d.postedAt ? new Date(d.postedAt) : null;
          return postedAt && postedAt >= todayStart;
        }).length;
        
        const weekDeals = deals.filter((d: any) => {
          const postedAt = d.postedAt ? new Date(d.postedAt) : null;
          return postedAt && postedAt >= weekStart;
        }).length;
        
        const monthDeals = deals.filter((d: any) => {
          const postedAt = d.postedAt ? new Date(d.postedAt) : null;
          return postedAt && postedAt >= monthStart;
        }).length;
        
        const totalVotes = deals.reduce((sum: number, d: any) => sum + (d.voteCount || 0), 0);
        const avgDealTemperature = deals.length > 0
          ? deals.reduce((sum: number, d: any) => sum + (d.temperature || 0), 0) / deals.length
          : 0;
        
        const productsFromAliExpress = products.filter((p: any) => 
          p.metadata?.source === 'aliexpress'
        ).length;

        setStats({
          totalProducts: products.length,
          totalDeals: deals.length,
          totalUsers: users.length,
          totalComments,
          totalViews: analyticsSnap.size,
          totalFavorites: favoritesSnap.size,
          
          approvedProducts,
          pendingProducts,
          draftProducts,
          rejectedProducts,
          
          approvedDeals,
          pendingDeals,
          draftDeals,
          rejectedDeals,
          
          hotDeals,
          topRatedProducts,
          productsWithDiscount,
          avgProductPrice,
          avgDealPrice,
          mostActiveUsers,
          todayDeals,
          weekDeals,
          monthDeals,
          totalVotes,
          avgDealTemperature,
          productsFromAliExpress,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statystyki Platformy</h1>
        <p className="text-muted-foreground mt-2">
          Kompleksowy przegląd aktywności i wydajności platformy Okazje+
        </p>
      </div>

      {/* Główne statystyki */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Główne metryki</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Produkty"
            value={stats?.totalProducts || 0}
            description={`${stats?.approvedProducts || 0} zatwierdzone`}
            icon={ShoppingCart}
            loading={loading}
          />
          <StatCard
            title="Okazje"
            value={stats?.totalDeals || 0}
            description={`${stats?.hotDeals || 0} gorących (>300°)`}
            icon={Flame}
            loading={loading}
          />
          <StatCard
            title="Użytkownicy"
            value={stats?.totalUsers || 0}
            description={`${stats?.mostActiveUsers || 0} bardzo aktywnych`}
            icon={Users}
            loading={loading}
          />
          <StatCard
            title="Komentarze"
            value={stats?.totalComments || 0}
            description="Łączna liczba komentarzy"
            icon={MessageSquare}
            loading={loading}
          />
        </div>
      </div>

      {/* Status produktów */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Status produktów</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Zatwierdzone"
            value={stats?.approvedProducts || 0}
            icon={CheckCircle}
            trend={stats ? `${Math.round((stats.approvedProducts / stats.totalProducts) * 100)}%` : undefined}
            loading={loading}
          />
          <StatCard
            title="Oczekujące"
            value={stats?.pendingProducts || 0}
            icon={Clock}
            loading={loading}
          />
          <StatCard
            title="Szkice"
            value={stats?.draftProducts || 0}
            icon={Package}
            loading={loading}
          />
          <StatCard
            title="Odrzucone"
            value={stats?.rejectedProducts || 0}
            icon={XCircle}
            loading={loading}
          />
        </div>
      </div>

      {/* Status okazji */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Status okazji</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Zatwierdzone"
            value={stats?.approvedDeals || 0}
            icon={CheckCircle}
            trend={stats ? `${Math.round((stats.approvedDeals / stats.totalDeals) * 100)}%` : undefined}
            loading={loading}
          />
          <StatCard
            title="Oczekujące"
            value={stats?.pendingDeals || 0}
            icon={Clock}
            loading={loading}
          />
          <StatCard
            title="Szkice"
            value={stats?.draftDeals || 0}
            icon={Package}
            loading={loading}
          />
          <StatCard
            title="Odrzucone"
            value={stats?.rejectedDeals || 0}
            icon={XCircle}
            loading={loading}
          />
        </div>
      </div>

      {/* Ciekawostki */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Ciekawostki i trendy</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Top produkty"
            value={stats?.topRatedProducts || 0}
            description="Ocena ≥ 4.5 ⭐"
            icon={Star}
            loading={loading}
          />
          <StatCard
            title="Produkty z rabatem"
            value={stats?.productsWithDiscount || 0}
            description="Mają cenę oryginalną"
            icon={DollarSign}
            loading={loading}
          />
          <StatCard
            title="Gorące okazje"
            value={stats?.hotDeals || 0}
            description="Temperatura > 300°"
            icon={Flame}
            loading={loading}
          />
          <StatCard
            title="Średnia cena produktu"
            value={stats ? `${stats.avgProductPrice.toFixed(2)} PLN` : '0 PLN'}
            icon={DollarSign}
            loading={loading}
          />
          <StatCard
            title="Średnia cena okazji"
            value={stats ? `${stats.avgDealPrice.toFixed(2)} PLN` : '0 PLN'}
            icon={DollarSign}
            loading={loading}
          />
          <StatCard
            title="Średnia temperatura"
            value={stats ? `${stats.avgDealTemperature.toFixed(0)}°` : '0°'}
            description="Średnia wszystkich okazji"
            icon={TrendingUp}
            loading={loading}
          />
        </div>
      </div>

      {/* Aktywność czasowa */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Aktywność czasowa</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Dzisiaj"
            value={stats?.todayDeals || 0}
            description="Nowe okazje dzisiaj"
            icon={Calendar}
            loading={loading}
          />
          <StatCard
            title="Ostatni tydzień"
            value={stats?.weekDeals || 0}
            description="Okazje z ostatnich 7 dni"
            icon={Calendar}
            loading={loading}
          />
          <StatCard
            title="Ostatni miesiąc"
            value={stats?.monthDeals || 0}
            description="Okazje z ostatnich 30 dni"
            icon={Calendar}
            loading={loading}
          />
        </div>
      </div>

      {/* Zaangażowanie */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Zaangażowanie użytkowników</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Wyświetlenia"
            value={stats?.totalViews || 0}
            description="Łączne wyświetlenia"
            icon={Eye}
            loading={loading}
          />
          <StatCard
            title="Ulubione"
            value={stats?.totalFavorites || 0}
            description="Dodane do ulubionych"
            icon={Heart}
            loading={loading}
          />
          <StatCard
            title="Głosy"
            value={stats?.totalVotes || 0}
            description="Wszystkie głosy (↑/↓)"
            icon={Zap}
            loading={loading}
          />
          <StatCard
            title="Aktywni użytkownicy"
            value={stats?.mostActiveUsers || 0}
            description=">5 postów"
            icon={Activity}
            loading={loading}
          />
        </div>
      </div>

      {/* Źródła */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Źródła produktów</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Z AliExpress"
            value={stats?.productsFromAliExpress || 0}
            description="Zaimportowane z AliExpress"
            icon={Package}
            trend={stats ? `${Math.round((stats.productsFromAliExpress / stats.totalProducts) * 100)}%` : undefined}
            loading={loading}
          />
          <StatCard
            title="Manualne"
            value={stats ? stats.totalProducts - stats.productsFromAliExpress : 0}
            description="Dodane ręcznie"
            icon={Package}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
