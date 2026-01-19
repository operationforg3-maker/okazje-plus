"use client";

import { useState } from 'react';
import { Product } from '@/lib/types';
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
import { Loader2, Languages, Sparkles } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface ProductEditDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ProductEditDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: ProductEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [aiTranslating, setAiTranslating] = useState(false);
  const [aiEnriching, setAiEnriching] = useState(false);
  const toInputText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  };
  const toPriceString = (value: unknown): string => {
    if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
    if (typeof value === 'string') {
      const parsed = Number(value.replace?.(/[^0-9.,-]/g, '').replace(',', '.'));
      return Number.isFinite(parsed) ? parsed.toString() : '';
    }
    return '';
  };
  const [formData, setFormData] = useState({
    name: toInputText(product.name),
    description: toInputText(product.description),
    price: toPriceString(product.price),
    affiliateUrl: toInputText(product.affiliateUrl),
    status: typeof product.status === 'string' ? product.status : 'draft',
  });

  const handleAITranslate = async () => {
    setAiTranslating(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      const response = await fetch('/api/admin/products/ai-translate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 1,
          productId: product.id,
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

  const handleAIEnrich = async () => {
    setAiEnriching(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      const response = await fetch('/api/admin/products/ai-enrich', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 1,
          productId: product.id,
          force: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI enrichment failed');
      }

      const data = await response.json();
      toast.success(data.message || 'AI ubogacanie uruchomione');
    } catch (error: any) {
      toast.error(error.message || 'Błąd AI ubogacania');
    } finally {
      setAiEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price.replace(',', '.')),
          affiliateUrl: formData.affiliateUrl,
          status: formData.status,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Błąd aktualizacji produktu');
      }

      toast.success('Produkt zaktualizowany!');
      onOpenChange(false);
      onSuccess?.();
      
      // Odśwież stronę po 500ms
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      console.error('Product update error:', error);
      toast.error(error.message || 'Nie udało się zaktualizować produktu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj produkt</DialogTitle>
          <DialogDescription>
            Szybka edycja produktu #{product.id}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa produktu</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

          <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="affiliateUrl">Link afiliacyjny</Label>
            <Input
              id="affiliateUrl"
              type="url"
              value={formData.affiliateUrl}
              onChange={(e) => setFormData({ ...formData, affiliateUrl: e.target.value })}
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
                disabled={loading || aiTranslating || aiEnriching}
                className="flex-1"
              >
                {aiTranslating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="mr-2 h-4 w-4" />
                )}
                Tłumacz (AI)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAIEnrich}
                disabled={loading || aiTranslating || aiEnriching}
                className="flex-1"
              >
                {aiEnriching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Ubogać SEO (AI)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uruchom tłumaczenie lub ubogacanie SEO dla tego produktu. Wyniki pojawią się w Job Monitorze.
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
