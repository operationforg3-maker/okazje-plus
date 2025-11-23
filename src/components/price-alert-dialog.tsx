'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Loader2 } from 'lucide-react';
import { createPriceAlert } from '@/lib/price-alerts';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface PriceAlertDialogProps {
  itemId: string;
  itemType: 'deal' | 'product';
  itemTitle: string;
  currentPrice: number;
}

export function PriceAlertDialog({ itemId, itemType, itemTitle, currentPrice }: PriceAlertDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState(Math.floor(currentPrice * 0.9).toString());
  const [loading, setLoading] = useState(false);

  const handleCreateAlert = async () => {
    if (!user) {
      toast.error('Musisz być zalogowany, aby ustawić alert cenowy');
      return;
    }

    const target = parseFloat(targetPrice);
    if (isNaN(target) || target <= 0) {
      toast.error('Podaj prawidłową cenę docelową');
      return;
    }

    if (target >= currentPrice) {
      toast.error('Cena docelowa musi być niższa niż aktualna');
      return;
    }

    setLoading(true);
    try {
      await createPriceAlert(user.uid, itemId, itemType, itemTitle, currentPrice, target);
      toast.success('Alert cenowy został utworzony! Powiadomimy Cię, gdy cena spadnie.');
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Nie udało się utworzyć alertu');
    } finally {
      setLoading(false);
    }
  };

  const discount = currentPrice > 0 ? Math.round(((currentPrice - parseFloat(targetPrice || '0')) / currentPrice) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-2" />
          Alert cenowy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ustaw alert spadku ceny</DialogTitle>
          <DialogDescription>
            Powiadomimy Cię mailem, gdy cena spadnie do Twojego poziomu docelowego
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Produkt</Label>
            <p className="text-sm text-muted-foreground line-clamp-2">{itemTitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Aktualna cena</Label>
              <div className="text-2xl font-bold">{currentPrice.toFixed(2)} zł</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Cena docelowa</Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          {discount > 0 && (
            <div className="rounded-lg bg-primary/10 p-3 text-sm">
              <p className="font-medium">To będzie {discount}% zniżki! 🎉</p>
              <p className="text-muted-foreground mt-1">
                Oszczędzisz {(currentPrice - parseFloat(targetPrice || '0')).toFixed(2)} zł
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
            Anuluj
          </Button>
          <Button onClick={handleCreateAlert} disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Tworzenie...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Utwórz alert
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
