"use client";
import { useState, useEffect, useRef } from 'react';
import { getAutocompleteSuggestions, Suggestion } from '@/lib/search';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Flame, ShoppingBag, ArrowLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { trackSearch } from '@/lib/analytics';
import { useTranslations } from 'next-intl';

export function AutocompleteSearch({ className }: { className?: string }) {
  const t = useTranslations('common');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen to custom open-mobile-search event from navbar
  useEffect(() => {
    const handleOpenMobile = () => {
      setIsMobileOverlayOpen(true);
    };
    window.addEventListener('open-mobile-search', handleOpenMobile);
    return () => window.removeEventListener('open-mobile-search', handleOpenMobile);
  }, []);

  // Lock body scroll when mobile overlay is active
  useEffect(() => {
    if (isMobileOverlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOverlayOpen]);

  // Click outside handler for desktop dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Autocomplete fetch logic
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await getAutocompleteSuggestions(query.trim(), 6);
        if (!cancelled) {
          setSuggestions(data);
          if (!isMobile) {
            setOpen(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, isMobile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      trackSearch(query.trim(), suggestions.length);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
      setIsMobileOverlayOpen(false);
    }
  };

  const handlePick = (s: Suggestion) => {
    if (s.type === 'deal') {
      router.push(`/deals/${s.id}`);
    } else {
      router.push(`/products/${s.id}`);
    }
    setOpen(false);
    setIsMobileOverlayOpen(false);
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <form onSubmit={handleSubmit} className="w-full" role="search">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (isMobile) {
                setIsMobileOverlayOpen(true);
              } else {
                setOpen(true);
              }
            }}
            placeholder={t('search.placeholder')}
            className="pl-9 pr-10"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="autocomplete-popover"
            aria-label={t('search.searchBarLabel')}
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            type="search"
            role="combobox"
            aria-haspopup="listbox"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-label={t('search.searching')} aria-live="polite" />
          )}
        </div>
      </form>

      {/* Desktop Suggestions Popover */}
      {open && !isMobile && suggestions.length > 0 && (
        <div
          id="autocomplete-popover"
          role="listbox"
          aria-label={t('search.resultsLabel')}
          className="absolute left-0 right-0 mt-1 rounded-lg border bg-popover shadow-lg z-50 p-2 space-y-1"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.type + s.id + i}
              role="option"
              onClick={() => handlePick(s)}
              className="w-full text-left rounded-sm px-3 py-2 hover:bg-muted focus:bg-muted outline-none flex flex-col transition-colors-fast"
            >
              <span className="font-medium text-sm flex items-center gap-2 text-foreground">
                {s.type === 'deal' ? (
                  <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                ) : (
                  <ShoppingBag className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="line-clamp-1">{s.label}</span>
              </span>
              {s.subLabel && (
                <span className="text-xs text-muted-foreground line-clamp-1">{s.subLabel}</span>
              )}
            </button>
          ))}
          <div className="pt-1 mt-1 border-t text-xs text-muted-foreground px-2">
            {t('search.enterToSearch')}
          </div>
        </div>
      )}

      {open && !isMobile && !loading && suggestions.length === 0 && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 rounded-md border bg-popover shadow-md z-50 p-3 text-sm text-muted-foreground">
          {t('search.noSuggestions')}
        </div>
      )}

      {/* Mobile Full-Screen Search Overlay */}
      {isMobileOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in slide-in-from-bottom duration-200">
          {/* Mobile Search Header */}
          <div className="flex items-center gap-2 p-3 border-b border-border bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0"
              onClick={() => setIsMobileOverlayOpen(false)}
              aria-label="Cofnij"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Button>
            <form onSubmit={handleSubmit} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="pl-9 pr-10 rounded-full bg-muted border-none h-10 text-base"
                  type="search"
                  autoComplete="off"
                  data-lpignore="true"
                />
                {query && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full p-0 hover:bg-transparent"
                    onClick={() => setQuery('')}
                    aria-label="Wyczyść szukanie"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Suggestions Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!loading && suggestions.length > 0 && (
              <div className="space-y-1.5" role="listbox">
                {suggestions.map((s, i) => (
                  <button
                    key={s.type + s.id + i}
                    role="option"
                    onClick={() => handlePick(s)}
                    className="w-full text-left rounded-xl p-3 hover:bg-muted active:bg-muted/80 bg-background shadow-sm outline-none flex items-center gap-3 border border-border/40 transition-all min-h-[56px] focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="bg-muted p-2 rounded-lg shrink-0">
                      {s.type === 'deal' ? (
                        <Flame className="h-5 w-5 text-orange-500" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{s.label}</p>
                      {s.subLabel && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.subLabel}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && suggestions.length === 0 && query.trim().length >= 2 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {t('search.noSuggestions')}
              </div>
            )}

            {query.trim().length < 2 && (
              <div className="text-center py-12 text-sm text-muted-foreground bg-background rounded-xl p-6 border border-border/40 shadow-sm">
                <Search className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                <p className="font-medium text-foreground">{t('search.placeholder')}</p>
                <p className="text-xs text-muted-foreground mt-1">Wpisz co najmniej 2 znaki, aby zobaczyć podpowiedzi</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
