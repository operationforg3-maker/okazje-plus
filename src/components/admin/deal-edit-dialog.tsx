"use client";

import { useState } from 'react';
import { Deal } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Languages } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface DealEditDialogProps {
  deal: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function DealEditDialog({
  deal,
  open,
  onOpenChange,
  onSuccess,
}: DealEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [aiTranslating, setAiTranslating] = useState(false);
  const [formData, setFormData] = useState({
    title: deal.title,
    description: deal.description,
    price: deal.price.toString(),
    originalPrice: deal.originalPrice?.toString() || '',
    link: deal.link,
    status: deal.status || 'approved',
  });

  const handleAITranslate = async () => {
    setAiTranslating(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      const response = await fetch('/api/admin/deals/ai-translate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 1,
          dealId: deal.id,
          force: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI translation failed');
      }

      const data = await response.json();
      toast.success(data.message || 'AI tłumaczenie uruchomione');
    } catch (error: any) {
      toast.error(error.message || 'Błąd AI tłumaczenia');
    } finally {
      setAiTranslating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
          link: formData.link,
          status: formData.status,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Błąd aktualizacji okazji');
      }

      toast.success('Okazja zaktualizowana!');
      onOpenChange(false);
      onSuccess?.();
      
      // Odśwież stronę po 500ms
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      console.error('Deal update error:', error);
      toast.error(error.message || 'Nie udało się zaktualizować okazji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj okazję</DialogTitle>
          <DialogDescription>
            Szybka edycja okazji #{deal.id}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tytuł okazji</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Cena (PLN)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="originalPrice">Cena oryginalna</Label>
              <Input
                id="originalPrice"
                type="number"
                step="0.01"
                value={formData.originalPrice}
                onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                placeholder="Opcjonalnie"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">Link do okazji</Label>
            <Input
              id="link"
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              required
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold">🤖 AI Actions</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAITranslate}
                disabled={loading || aiTranslating}
                className="flex-1"
              >
                {aiTranslating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="mr-2 h-4 w-4" />
                )}
                Tłumacz (AI)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uruchom tłumaczenie dla tej okazji. Wynik pojawi się w Job Monitorze.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Zapisz zmiany
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
