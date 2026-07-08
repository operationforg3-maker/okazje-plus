"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ChevronDown, ChevronUp, ExternalLink, Package, Truck, DollarSign, Percent, Info, Tags, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useCategoryName } from '@/hooks/use-category-name';
import Image from 'next/image';

interface ModerationDetailViewProps {
  item: any;
  itemType: 'deal' | 'product';
}

function getLocalized(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.pl || val.en || val.de || Object.values(val)[0] || fallback;
  return fallback;
}

export function ModerationDetailView({ item, itemType }: ModerationDetailViewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    rawData: false,
    variants: true,
  });

  const { mainName, subName, subSubName } = useCategoryName(
    item.mainCategorySlug,
    item.subCategorySlug,
    item.subSubCategorySlug
  );

  const toggleSection = (section: string) => {
    setExpandedSections(p => ({ ...p, [section]: !p[section] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Skopiowano do schowka');
  };

  const title = getLocalized(item.title || item.name);
  const description = getLocalized(item.description || item.fullDescription || item.shortDescription);
  
  // Images
  const mainImage = item.mainImage || item.image || item.imageUrl || (item.images?.[0]);
  const gallery = item.images || [];

  // Financials
  const priceAmount = item.price?.amount || item.price || item.bestPrice?.amount || 0;
  const priceCurrency = item.price?.currency || item.bestPrice?.currency || 'PLN';
  const originalPrice = item.originalPrice || 0;
  const shippingCost = item.shippingCost || item.shippingInfo?.shippingCost || 0;
  const isFreeShipping = item.freeShipping || item.shippingInfo?.freeShipping || shippingCost === 0;
  const totalCost = Number(priceAmount) + Number(shippingCost);
  const commissionRate = item.commissionRate || item.commission_rate;
  const orders = item.orders || item.volume || item.lastest_volume;

  // Source URL
  const sourceUrl = item.sourceUrl || item.affiliateUrl || item.url || (item.sourceLinks?.[0]?.url);

  return (
    <div className="space-y-6">
      {/* HERO SECTION */}
      <div className="flex flex-col md:flex-row gap-6 bg-card border rounded-xl p-6 shadow-sm relative overflow-hidden">
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <Badge variant={item.status === 'pending' || item.status === 'pending_approval' ? 'secondary' : item.status === 'approved' ? 'default' : 'destructive'} className="text-sm px-3 py-1 uppercase tracking-wider">
            {item.status || 'Nieznany'}
          </Badge>
        </div>

        {/* Image */}
        <div className="w-full md:w-[200px] flex-shrink-0 flex flex-col gap-2">
          {mainImage ? (
            <div className="aspect-square relative rounded-lg border bg-muted overflow-hidden">
              {/* Using standard img to avoid next/image domain configuration issues in admin panel */}
              <img src={mainImage} alt={title} className="object-contain w-full h-full" />
            </div>
          ) : (
            <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 opacity-50" />
            </div>
          )}
          {sourceUrl && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" /> Otwórz źródło
              </a>
            </Button>
          )}
        </div>

        {/* Core Info */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
              <Tags className="w-3 h-3" />
              {mainName || item.mainCategorySlug || 'Brak kategorii'}
              {subName && ` / ${subName}`}
            </div>
            <h2 className="text-2xl font-bold leading-tight break-words">{title || 'Bez tytułu'}</h2>
            {(item.merchantName || item.merchant) && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="bg-primary/5 text-primary">
                  🏪 {item.merchantName || item.merchant}
                </Badge>
                {(item.merchantRating || item.rating) && (
                  <span className="text-sm text-muted-foreground flex items-center">
                    ⭐ {item.merchantRating || item.rating}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground line-clamp-3 bg-muted/30 p-3 rounded-lg">
            {description ? <div dangerouslySetInnerHTML={{ __html: description }} /> : <span className="italic">Brak opisu</span>}
          </div>
        </div>
      </div>

      {/* FINANCE & METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-center items-center text-center">
          <div className="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Cena i Wartość
          </div>
          <div className="text-2xl font-black text-primary">{Number(priceAmount).toFixed(2)} {priceCurrency}</div>
          {originalPrice > priceAmount && (
            <div className="text-xs text-muted-foreground line-through">{Number(originalPrice).toFixed(2)} {priceCurrency}</div>
          )}
        </div>

        <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-center items-center text-center">
          <div className="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center gap-1">
            <Truck className="w-3 h-3" /> Wysyłka
          </div>
          {isFreeShipping ? (
            <div className="text-xl font-bold text-green-600">Darmowa</div>
          ) : (
            <div className="text-xl font-bold">{Number(shippingCost).toFixed(2)} {priceCurrency}</div>
          )}
          {item.shippingDays && <div className="text-xs text-muted-foreground mt-1">Czas: {item.shippingDays} dni</div>}
        </div>

        <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-center items-center text-center">
          <div className="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center gap-1">
            <Percent className="w-3 h-3" /> Prowizja (Affiliate)
          </div>
          <div className="text-xl font-bold text-blue-600">
            {commissionRate ? `${(Number(commissionRate) * 100).toFixed(1)}%` : 'Brak danych'}
          </div>
        </div>

        <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-center items-center text-center">
          <div className="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center gap-1">
            <Package className="w-3 h-3" /> Zainteresowanie
          </div>
          <div className="text-xl font-bold text-orange-600">
            {orders ? `${orders} sprzedanych` : 'Brak danych'}
          </div>
          {item.qualityScore && <div className="text-xs text-muted-foreground mt-1">Quality Score: {item.qualityScore}</div>}
        </div>
      </div>

      {/* VARIANTS & SPECS */}
      <div className="grid md:grid-cols-2 gap-4">
        {(item.variants || item.skuList) && (
          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            <button onClick={() => toggleSection('variants')} className="w-full flex items-center justify-between p-4 bg-muted/40 hover:bg-muted/60 transition-colors">
              <div className="font-semibold flex items-center gap-2"><Package className="w-4 h-4"/> Warianty / SKU</div>
              {expandedSections['variants'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections['variants'] && (
              <div className="p-4 border-t">
                {Array.isArray(item.variants) && item.variants.map((v: any, i: number) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="text-xs font-bold text-muted-foreground mb-1">{v.name || 'Wariant'}:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(v.values) ? v.values.map((val: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="bg-background">{val}</Badge>
                      )) : <Badge variant="outline">{String(v.value || v)}</Badge>}
                    </div>
                  </div>
                ))}
                {!item.variants && <div className="text-sm text-muted-foreground">Warianty w formacie surowym (skuList), sprawdź RAW JSON.</div>}
              </div>
            )}
          </div>
        )}

        {(item.specs || item.attributes) && (
          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="w-full p-4 bg-muted/40 font-semibold flex items-center gap-2 border-b">
              <Info className="w-4 h-4"/> Specyfikacja
            </div>
            <div className="p-0">
              <div className="grid grid-cols-1 divide-y max-h-[300px] overflow-y-auto">
                {item.attributes ? item.attributes.map((attr: any, i: number) => (
                  <div key={i} className="flex p-3 text-sm hover:bg-muted/30">
                    <div className="w-1/3 text-muted-foreground font-medium">{attr.name}</div>
                    <div className="w-2/3">{attr.value}</div>
                  </div>
                )) : Object.entries(item.specs || {}).map(([key, val], i: number) => (
                  <div key={i} className="flex p-3 text-sm hover:bg-muted/30">
                    <div className="w-1/3 text-muted-foreground font-medium">{key}</div>
                    <div className="w-2/3">{String(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RAW DATA ACCORDION */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <button
          onClick={() => toggleSection('rawData')}
          className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <div className="font-semibold text-sm text-muted-foreground">⚙️ Surowe dane do debuggowania (RAW JSON)</div>
          {expandedSections['rawData'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expandedSections['rawData'] && (
          <div className="p-4 border-t relative bg-[#0d1117]">
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-6 right-6 opacity-70 hover:opacity-100"
              onClick={() => copyToClipboard(JSON.stringify(item, null, 2))}
            >
              <Copy className="h-3 w-3 mr-1" />
              Kopiuj
            </Button>
            <pre className="text-green-400 font-mono text-xs overflow-x-auto max-h-[400px] overflow-y-auto p-2">
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
