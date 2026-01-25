import Link from 'next/link';
import { ShoppingBag, Facebook, Instagram } from 'lucide-react';
import { getUptimeMs } from '@/lib/uptime';
import { buildInfo } from '@/lib/build-info';
import { useState, useEffect } from 'react';
import { LogoSVGWrapper } from './logo-svg-wrapper';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
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
    <footer className="mt-10 border-t border-border/20 bg-background/95\">
      <div className="page-container py-10">
        <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-lg p-6\">
            <Link href="/" className="flex items-center gap-2">
              <LogoSVGWrapper className="h-10 md:h-12" />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('description')}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-foreground/70\">
              <ShoppingBag className="h-4 w-4" />
              {t('freshDealsDaily')}
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('navigation')}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <Link href="/deals" className="transition-colors hover:text-primary">{t('deals')}</Link>
              <Link href="/products" className="transition-colors hover:text-primary">{t('products')}</Link>
              <Link href="/forum" className="transition-colors hover:text-primary">{t('forum')}</Link>
              <Link href="/add-deal" className="transition-colors hover:text-primary">{t('addDeal')}</Link>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('information')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground">
              <Link href="/#o-projekcie" className="transition-colors hover:text-primary">{t('about')}</Link>
              <Link href="mailto:business@okazjeplus.pl" className="transition-colors hover:text-primary">{t('contact')}</Link>
              <Link href="/polityka-prywatnosci" className="transition-colors hover:text-primary">{t('privacy')}</Link>
              <Link href="/regulamin" className="transition-colors hover:text-primary">{t('terms')}</Link>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('social')}</h3>
            <div className="mt-4 flex gap-3">
              <Link href="https://www.facebook.com/people/Okazje-Plus/61583646609859" className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary" target="_blank" rel="noopener noreferrer">
                <Facebook className="h-5 w-5" />
                <span className="sr-only">{t('facebook')}</span>
              </Link>
              <Link href="https://www.instagram.com/okazje_plus/" className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary" target="_blank" rel="noopener noreferrer">
                <Instagram className="h-5 w-5" />
                <span className="sr-only">{t('instagram')}</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-border/50 bg-card/80 px-4 py-4 text-center text-sm text-muted-foreground shadow-inner">
          <p>
            &copy; {currentYear} Okazje+. {t('copyright')}
          </p>
          <p className="mt-1" suppressHydrationWarning>
            {t('version')} v{version} ({t('commit')} <abbr title={buildInfo.commit}>#{commitShort}</abbr>) · {t('builtAt')} {builtLocal} · {t('runtime')}: <span suppressHydrationWarning>{hydrated ? uptimeHuman : '0 min 0 s'}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
