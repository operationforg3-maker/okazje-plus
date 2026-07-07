'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type ItemType = 'deal' | 'product';

interface QuickEditDialogProps {
  open: boolean;
  onClose: () => void;
  item: {
    id: string;
    title?: string | Record<string, string>;
    description?: string | Record<string, string>;
    price?: number | { amount?: number; current?: number };
    mainCategorySlug?: string;
    subCategorySlug?: string;
  };
  itemType: ItemType;
  onSuccess: () => void;
}

function getStr(val: unknown, lang = 'pl'): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const v = val as Record<string, string>;
    return v[lang] || v.en || v.de || Object.values(v)[0] || '';
  }
  return String(val);
}

function getPrice(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object' && val !== null) {
    const v = val as { amount?: number; current?: number };
    return String(v.amount ?? v.current ?? '');
  }
  return '';
}

export function QuickEditDialog({
  open, onClose, item, itemType, onSuccess,
}: QuickEditDialogProps) {
  const { getIdToken } = useAuth();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(getStr(item.title));
  const [description, setDescription] = useState(getStr(item.description));
  const [price, setPrice] = useState(getPrice(item.price));
  const [mainCategory, setMainCategory] = useState(item.mainCategorySlug || '');

  const handleSaveAndApprove = async () => {
    if (!title.trim()) {
      toast.error('Tytuł jest wymagany (min. 3 znaki)');
      return;
    }

    const token = await getIdToken();
    if (!token) return;

    setSaving(true);
    try {
      const editPayload: Record<string, unknown> = {};

      // Only send changed fields
      const originalTitle = getStr(item.title);
      if (title !== originalTitle) {
        editPayload.title = { pl: title };
        editPayload.titlePl = title;
      }

      const originalDesc = getStr(item.description);
      if (description !== originalDesc && description.trim()) {
        editPayload.description = { pl: description };
        editPayload.descriptionPl = description;
      }

      const originalPrice = getPrice(item.price);
      if (price !== originalPrice && price.trim()) {
        const parsed = parseFloat(price);
        if (!Number.isNaN(parsed)) {
          editPayload.price = parsed;
        }
      }

      if (mainCategory !== item.mainCategorySlug) {
        editPayload.mainCategorySlug = mainCategory;
      }

      const res = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          itemId: item.id,
          itemType,
          action: 'approve',
          ...(Object.keys(editPayload).length > 0 ? { editPayload } : {}),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Zapisano i zatwierdzono!');
        onClose();
        onSuccess();
      } else {
        toast.error(data.message || 'Błąd zatwierdzania');
      }
    } catch (err) {
      toast.error('Błąd połączenia');
      console.error('[QuickEdit] error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Edytuj i zatwierdź {itemType === 'deal' ? 'okazję' : 'produkt'}
          </DialogTitle>
          <DialogDescription>
            Wprowadź poprawki przed zatwierdzeniem. Puste pola nie będą zmieniane.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qe-title">Tytuł (PL)</Label>
            <Input
              id="qe-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tytuł produktu / okazji..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qe-description">Opis (PL, opcjonalny)</Label>
            <Textarea
              id="qe-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[80px] resize-none"
              placeholder="Opis..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qe-price">Cena (PLN, opcjonalna)</Label>
              <Input
                id="qe-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qe-category">Slug kategorii</Label>
              <Input
                id="qe-category"
                value={mainCategory}
                onChange={e => setMainCategory(e.target.value)}
                placeholder="np. elektronika"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Anuluj
          </Button>
          <Button onClick={handleSaveAndApprove} disabled={saving} className="gap-1.5">
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Zapisuję...</>
              : <><CheckCircle className="h-4 w-4" />Zapisz i zatwierdź</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
