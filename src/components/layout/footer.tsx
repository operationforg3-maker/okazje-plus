import Link from 'next/link';
import { ShoppingBag, Facebook, Instagram } from 'lucide-react';
import { getUptimeMs } from '@/lib/uptime';
import { buildInfo } from '@/lib/build-info';

export function Footer() {
  // Uptime procesu (od ostatniego startu serwera)
  const uptimeMs = getUptimeMs();
  const uptimeMinutes = Math.floor(uptimeMs / 60_000);
  const uptimeSeconds = Math.floor((uptimeMs % 60_000) / 1000);
  const uptimeHuman = `${uptimeMinutes} min ${uptimeSeconds} s`;

  // Build info (wersja, commit i czas zbudowania)
  const { version, commitShort, builtAt } = buildInfo;
  const builtDate = new Date(builtAt);
  const builtLocal = isNaN(builtDate.getTime()) ? builtAt : builtDate.toLocaleString('pl-PL');

  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <ShoppingBag className="h-7 w-7 text-primary" />
              <span className="font-bold font-headline text-xl">Okazje+</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Twoje zaufane źródło najlepszych okazji zakupowych w internecie.
            </p>
          </div>

          <div>
            <h3 className="font-headline font-semibold">Nawigacja</h3>
            <div className="mt-4 flex flex-col space-y-2">
              <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">Panel Admina</Link>
            </div>
          </div>

          <div>
            <h3 className="font-headline font-semibold">Informacje</h3>
            <div className="mt-4 flex flex-col space-y-2">
              <Link href="/#o-projekcie" className="text-sm text-muted-foreground hover:text-primary transition-colors">O nas</Link>
              <Link href="mailto:business@okazjeplus.pl" className="text-sm text-muted-foreground hover:text-primary transition-colors">Kontakt</Link>
              <Link href="/polityka-prywatnosci" className="text-sm text-muted-foreground hover:text-primary transition-colors">Polityka prywatności</Link>
              <Link href="/regulamin" className="text-sm text-muted-foreground hover:text-primary transition-colors">Regulamin</Link>
            </div>
          </div>
          
          <div>
      <h3 className="font-headline font-semibold">Social Media</h3>
      <div className="mt-4 flex space-x-4">
        <Link href="https://www.facebook.com/people/Okazje-Plus/61583646609859" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
          <Facebook className="h-6 w-6" />
          <span className="sr-only">Facebook</span>
        </Link>
        <Link href="https://www.instagram.com/okazje_plus/" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
          <Instagram className="h-6 w-6" />
          <span className="sr-only">Instagram</span>
        </Link>
      </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Okazje+. Wszelkie prawa zastrzeżone.
          </p>
          <p className="mt-1">
            Wersja: v{version} (commit <abbr title={buildInfo.commit}>#{commitShort}</abbr>) · Zbudowano: {builtLocal} · Runtime: {uptimeHuman}
          </p>
        </div>
      </div>
    </footer>
  );
}
