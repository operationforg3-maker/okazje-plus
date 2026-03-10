'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, ShoppingBag, Users, Trophy, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsData {
  dealsCount: number;
  productsCount: number;
  usersCount: number;
  totalSavings: number;
  activeForumThreads: number;
  lastUpdateTime: string;
}

const defaultStats: StatsData = {
  dealsCount: 0,
  productsCount: 0,
  usersCount: 0,
  totalSavings: 0,
  activeForumThreads: 0,
  lastUpdateTime: new Date().toISOString(),
};

const STATS_CACHE_KEY = 'okazje:home:stats:full';
const STATS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export function RealTimeStats() {
  const [stats, setStats] = useState<StatsData>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const readCachedStats = (): StatsData | null => {
      try {
        const raw = localStorage.getItem(STATS_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { ts?: number; stats?: StatsData };
        if (!parsed?.ts || !parsed?.stats) return null;
        if (Date.now() - parsed.ts > STATS_CACHE_MAX_AGE_MS) return null;
        return parsed.stats;
      } catch {
        return null;
      }
    };

    const writeCachedStats = (next: StatsData) => {
      try {
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), stats: next }));
      } catch {}
    };

    const cached = readCachedStats();
    if (cached) {
      setStats(cached);
      setIsLoading(false);
    }

    const fetchStats = async () => {
      try {
        const response = await fetch('/api/public/stats');

        if (response.ok) {
          const data = await response.json();
          const nextStats = {
            dealsCount: data.dealsCount || 0,
            productsCount: data.productsCount || 0,
            usersCount: data.usersCount || 0,
            totalSavings: data.totalSavings || 0,
            activeForumThreads: data.activeForumThreads || 0,
            lastUpdateTime: new Date().toISOString(),
          };
          setStats(nextStats);
          writeCachedStats(nextStats);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        // Use fallback data
        setStats(prev => ({ ...prev, lastUpdateTime: new Date().toISOString() }));
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const statsItems = [
    {
      icon: Flame,
      label: 'Gorących okazji',
      value: stats.dealsCount,
      color: 'from-orange-500 to-red-500',
      textColor: 'text-orange-600',
    },
    {
      icon: ShoppingBag,
      label: 'Produktów',
      value: stats.productsCount,
      color: 'from-blue-500 to-cyan-500',
      textColor: 'text-blue-600',
    },
    {
      icon: Users,
      label: 'Użytkowników',
      value: stats.usersCount,
      color: 'from-green-500 to-emerald-500',
      textColor: 'text-green-600',
    },
    {
      icon: Trophy,
      label: 'Oszczędności',
      value: `${Math.floor(stats.totalSavings / 1000)}k+`,
      color: 'from-purple-500 to-pink-500',
      textColor: 'text-purple-600',
      isPrice: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statsItems.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card
            key={idx}
            className={cn(
              'border-2 hover:border-primary/50 transition-all hover:shadow-lg hover:-translate-y-1',
              isLoading ? 'animate-pulse' : ''
            )}
          >
            <CardContent className="p-6 text-center space-y-3">
              <div className={cn('h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center mx-auto', `bg-gradient-to-br ${stat.color}`)}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className={cn('text-3xl font-bold transition-colors', stat.textColor)}>
                  {isLoading ? '...' : stat.value}
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ForumStats() {
  const [stats, setStats] = useState({ threads: 0, users: 0, replies: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/forum/stats', {
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          setStats({
            threads: data.threads || 0,
            users: data.users || 0,
            replies: data.replies || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch forum stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Refresh every 10 minutes
    const interval = setInterval(fetchStats, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
      {[
        { label: 'Aktywnych wątków', value: stats.threads, icon: TrendingUp },
        { label: 'Użytkowników', value: stats.users, icon: Users },
        { label: 'Odpowiedzi dziennie', value: stats.replies, icon: Clock },
      ].map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div key={idx} className="text-center p-4 rounded-lg hover:bg-card/50 transition-colors">
            <Icon className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className={cn('text-3xl font-bold', isLoading ? 'text-muted animate-pulse' : 'text-primary')}>
              {isLoading ? '...' : stat.value}
            </div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}
