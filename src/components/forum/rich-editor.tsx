'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { Deal, Product } from '@/lib/types';
import { SearchableAttachmentPicker } from './searchable-attachment-picker';
import { AttachmentCard } from './attachment-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Gift, Package } from 'lucide-react';

interface ForumRichEditorProps {
  value: string;
  onChange: (value: string) => void;
  attachments: Array<{ type: 'deal' | 'product'; id: string; item: Deal | Product }>;
  onAttachmentAdd: (item: Deal | Product, type: 'deal' | 'product') => void;
  onAttachmentRemove: (id: string) => void;
  placeholder?: string;
}

export function ForumRichEditor({
  value,
  onChange,
  attachments,
  onAttachmentAdd,
  onAttachmentRemove,
  placeholder = 'Opisz swoją myśl... Możesz też embedować deals/produkty!',
}: ForumRichEditorProps) {
  const [openDealPicker, setOpenDealPicker] = useState(false);
  const [openProductPicker, setOpenProductPicker] = useState(false);

  const handleDealSelected = (deal: Deal | Product) => {
    onAttachmentAdd(deal, 'deal');
    setOpenDealPicker(false);
  };

  const handleProductSelected = (product: Deal | Product) => {
    onAttachmentAdd(product, 'product');
    setOpenProductPicker(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg flex-wrap">
        <Dialog open={openDealPicker} onOpenChange={setOpenDealPicker}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              title="Embeduj najlepszą okazję"
            >
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Dodaj okazję</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wybierz okazję do embedowania</DialogTitle>
            </DialogHeader>
            <SearchableAttachmentPicker
              type="deal"
              onSelect={handleDealSelected}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={openProductPicker} onOpenChange={setOpenProductPicker}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              title="Embeduj produkt"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Dodaj produkt</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wybierz produkt do embedowania</DialogTitle>
            </DialogHeader>
            <SearchableAttachmentPicker
              type="product"
              onSelect={handleProductSelected}
            />
          </DialogContent>
        </Dialog>

        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {attachments.length > 0 && `${attachments.length} załącznik${attachments.length !== 1 ? 'ów' : 'a'}`}
        </span>
      </div>

      {/* Editor */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[150px]"
      />

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="space-y-3 bg-muted/20 p-4 rounded-lg border">
          <div className="text-sm font-semibold">Załączone deals/produkty:</div>
          {attachments.map((att) => (
            <div key={`${att.type}-${att.id}`} className="relative">
              <AttachmentCard item={att.item} type={att.type} variant="compact" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAttachmentRemove(att.id)}
                className="absolute top-2 right-2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
