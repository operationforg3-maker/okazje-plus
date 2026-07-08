'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

type ItemType = 'deal' | 'product';

interface QuickEditDialogProps {
  open: boolean;
  onClose: () => void;
  item: any;
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

function getNumStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object' && val !== null) {
    const v = val as { amount?: number; current?: number };
    return String(v.amount ?? v.current ?? '');
  }
  return String(val);
}

export function QuickEditDialog({
  open, onClose, item, itemType, onSuccess,
}: QuickEditDialogProps) {
  const { getIdToken } = useAuth();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [mainImage, setMainImage] = useState('');

  // Source URL
  const sourceUrl = item?.sourceUrl || item?.affiliateUrl || item?.url || (item?.sourceLinks?.[0]?.url);

  // Initialize state when modal opens
  useEffect(() => {
    if (open && item) {
      setTitle(getStr(item.title || item.name));
      setDescription(getStr(item.description || item.fullDescription || item.shortDescription));
      setPrice(getNumStr(item.price || item.bestPrice?.amount));
      setMainCategory(item.mainCategorySlug || '');
      
      const shipCost = item.shippingCost || item.shippingInfo?.shippingCost;
      setShippingCost(getNumStr(shipCost));
      setIsFreeShipping(Boolean(item.freeShipping || item.shippingInfo?.freeShipping || Number(shipCost) === 0));
      
      const img = item.mainImage || item.image || item.imageUrl || (item.images?.[0]) || '';
      setMainImage(img);
    }
  }, [open, item]);

  const clearHtml = () => {
    const stripped = description.replace(/<[^>]*>?/gm, '');
    setDescription(stripped);
    toast.success('Usunięto tagi HTML z opisu');
  };

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

      const originalTitle = getStr(item.title || item.name);
      if (title !== originalTitle) {
        editPayload.title = { pl: title };
        if (itemType === 'deal') editPayload.titlePl = title;
      }

      const originalDesc = getStr(item.description || item.fullDescription || item.shortDescription);
      if (description !== originalDesc) {
        editPayload.description = { pl: description };
        if (itemType === 'deal') editPayload.descriptionPl = description;
      }

      const originalPrice = getNumStr(item.price || item.bestPrice?.amount);
      if (price !== originalPrice && price.trim()) {
        const parsed = parseFloat(price);
        if (!Number.isNaN(parsed)) editPayload.price = parsed;
      }

      if (mainCategory !== item.mainCategorySlug) {
        editPayload.mainCategorySlug = mainCategory;
      }

      const originalShip = getNumStr(item.shippingCost);
      if (shippingCost !== originalShip && shippingCost.trim()) {
         const parsedShip = parseFloat(shippingCost);
         if (!Number.isNaN(parsedShip)) editPayload.shippingCost = parsedShip;
      }

      const originalFreeShip = Boolean(item.freeShipping || item.shippingInfo?.freeShipping || Number(item.shippingCost) === 0);
      if (isFreeShipping !== originalFreeShip) {
         editPayload.freeShipping = isFreeShipping;
         if (isFreeShipping) editPayload.shippingCost = 0;
      }

      const originalImg = item.mainImage || item.image || item.imageUrl || (item.images?.[0]) || '';
      if (mainImage !== originalImg && mainImage.trim()) {
         if (itemType === 'product') {
            editPayload.mainImage = mainImage;
         } else {
            editPayload.image = mainImage;
            editPayload.imageUrl = mainImage;
         }
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Edytuj i zatwierdź {itemType === 'deal' ? 'okazję' : 'produkt'}</span>
            {sourceUrl && (
               <Button variant="outline" size="sm" asChild>
                 <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                   <ExternalLink className="w-4 h-4 mr-2" /> Pokaż oryginał
                 </a>
               </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Szybka modyfikacja kluczowych danych tuż przed zatwierdzeniem elementu.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
           {/* Lewa kolumna: Główna treść */}
           <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="qe-title">Tytuł (PL)</Label>
                <Input
                  id="qe-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Tytuł..."
                />
              </div>

              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                   <Label htmlFor="qe-description">Opis (PL)</Label>
                   <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={clearHtml}>
                      <Trash2 className="w-3 h-3 mr-1" /> Wyczyść HTML
                   </Button>
                </div>
                <Textarea
                  id="qe-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="min-h-[150px] resize-y text-xs font-mono"
                  placeholder="Opis..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qe-category">Slug kategorii nadrzędnej</Label>
                <Input
                  id="qe-category"
                  value={mainCategory}
                  onChange={e => setMainCategory(e.target.value)}
                  placeholder="np. elektronika"
                />
              </div>
           </div>

           {/* Prawa kolumna: Media i finanse */}
           <div className="space-y-6">
              <div className="space-y-3">
                 <Label>Miniaturka</Label>
                 <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 rounded border bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                       {mainImage ? <img src={mainImage} alt="Preview" className="object-cover w-full h-full" /> : <span className="text-xs text-muted-foreground">Brak</span>}
                    </div>
                    <div className="space-y-1.5 flex-1">
                       <Label htmlFor="qe-image" className="text-xs text-muted-foreground">URL Obrazka</Label>
                       <Input
                         id="qe-image"
                         value={mainImage}
                         onChange={e => setMainImage(e.target.value)}
                         placeholder="https://..."
                       />
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                 <div className="space-y-1.5">
                   <Label htmlFor="qe-price">Cena (PLN)</Label>
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
                   <Label htmlFor="qe-shipping">Koszt dostawy (PLN)</Label>
                   <Input
                     id="qe-shipping"
                     type="number"
                     step="0.01"
                     min="0"
                     value={shippingCost}
                     onChange={e => {
                        setShippingCost(e.target.value);
                        if (parseFloat(e.target.value) > 0) setIsFreeShipping(false);
                     }}
                     disabled={isFreeShipping}
                     placeholder="0.00"
                   />
                 </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="qe-free-shipping" 
                  checked={isFreeShipping} 
                  onCheckedChange={(checked) => {
                     setIsFreeShipping(checked as boolean);
                     if (checked) setShippingCost('0');
                  }} 
                />
                <Label htmlFor="qe-free-shipping" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Darmowa dostawa
                </Label>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg mt-4 text-xs space-y-1">
                 <p className="font-semibold mb-2">Podsumowanie całkowite:</p>
                 <div className="flex justify-between">
                    <span>Cena produktu:</span>
                    <span className="font-mono">{parseFloat(price || '0').toFixed(2)} PLN</span>
                 </div>
                 <div className="flex justify-between">
                    <span>Koszt dostawy:</span>
                    <span className="font-mono">{isFreeShipping ? '0.00' : parseFloat(shippingCost || '0').toFixed(2)} PLN</span>
                 </div>
                 <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span>SUMA:</span>
                    <span className="font-mono">{(parseFloat(price || '0') + (isFreeShipping ? 0 : parseFloat(shippingCost || '0'))).toFixed(2)} PLN</span>
                 </div>
              </div>
           </div>
        </div>

        <DialogFooter className="gap-2 border-t pt-4 mt-2">
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
