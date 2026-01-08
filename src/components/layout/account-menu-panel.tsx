"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard, LogOut, Settings, User as UserIcon, Heart, Bell, Globe, Coins, Moon, Sun, Check } from "lucide-react";
import { User } from "@/lib/types";
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link as IntlLink } from '@/i18n/routing';
import { getLanguageLabel, getLanguageFlag } from '@/hooks/use-content-language';
import { SupportedLanguage } from '@/lib/i18n-content';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AccountMenuPanelProps {
  user: User | null;
  loading?: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}

export function AccountMenuPanel({ user, loading, onLogout, onNavigate }: AccountMenuPanelProps) {
  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    console.log('[AccountMenuPanel] Rendering with user:', user?.email, 'loading:', loading);
  }
  
  // Track hydration
  const [mounted, setMounted] = useState(false);
  
  // Language switching
  const [isMountedLang, setIsMountedLang] = useState(false);
  const locale = useLocale() as SupportedLanguage;
  const pathname = usePathname();
  
  useEffect(() => {
    setMounted(true);
    setIsMountedLang(true);
  }, []);
  
  const pathnameWithoutLocale = pathname.replace(/^\/(pl|en|de)(\/|$)/, '/');
  const basePath = pathnameWithoutLocale || '/';
  const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['pl', 'en', 'de'];

  // Currency switching
  const [isMountedCurr, setIsMountedCurr] = useState(false);
  const [currency, setCurrency] = useState('PLN');
  
  useEffect(() => {
    setIsMountedCurr(true);
    if (typeof window !== 'undefined') {
      const savedCurrency = localStorage.getItem('preferredCurrency') || 'PLN';
      setCurrency(savedCurrency);
    }
  }, []);

  const switchCurrency = (newCurrency: string) => {
    setCurrency(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredCurrency', newCurrency);
      window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: newCurrency } }));
    }
  };

  // Theme switching
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('okp_theme') as 'light' | 'dark' | null;
      const initial: 'light' | 'dark' = stored === 'light' || stored === 'dark' ? stored : 'dark';
      setTheme(initial);
    }
  }, []);

  const cycleTheme = () => {
    const next: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('okp_theme', next);
      const isDark = next === 'dark';
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    }
  };
  
  const SUPPORTED_CURRENCIES = [
    { code: 'PLN', symbol: 'zł', name: 'Polski złoty', flag: '🇵🇱' },
    { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
    { code: 'USD', symbol: '$', name: 'Dolar amerykański', flag: '🇺🇸' },
    { code: 'GBP', symbol: '£', name: 'Funt brytyjski', flag: '🇬🇧' },
  ] as const;
  
  // Note: Don't render loading skeleton conditionally before hydration
  // Server and client must render same initial HTML to avoid hydration mismatch
  // After mounted=true, React #418 won't trigger even if we show loader in reality

  return (
    <div className="rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm w-72">
      {user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {user.photoURL && typeof user.photoURL === 'string' ? (
                <AvatarImage src={user.photoURL} alt={user.displayName ?? "Użytkownik"} />
              ) : null}
              <AvatarFallback>
                {typeof user.displayName === 'string' ? user.displayName.charAt(0).toUpperCase() : 
                 typeof user.email === 'string' ? user.email.charAt(0).toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">
                {typeof user.displayName === 'string' ? user.displayName : "Użytkownik"}
              </p>
              {typeof user.email === 'string' ? (
                <p className="text-xs text-muted-foreground line-clamp-1">{user.email}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Link href="/profile" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Profil</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile?tab=favorites" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Ulubione</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile?tab=notifications" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Powiadomienia</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile/settings" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Ustawienia</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {typeof user.role === 'string' && user.role === "admin" ? (
              <Link href="/admin" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
                <span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Panel admina</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ) : null}
            
            <button type="button" onClick={() => { onLogout(); onNavigate?.(); }} className="flex w-full items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-destructive/60 hover:text-destructive">
              <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> Wyloguj się</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Separator */}
            <div className="my-2 h-px bg-border/40" />

            {/* Language, Currency, Theme - Toggle Switchers */}
            <div className="flex items-center gap-2 justify-start">
              {/* Language Switch */}
              {isMountedLang && (
                <IntlLink
                  href={basePath}
                  locale={SUPPORTED_LANGUAGES[(SUPPORTED_LANGUAGES.indexOf(locale) + 1) % SUPPORTED_LANGUAGES.length]}
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium transition-all border hover:shadow-md",
                    "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
                  )}
                  title={`Zmień język na ${getLanguageLabel(SUPPORTED_LANGUAGES[(SUPPORTED_LANGUAGES.indexOf(locale) + 1) % SUPPORTED_LANGUAGES.length])}`}
                >
                  {getLanguageFlag(locale)}
                </IntlLink>
              )}

              {/* Currency Switch */}
              {isMountedCurr && (
                <button
                  onClick={() => {
                    const currentIdx = SUPPORTED_CURRENCIES.findIndex(c => c.code === currency);
                    const nextCurr = SUPPORTED_CURRENCIES[(currentIdx + 1) % SUPPORTED_CURRENCIES.length];
                    switchCurrency(nextCurr.code);
                  }}
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium transition-all border hover:shadow-md",
                    "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
                  )}
                  title={`Zmień walutę na ${SUPPORTED_CURRENCIES[(SUPPORTED_CURRENCIES.findIndex(c => c.code === currency) + 1) % SUPPORTED_CURRENCIES.length].name}`}
                >
                  <Coins className="h-4 w-4" />
                </button>
              )}

              {/* Theme Switch */}
              <button
                onClick={cycleTheme}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center transition-all border hover:shadow-md",
                  "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
                )}
                title={`Zmień na ${theme === 'light' ? 'ciemny' : 'jasny'} tryb`}
              >
                {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Zaloguj się, aby zapisywać okazje i śledzić ulubione kategorie.
          </p>
          <Button asChild className="w-full" onClick={onNavigate}>
            <Link href="/login" className="flex items-center justify-center gap-2">
              <UserIcon className="h-4 w-4" />
              Zaloguj się
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
