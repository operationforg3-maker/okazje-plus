"use client";
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, Boxes } from 'lucide-react';

interface Counts {
  products: number;
  deals: number;
  users: number;
}

const STATS_CACHE_KEY = 'okazje:home:stats';
const STATS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function formatNumber(n: number) {
  return new Intl.NumberFormat('pl-PL').format(n);
}

export function StatsStrip() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const readCachedCounts = (): Counts | null => {
      try {
        const raw = localStorage.getItem(STATS_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { ts?: number; counts?: Counts };
        if (!parsed?.ts || !parsed?.counts) return null;
        if (Date.now() - parsed.ts > STATS_CACHE_MAX_AGE_MS) return null;
        return parsed.counts;
      } catch {
        return null;
      }
    };

    const writeCachedCounts = (next: Counts) => {
      try {
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), counts: next }));
      } catch {}
    };

    const cached = readCachedCounts();
    if (cached) {
      setCounts(cached);
      setLoading(false);
    }

    async function load() {
      try {
        const res = await fetch('/api/public/stats');
        if (!res.ok) throw new Error(`stats_http_${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          const nextCounts = {
            products: Number(data.productsCount || 0),
            deals: Number(data.dealsCount || 0),
            users: Number(data.usersCount || 0),
          };
          setCounts(nextCounts);
          writeCachedCounts(nextCounts);
        }
      } catch {
        if (!cancelled) {
          setCounts({ products: 0, deals: 0, users: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60_000); // refresh co minutę
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-y py-6">
      <div className="page-container grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon={<Boxes className="h-5 w-5 md:h-6 md:w-6" />}
          label="Produkty w katalogu"
          value={counts?.products}
          loading={loading}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6" />}
          label="Aktywne okazje"
          value={counts?.deals}
          loading={loading}
        />
        <StatCard
          icon={<Users className="h-5 w-5 md:h-6 md:w-6" />}
          label="Użytkownicy społeczności"
          value={counts?.users}
          loading={loading}
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value?: number; loading: boolean }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-card/50 backdrop-blur border shadow-sm">
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <span className="text-xl font-semibold font-headline">{value !== undefined ? formatNumber(value) : '—'}</span>
        )}
      </div>
    </div>
  );
}
