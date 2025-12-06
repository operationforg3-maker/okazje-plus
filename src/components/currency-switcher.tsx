'use client';

/**
 * Currency Switcher Component
 * 
 * Allows users to switch between supported currencies
 * Currently only PLN is active, other currencies are disabled
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Coins, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SUPPORTED_CURRENCIES = [
  { code: 'PLN', symbol: 'zł', name: 'Polski złoty', flag: '🇵🇱', enabled: true },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', enabled: true },
  { code: 'USD', symbol: '$', name: 'Dolar amerykański', flag: '🇺🇸', enabled: true },
  { code: 'GBP', symbol: '£', name: 'Funt brytyjski', flag: '🇬🇧', enabled: true },
] as const;

export function CurrencySwitcher() {
  const [isMounted, setIsMounted] = useState(false);
  const [currency, setCurrency] = useState('PLN');

  // Load currency from localStorage on mount
  useEffect(() => {
    const savedCurrency = localStorage.getItem('preferredCurrency') || 'PLN';
    setCurrency(savedCurrency);
    setIsMounted(true);
  }, []);

  const switchCurrency = (newCurrency: string, enabled: boolean) => {
    if (!enabled) return;
    
    setCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
    
    // Show toast notification
    const currencyName = SUPPORTED_CURRENCIES.find(c => c.code === newCurrency)?.name || newCurrency;
    toast.success(`Waluta zmieniona na ${currencyName}`);
    
    // Dispatch custom event for components to react to currency change
    window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: newCurrency } }));
  };

  // Don't render dropdown content until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Coins className="h-4 w-4 md:h-5 md:w-5" />
        <span className="sr-only">Waluta</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Coins className="h-4 w-4 md:h-5 md:w-5" />
          <span className="sr-only">Wybierz walutę</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {SUPPORTED_CURRENCIES.map((curr) => (
          <DropdownMenuItem
            key={curr.code}
            onClick={() => switchCurrency(curr.code, curr.enabled)}
            disabled={!curr.enabled}
            className={cn(
              "gap-2",
              curr.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            )}
          >
            <span className="text-xl">{curr.flag}</span>
            <div className="flex-1 flex flex-col">
              <span className="font-medium">{curr.code}</span>
              <span className="text-xs text-muted-foreground">{curr.name}</span>
            </div>
            {currency === curr.code && curr.enabled && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
