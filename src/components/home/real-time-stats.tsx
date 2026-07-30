'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
const HOME_STATS_REFRESH_MS = 15 * 60 * 1000;
const FORUM_STATS_REFRESH_MS = 30 * 60 * 1000;

const logClientError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(...args);
  }
};

export function RealTimeStats() {
  const [stats, setStats] = useState<StatsData>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let initialTimer: ReturnType<typeof setTimeout> | null = null;

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
        const response = await fetch('/api/public/stats', { cache: 'no-store' });

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
        logClientError('Failed to fetch stats:', error);
        // Use fallback data
        setStats(prev => ({ ...prev, lastUpdateTime: new Date().toISOString() }));
      } finally {
        setIsLoading(false);
      }
    };

    const scheduleInitialFetch = () => {
      if (typeof window === 'undefined') return;

      // Delay non-critical fetch to reduce early main-thread pressure and improve LCP.
      const run = () => {
        initialTimer = setTimeout(fetchStats, 1200);
      };

      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: IdleRequestCallback) => number }).requestIdleCallback(() => run());
        return;
      }

      run();
    };

    scheduleInitialFetch();

    const interval = setInterval(fetchStats, HOME_STATS_REFRESH_MS);
    return () => {
      if (initialTimer) clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const t = useTranslations('home');
  const statsItems = [
    {
      icon: Flame,
      label: t('stats.hotDealsCount'),
      value: stats.dealsCount,
      color: 'from-orange-500 to-red-500',
      textColor: 'text-orange-600',
    },
    {
      icon: ShoppingBag,
      label: t('stats.products'),
      value: stats.productsCount,
      color: 'from-blue-500 to-cyan-500',
      textColor: 'text-blue-600',
    },
    {
      icon: Users,
      label: t('stats.community'),
      value: stats.usersCount,
      color: 'from-green-500 to-emerald-500',
      textColor: 'text-green-600',
    },
    {
      icon: Trophy,
      label: t('stats.savings'),
      value: `${Math.floor(stats.totalSavings / 1000)}k+`,
      color: 'from-purple-500 to-pink-500',
      textColor: 'text-purple-600',
      isPrice: true,
    },
  ];

  return (
    <div className="min-h-[312px] md:min-h-[160px]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statsItems.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card
            key={idx}
            className={cn(
              'h-full border-2 hover:border-primary/50 transition-[box-shadow,border-color,transform] hover:shadow-lg hover:-translate-y-1',
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
    </div>
  );
}

export function ForumStats() {
  const t = useTranslations('home');
  const [stats, setStats] = useState({ threads: 0, users: 0, replies: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let initialTimer: ReturnType<typeof setTimeout> | null = null;

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
        logClientError('Failed to fetch forum stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const scheduleInitialFetch = () => {
      if (typeof window === 'undefined') return;
      const run = () => {
        initialTimer = setTimeout(fetchStats, 1800);
      };

      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: IdleRequestCallback) => number }).requestIdleCallback(() => run());
        return;
      }

      run();
    };

    scheduleInitialFetch();

    const interval = setInterval(fetchStats, FORUM_STATS_REFRESH_MS);
    return () => {
      if (initialTimer) clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {[
        { label: t('forum.stats.threads'), value: stats.threads, icon: TrendingUp, color: 'bg-primary/10 text-primary border-primary/20' },
        { label: t('forum.stats.users'), value: stats.users, icon: Users, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
        { label: t('forum.stats.replies'), value: stats.replies, icon: Clock, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      ].map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div key={idx} className="flex flex-col items-center text-center p-5 rounded-2xl bg-card/40 border border-border/20 hover:border-primary/30 hover:bg-card/65 transition-all hover:scale-[1.03] duration-300 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 border", stat.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className={cn('text-2xl font-bold tracking-tight', isLoading ? 'text-muted animate-pulse' : 'text-foreground')}>
              {isLoading ? '...' : stat.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 font-medium leading-tight">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}
