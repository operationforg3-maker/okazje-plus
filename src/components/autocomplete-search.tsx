"use client";
import { useState, useEffect, useRef } from 'react';
import { getAutocompleteSuggestions, Suggestion } from '@/lib/search';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Flame, ShoppingBag } from 'lucide-react';
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
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

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
          setOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Track search w Google Analytics
      trackSearch(query.trim(), suggestions.length);
      
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  };

  const handlePick = (s: Suggestion) => {
    if (s.type === 'deal') {
      router.push(`/deals/${s.id}`);
    } else {
      router.push(`/products/${s.id}`);
    }
    setOpen(false);
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <form onSubmit={handleSubmit} className="w-full" role="search">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
      {open && suggestions.length > 0 && (
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
              <span className="font-medium text-sm flex items-center space-sm">
                {s.type === 'deal' ? (
                  <><Flame className="h-4 w-4 text-orange-500" /> {t('labels.deal')}</>
                ) : (
                  <><ShoppingBag className="h-4 w-4 text-primary" /> {t('labels.product')}</>
                )}
                {s.label}
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
      {open && !loading && suggestions.length === 0 && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 rounded-md border bg-popover shadow-md z-50 p-3 text-sm text-muted-foreground">
          {t('search.noSuggestions')}
        </div>
      )}
    </div>
  );
}
