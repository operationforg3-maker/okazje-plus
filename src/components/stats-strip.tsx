"use client";
import { useEffect, useState } from 'react';
import { getCounts } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, Boxes } from 'lucide-react';

interface Counts {
  products: number;
  deals: number;
  users: number;
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('pl-PL').format(n);
}

export function StatsStrip() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const c = await getCounts();
        if (!cancelled) setCounts(c);
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
      <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon={<Boxes className="h-5 w-5" />}
          label="Produkty w katalogu"
          value={counts?.products}
          loading={loading}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Aktywne okazje"
          value={counts?.deals}
          loading={loading}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
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
