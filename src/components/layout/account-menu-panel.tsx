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
import { useUX } from '@/context/UXContext';

interface AccountMenuPanelProps {
  user: User | null;
  loading?: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
  unreadCount?: number;
}

export function AccountMenuPanel({ user, loading, onLogout, onNavigate, unreadCount = 0 }: AccountMenuPanelProps) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
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
  
  const pathnameWithoutLocale = pathname.replace(/^\/(pl|en|de|fr|es|uk|it)(\/|$)/, '/');
  const basePath = pathnameWithoutLocale || '/';
  const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['pl', 'en', 'de', 'fr', 'es', 'uk', 'it'];
  
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

  // Theme and UX settings from global context
  const { themeFamily, setThemeFamily, themeMode, toggleThemeMode } = useUX();

  const cycleThemeFamily = () => {
    const families: ('classic' | 'v4' | 'v5' | 'neon')[] = ['classic', 'v4', 'v5', 'neon'];
    const nextIdx = (families.indexOf(themeFamily) + 1) % families.length;
    setThemeFamily(families[nextIdx]);
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
                <AvatarImage src={user.photoURL} alt={user.displayName ?? tCommon('labels.user')} />
              ) : null}
              <AvatarFallback>
                {typeof user.displayName === 'string' ? user.displayName.charAt(0).toUpperCase() : 
                 typeof user.email === 'string' ? user.email.charAt(0).toUpperCase() : tCommon('labels.user').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">
                {typeof user.displayName === 'string' ? user.displayName : tCommon('labels.user')}
              </p>
              {typeof user.email === 'string' ? (
                <p className="text-xs text-muted-foreground line-clamp-1">{user.email}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Link href={`/${locale}/profile`} onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> {t('profile')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href={`/${locale}/profile?tab=favorites`} onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> {t('favorites')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href={`/${locale}/profile?tab=notifications`} onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t('notifications')}</span>
              <span className="flex items-center gap-2">
                {unreadCount > 0 ? (
                  <Badge variant="destructive" className="h-5 rounded-full px-1.5 text-[10px]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                ) : null}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </span>
            </Link>
            <Link href={`/${locale}/profile/settings`} onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> {t('settings')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {typeof user.role === 'string' && user.role === "admin" ? (
              <Link href={`/${locale}/admin`} onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
                <span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> {t('admin')}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ) : null}
            
            <button type="button" onClick={() => { onLogout(); onNavigate?.(); }} className="flex w-full items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-destructive/60 hover:text-destructive">
              <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> {t('logout')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          <p className="text-sm font-semibold text-foreground">
            {t('login')}
          </p>
          <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full" onClick={onNavigate}>
            <Link href={`/${locale}/login`} className="flex items-center justify-center gap-2 font-medium">
              <UserIcon className="h-4 w-4" />
              {t('login')}
            </Link>
          </Button>
        </div>
      )}

      {/* Separator */}
      <div className="my-3 h-px bg-border/40" />

      {/* Language, Currency, Theme - Switch/Toggle Buttons */}
      <div className="flex items-center gap-2 justify-start">
        {/* Language Switch (literowy kod) */}
        {isMountedLang && (
          <IntlLink
            href={basePath}
            locale={SUPPORTED_LANGUAGES[(SUPPORTED_LANGUAGES.indexOf(locale) + 1) % SUPPORTED_LANGUAGES.length]}
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
            aria-label={t('changeLanguage')}
          >
            {locale}
          </IntlLink>
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
            aria-label={t('changeCurrency')}
          >
            {currency}
          </button>
        )}

        {/* Theme Family Switch */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            cycleThemeFamily();
          }}
          className={cn(
            "h-9 px-3 rounded-full flex items-center justify-center text-xs font-semibold transition-all border hover:shadow-md uppercase",
            "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
          )}
          title="Zmień motyw graficzny"
          aria-label="Zmień motyw graficzny"
        >
          🧩 {themeFamily}
        </button>

        {/* Theme Mode Switch (Sun/Moon) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleThemeMode();
          }}
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center transition-all border hover:shadow-md",
            "bg-background/70 border-border/40 hover:border-primary/60 text-foreground"
          )}
          title={t('changeTheme')}
          aria-label={t('changeTheme')}
        >
          {themeMode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
