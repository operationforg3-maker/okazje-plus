'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { withImageProxy } from '@/lib/image-proxy';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

interface BulkResult {
  processed: number;
  total: number;
  failures?: Array<{ id: string; type: string; error?: string }>;
  status?: string;
  message?: string;
  success?: boolean;
}

interface BulkModerationBarProps {
  type: 'deal' | 'product';
  items: any[];
  onAction: () => Promise<void>;
}

export function BulkModerationBar({ type, items, onAction }: BulkModerationBarProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [loadingAllItems, setLoadingAllItems] = useState(false);
  const [totalItemsInDb, setTotalItemsInDb] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<BulkResult | null>(null);
  const { toast } = useToast();

  const toggle = (id: string) => setSelected(p => ({ ...p, [id]: !p[id] }));
  const clear = () => setSelected({});
  const selectAll = () => {
    const all: Record<string, boolean> = {};
    items.forEach(item => all[item.id] = true);
    setSelected(all);
  };
  
  const selectAllInDatabase = async () => {
    try {
      setLoadingAllItems(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
        return;
      }
      const token = await currentUser.getIdToken();
      
      const res = await fetch(`/api/admin/moderation/get-all-ids?type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Nie udało się pobrać wszystkich ID');
      
      const data = await res.json();
      const allIds: Record<string, boolean> = {};
      data.ids.forEach((id: string) => allIds[id] = true);
      setSelected(allIds);
      setTotalItemsInDb(data.total);
      
      toast({ 
        title: 'Zaznaczono wszystkie', 
        description: `Zaznaczono ${data.total} ${type === 'deal' ? 'okazji' : 'produktów'} z bazy danych` 
      });
    } catch (error: any) {
      toast({ title: 'Błąd', description: error.message || 'Nie udało się pobrać wszystkich itemów', variant: 'destructive' });
    } finally {
      setLoadingAllItems(false);
    }
  };
  
  const allSelectedIds = Object.entries(selected).filter(([, v]) => v).map(([id]) => id);
  const progressPercent = allSelectedIds.length > 0 ? Math.round((processingProgress / allSelectedIds.length) * 100) : 0;

  async function bulk(action: 'approve' | 'reject' | 'delete' | 'change-status', status?: string) {
    if (allSelectedIds.length === 0) {
      toast({ title: 'Błąd', description: 'Nie zaznaczono żadnych elementów', variant: 'destructive' });
      return;
    }

    const confirmed = action === 'delete' 
      ? window.confirm(`Czy na pewno chcesz usunąć ${allSelectedIds.length} elementów?`)
      : true;

    if (!confirmed) return;

    setProcessing(true);
    setProcessingProgress(0);
    setLastResult(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      const token = await currentUser.getIdToken();

      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 1, allSelectedIds.length - 1));
      }, 100);

      const res = await fetch('/api/admin/moderation/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          items: allSelectedIds.map(id => ({ id, type })), 
          action,
          ...(status && { status })
        })
      });
      
      clearInterval(progressInterval);
      setProcessingProgress(allSelectedIds.length);

      const data: BulkResult = await res.json();
      setLastResult(data);

      if (res.ok && data.success) {
        const hasFailures = data.failures && data.failures.length > 0;
        const failureText = hasFailures ? ` (${data.failures.length} błędów)` : '';
        
        toast({ 
          title: hasFailures ? 'Częściowy sukces' : 'Sukces', 
          description: `Przetworzono ${data.processed}/${data.total} elementów${failureText}`,
          duration: 7000,
        });

        clear();
        setTotalItemsInDb(null);
        await onAction();
      } else {
        toast({ 
          title: 'Błąd', 
          description: data.message || 'Przetwarzanie nie powiodło się',
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      toast({ 
        title: 'Błąd sieciowy', 
        description: error.message || 'Nie udało się przetworzyć akcji',
        variant: 'destructive' 
      });
    } finally {
      setProcessing(false);
      setProcessingProgress(0);
    }
  }

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/30">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          Zbiorcza moderacja: {type === 'deal' ? 'Okazje' : 'Produkty'} 
          <Badge variant="secondary" className="ml-2">{allSelectedIds.length} zaznaczonych</Badge>
          {totalItemsInDb && totalItemsInDb > items.length && (
            <Badge variant="outline" className="ml-1 text-xs">z {totalItemsInDb} w bazie</Badge>
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={selectAll} disabled={processing || items.length === 0}>
            Zaznacz widoczne ({items.length})
          </Button>
          <Button 
            size="sm" 
            variant="default" 
            onClick={selectAllInDatabase} 
            disabled={loadingAllItems || processing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loadingAllItems ? 'Ładowanie...' : '🌐 Zaznacz wszystkie w bazie'}
          </Button>
          <Button size="sm" variant="outline" onClick={clear} disabled={processing || allSelectedIds.length === 0}>
            Wyczyść
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => bulk('approve')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Zatwierdź ({allSelectedIds.length})
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => bulk('reject')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Odrzuć ({allSelectedIds.length})
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => bulk('change-status', 'draft')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          Zmień na Draft
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => bulk('change-status', 'pending')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          Zmień na Pending
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="bg-red-950 text-red-50 hover:bg-red-900"
          onClick={() => bulk('delete')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          🗑️ Usuń ({allSelectedIds.length})
        </Button>
      </div>

      {processing && (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span>Przetwarzanie...</span>
            <span className="text-slate-600">{processingProgress}/{allSelectedIds.length}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {lastResult?.failures && lastResult.failures.length > 0 && !processing && (
        <div className="border border-red-300 bg-red-50 rounded-md p-2 text-sm">
          <div className="font-semibold text-red-800 mb-1">
            🚨 {lastResult.failures.length} błędów podczas przetwarzania:
          </div>
          <details className="cursor-pointer group">
            <summary className="text-red-700 hover:text-red-900 font-medium">
              Pokaż szczegóły ({lastResult.failures.length})
            </summary>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {lastResult.failures.map((fail, idx) => (
                <div key={idx} className="text-xs text-red-800 font-mono bg-white/50 p-1 rounded border border-red-200">
                  <strong>{fail.id}</strong> ({fail.type}): {fail.error || 'Nieznany błąd'}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <div className="flex gap-1 flex-wrap max-h-32 overflow-y-auto">
        {items.map(item => {
          let titleText = 'Unknown item';
          if (item.title) {
            if (typeof item.title === 'string') {
               titleText = item.title;
            } else if (typeof item.title === 'object') {
               titleText = (item.title as any).pl || (item.title as any).en || 'Localized Title';
            } else {
               titleText = String(item.title);
            }
          } else if (item.name) {
            titleText = typeof item.name === 'string' ? item.name : JSON.stringify(item.name);
          }
          const displayName = titleText.substring(0, 30);
          const bgClass = selected[item.id] 
             ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-sm' 
             : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200';
          const imageSrc = item.images?.[0] || item.image;

          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={cn(
                "group flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border transition-all duration-200", 
                bgClass
              )}
              title={titleText}
            >
              {selected[item.id] ? <CheckCircle className="w-3.5 h-3.5 text-blue-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 group-hover:border-slate-400" />}
              
              {imageSrc && (
                <div className="w-6 h-6 rounded bg-slate-100 border overflow-hidden shrink-0">
                   <img src={withImageProxy(imageSrc)} className="w-full h-full object-cover" alt="" />
                </div>
              )}
              
              <span className="truncate max-w-[150px] font-medium leading-none">{displayName}...</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
