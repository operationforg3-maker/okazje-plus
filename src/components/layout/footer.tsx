import Link from 'next/link';
import { ShoppingBag, Facebook, Instagram } from 'lucide-react';
import { getUptimeMs } from '@/lib/uptime';
import { buildInfo } from '@/lib/build-info';
import { useState, useEffect } from 'react';

export function Footer() {
  const [hydrated, setHydrated] = useState(false);
  const [currentYear, setCurrentYear] = useState('2024');

  useEffect(() => {
    setHydrated(true);
    setCurrentYear(new Date().getFullYear().toString());
  }, []);

  // Uptime procesu (od ostatniego startu serwera)
  const uptimeMs = getUptimeMs();
  const uptimeMinutes = Math.floor(uptimeMs / 60_000);
  const uptimeSeconds = Math.floor((uptimeMs % 60_000) / 1000);
  const uptimeHuman = `${uptimeMinutes} min ${uptimeSeconds} s`;

  // Build info (wersja, commit i czas zbudowania)
  const { version, commitShort, builtAt } = buildInfo;
  const builtDate = new Date(builtAt);
  const builtLocal = hydrated && !isNaN(builtDate.getTime()) 
    ? builtDate.toLocaleString('pl-PL') 
    : builtAt;

  return (
    <footer className="mt-10 border-t border-border/40 bg-background/70 backdrop-blur">
      <div className="page-container py-10">
        <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-2xl border border-border/50 bg-card/80 p-6 shadow-lg shadow-primary/5">
            <Link href="/" className="flex items-center gap-2">
              <img src="/Logotyp_okazjeplus.svg" alt="Okazje+" className="h-10 md:h-12" />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Zaufana społeczność wyszukująca najlepsze okazje. Nowy wygląd, ta sama solidna baza ofert.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-foreground/80">
              <ShoppingBag className="h-4 w-4" />
              Świeże promocje dodawane codziennie
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">Nawigacja</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <Link href="/deals" className="transition-colors hover:text-primary">Okazje</Link>
              <Link href="/products" className="transition-colors hover:text-primary">Produkty</Link>
              <Link href="/forum" className="transition-colors hover:text-primary">Forum</Link>
              <Link href="/add-deal" className="transition-colors hover:text-primary">Dodaj okazję</Link>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informacje</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground">
              <Link href="/#o-projekcie" className="transition-colors hover:text-primary">O nas</Link>
              <Link href="mailto:business@okazjeplus.pl" className="transition-colors hover:text-primary">Kontakt</Link>
              <Link href="/polityka-prywatnosci" className="transition-colors hover:text-primary">Polityka prywatności</Link>
              <Link href="/regulamin" className="transition-colors hover:text-primary">Regulamin</Link>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">Social</h3>
            <div className="mt-4 flex gap-3">
              <Link href="https://www.facebook.com/people/Okazje-Plus/61583646609859" className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary" target="_blank" rel="noopener noreferrer">
                <Facebook className="h-5 w-5" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link href="https://www.instagram.com/okazje_plus/" className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary" target="_blank" rel="noopener noreferrer">
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-border/50 bg-card/80 px-4 py-4 text-center text-sm text-muted-foreground shadow-inner">
          <p>
            &copy; {currentYear} Okazje+. Wszelkie prawa zastrzeżone.
          </p>
          <p className="mt-1" suppressHydrationWarning>
            Wersja: v{version} (commit <abbr title={buildInfo.commit}>#{commitShort}</abbr>) · Zbudowano: {builtLocal} · Runtime: <span suppressHydrationWarning>{hydrated ? uptimeHuman : '0 min 0 s'}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
