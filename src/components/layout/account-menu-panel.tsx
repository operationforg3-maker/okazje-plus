"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard, LogOut, Settings, User as UserIcon, Heart, Bell, Globe, Coins, Moon, Sun, Check } from "lucide-react";
import { User } from "@/lib/types";
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Link as IntlLink } from '@/i18n/routing';
import { getLanguageLabel, getLanguageFlag } from '@/hooks/use-content-language';
import { SupportedLanguage } from '@/lib/i18n-content';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface AccountMenuPanelProps {
  user: User | null;
  loading?: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}

export function AccountMenuPanel({ user, loading, onLogout, onNavigate }: AccountMenuPanelProps) {
  const t = useTranslations('nav');
  const router = useRouter();
  
  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    console.log('[AccountMenuPanel] Rendering with user:', user?.email, 'loading:', loading);
  }
  
  // Language switching
  const [isMountedLang, setIsMountedLang] = useState(false);
  const locale = useLocale() as SupportedLanguage;
  const pathname = usePathname();
  
  useEffect(() => {
    setIsMountedLang(true);
  }, []);
  
  const pathnameWithoutLocale = pathname.replace(/^\/(pl|en|de)(\/|$)/, '/');
  const basePath = pathnameWithoutLocale || '/';
  const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['pl', 'en', 'de'];
  
  const switchLanguage = () => {
    const currentIdx = SUPPORTED_LANGUAGES.indexOf(locale);
    const nextLocale = SUPPORTED_LANGUAGES[(currentIdx + 1) % SUPPORTED_LANGUAGES.length];
    // Use window.location to prevent dropdown closing animation
    window.location.href = `/${nextLocale}${basePath}`;
  };

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
    console.log('[Currency] Switch to:', newCurrency);
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
  
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm w-72">
        <div className="space-y-3">
          <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
          <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

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
              <span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> {t('profile')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile?tab=favorites" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> {t('favorites')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile?tab=notifications" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t('notifications')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile/settings" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> {t('settings')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {typeof user.role === 'string' && user.role === "admin" ? (
              <Link href="/admin" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
                <span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> {t('admin')}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ) : null}
            
            <button type="button" onClick={() => { onLogout(); onNavigate?.(); }} className="flex w-full items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-destructive/60 hover:text-destructive">
              <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> {t('logout')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Separator */}
            <div className="my-2 h-px bg-border/40" />

            {/* Language, Currency, Theme - Switch/Toggle Buttons */}
            <div className="flex items-center gap-2 justify-start">
              {/* Language Switch (literowy kod) */}
              {isMountedLang && (
                <Link
                  href={`/${SUPPORTED_LANGUAGES[(SUPPORTED_LANGUAGES.indexOf(locale) + 1) % SUPPORTED_LANGUAGES.length]}${basePath}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Keep dropdown open after language change by setting sessionStorage flag
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('keepDropdownOpen', 'true');
                    }
                  }}
                  className={cn(
                    "h-9 px-3 rounded-full flex items-center justify-center text-xs font-bold uppercase transition-all border hover:shadow-md",
                    "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
                  )}
                  title={t('changeLanguage')}
                >
                  {locale}
                </Link>
              )}

              {/* Currency Switch (kod waluty) */}
              {isMountedCurr && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIdx = SUPPORTED_CURRENCIES.findIndex(c => c.code === currency);
                    const nextCurr = SUPPORTED_CURRENCIES[(currentIdx + 1) % SUPPORTED_CURRENCIES.length];
                    switchCurrency(nextCurr.code);
                  }}
                  className={cn(
                    "h-9 px-3 rounded-full flex items-center justify-center text-xs font-semibold transition-all border hover:shadow-md",
                    "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
                  )}
                  title={t('changeCurrency')}
                >
                  {currency}
                </button>
              )}

              {/* Theme Switch (ikona) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  cycleTheme();
                }}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center transition-all border hover:shadow-md",
                  "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
                )}
                title={t('changeTheme')}
              >
                {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('login')}
          </p>
          <Button asChild className="w-full" onClick={onNavigate}>
            <Link href="/login" className="flex items-center justify-center gap-2">
              <UserIcon className="h-4 w-4" />
              {t('login')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
