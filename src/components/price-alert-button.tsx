'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createPriceAlert, getUserPriceAlerts, cancelPriceAlert } from '@/lib/price-monitoring';
import { PriceAlert } from '@/lib/types';
import { toast } from 'sonner';

interface PriceAlertButtonProps {
  itemId: string;
  itemType: 'product' | 'deal';
  currentPrice: number;
  itemName?: string;
  itemImage?: string;
}

export function PriceAlertButton({
  itemId,
  itemType,
  currentPrice,
  itemName,
  itemImage,
}: PriceAlertButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [alertType, setAlertType] = useState<'price_drop' | 'target_price'>('price_drop');
  const [targetPrice, setTargetPrice] = useState('');
  const [dropPercentage, setDropPercentage] = useState('10');
  const [existingAlert, setExistingAlert] = useState<PriceAlert | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkExistingAlert();
    }
  }, [user, itemId]);

  const checkExistingAlert = async () => {
    if (!user) return;
    try {
      const alerts = await getUserPriceAlerts(user.uid);
      const existing = alerts.find((alert) => alert.itemId === itemId && alert.status === 'active');
      setExistingAlert(existing || null);
    } catch (error) {
      console.error('Error checking existing alert:', error);
    }
  };

  const handleCreateAlert = async () => {
    if (!user) {
      toast.error('Musisz być zalogowany, aby ustawić alert cenowy');
      return;
    }

    setLoading(true);
    try {
      const options: any = {
        metadata: {
          itemName,
          itemImage,
          currentPrice,
        },
      };

      if (alertType === 'target_price') {
        const target = parseFloat(targetPrice);
        if (isNaN(target) || target <= 0) {
          toast.error('Podaj prawidłową cenę docelową');
          setLoading(false);
          return;
        }
        options.targetPrice = target;
      } else {
        const drop = parseFloat(dropPercentage);
        if (isNaN(drop) || drop <= 0 || drop > 100) {
          toast.error('Podaj prawidłowy procent obniżki (1-100%)');
          setLoading(false);
          return;
        }
        options.dropPercentage = drop;
      }

      await createPriceAlert(user.uid, itemId, itemType, alertType, options);
      toast.success('Alert cenowy został utworzony!');
      setOpen(false);
      await checkExistingAlert();
    } catch (error) {
      console.error('Error creating alert:', error);
      toast.error('Nie udało się utworzyć alertu cenowego');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAlert = async () => {
    if (!existingAlert) return;

    setLoading(true);
    try {
      await cancelPriceAlert(existingAlert.id);
      toast.success('Alert cenowy został anulowany');
      setExistingAlert(null);
      setOpen(false);
    } catch (error) {
      console.error('Error canceling alert:', error);
      toast.error('Nie udało się anulować alertu');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Bell className="h-4 w-4 mr-2" />
        Zaloguj się dla alertów
      </Button>
    );
  }

  if (existingAlert) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-green-600">
            <Check className="h-4 w-4 mr-2" />
            Alert aktywny
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alert cenowy aktywny</DialogTitle>
            <DialogDescription>
              Masz aktywny alert dla tego produktu. Otrzymasz powiadomienie, gdy warunki zostaną
              spełnione.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold">Typ alertu: </span>
                {existingAlert.alertType === 'target_price'
                  ? 'Cena docelowa'
                  : 'Obniżka ceny'}
              </p>
              {existingAlert.targetPrice && (
                <p className="text-sm">
                  <span className="font-semibold">Cena docelowa: </span>
                  {existingAlert.targetPrice.toFixed(2)} PLN
                </p>
              )}
              {existingAlert.dropPercentage && (
                <p className="text-sm">
                  <span className="font-semibold">Obniżka o: </span>
                  {existingAlert.dropPercentage}%
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Utworzono: {new Date(existingAlert.createdAt).toLocaleDateString('pl-PL')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Zamknij
            </Button>
            <Button variant="destructive" onClick={handleCancelAlert} disabled={loading}>
              Anuluj alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-2" />
          Ustaw alert cenowy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Utwórz alert cenowy</DialogTitle>
          <DialogDescription>
            Otrzymaj powiadomienie, gdy cena spadnie do określonego poziomu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="alertType">Typ alertu</Label>
            <Select value={alertType} onValueChange={(value: any) => setAlertType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_drop">Obniżka ceny o %</SelectItem>
                <SelectItem value="target_price">Cena docelowa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertType === 'target_price' ? (
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Cena docelowa (PLN)</Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                placeholder={`Mniej niż ${currentPrice.toFixed(2)}`}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Aktualna cena: {currentPrice.toFixed(2)} PLN
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="dropPercentage">Obniżka o (%)</Label>
              <Select value={dropPercentage} onValueChange={setDropPercentage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="15">15%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="30">30%</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Alert gdy cena spadnie o co najmniej {dropPercentage}%
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
          <Button onClick={handleCreateAlert} disabled={loading}>
            Utwórz alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
