'use client';

/**
 * Exchange Rate Alert Component
 * 
 * Displays a red warning badge in Admin Header if exchange rates are outdated (>24h)
 * Fetches last update time from Firestore settings
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

export function ExchangeRateAlert() {
  const [isOutdated, setIsOutdated] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkExchangeRates();
    const interval = setInterval(checkExchangeRates, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const checkExchangeRates = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'admin', 'settings'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        const lastUpdateTime = data.exchangeRatesUpdatedAt;
        
        if (lastUpdateTime) {
          const lastUpdateDate = lastUpdateTime.toDate();
          const now = new Date();
          const diffHours = (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60);
          
          setIsOutdated(diffHours > 24);
          setLastUpdated(lastUpdateDate.toLocaleString('pl-PL'));
        } else {
          setIsOutdated(true);
          setLastUpdated(null);
        }
      }
    } catch (error) {
      console.error('Failed to check exchange rates:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/exchange-rates/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        await updateDoc(doc(db, 'admin', 'settings'), {
          exchangeRatesUpdatedAt: Timestamp.now(),
          exchangeRates: data.rates
        });
        
        setIsOutdated(false);
        setLastUpdated(new Date().toLocaleString('pl-PL'));
        toast.success('Kursy walut zaktualizowane');
      } else {
        throw new Error('Failed to refresh rates');
      }
    } catch (error) {
      console.error('Failed to refresh exchange rates:', error);
      toast.error('Nie udało się odświeżyć kursów');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isOutdated) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              Kursy zaniedbane
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Odśwież
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Ostatnia aktualizacja: {lastUpdated || 'Nigdy'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
