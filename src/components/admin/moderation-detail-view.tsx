"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ChevronDown, ChevronUp, ExternalLink, Package, Truck, DollarSign, Percent, Info, Tags, Image as ImageIcon, Ticket, Check, AlertCircle, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useCategoryName } from '@/hooks/use-category-name';
import { withImageProxy } from '@/lib/image-proxy';

interface ModerationDetailViewProps {
  item: any;
  itemType: 'deal' | 'product';
}

const SUPPORTED_LANGS = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
] as const;

function getLocalizedField(val: any, lang: string): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val[lang] || '';
  }
  return '';
}

function getLocalizedSellingPoints(item: any, lang: string): string[] {
  const points = item?.metadata?.sellingPoints || item?.sellingPoints;
  if (!points) return [];
  if (Array.isArray(points)) return points;
  if (typeof points === 'object' && Array.isArray(points[lang])) {
    return points[lang];
  }
  return [];
}

export function ModerationDetailView({ item, itemType }: ModerationDetailViewProps) {
  const [activeLang, setActiveLang] = useState<string>('pl');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    rawData: false,
    variants: true,
  });

  const { mainName, subName } = useCategoryName(
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

  // Images
  const mainImage = item.mainImage || item.image || item.imageUrl || (item.images?.[0]) || (item.gallery?.[0]?.url);

  // Financials
  const priceAmount = item.price?.amount || item.price || item.bestPrice?.amount || 0;
  const priceCurrency = item.price?.currency || item.bestPrice?.currency || 'PLN';
  const originalPrice = item.originalPrice || item.price?.originalAmount || 0;
  const shippingCost = item.shippingCost || item.shippingInfo?.shippingCost || 0;
  const isFreeShipping = item.freeShipping || item.shippingInfo?.freeShipping || shippingCost === 0;
  const commissionRate = item.commissionRate || item.commission_rate;
  const incentiveCommission = item.incentiveCommissionRate || item.metadata?.incentiveCommissionRate;
  const orders = item.orders || item.volume || item.popularity;

  // Promo details
  const promoCode = item.promoCode || item.promoDetails?.code;
  const promoMinSpend = item.promoDetails?.minSpend;
  const promoDiscount = item.promoDetails?.discount;

  // Source URL
  const sourceUrl = item.sourceUrl || item.affiliateUrl || item.url || (item.sourceLinks?.[0]?.url);

  // Current localized content
  const currentTitle = getLocalizedField(item.title || item.name, activeLang) || getLocalizedField(item.title || item.name, 'pl') || 'Bez tytułu';
  const currentDescription = getLocalizedField(item.description || item.fullDescription || item.shortDescription, activeLang) || getLocalizedField(item.description || item.fullDescription || item.shortDescription, 'pl');
  const currentSellingPoints = getLocalizedSellingPoints(item, activeLang);

  return (
    <div className="space-y-6">
      {/* LANGUAGE SWITCHER BAR */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">Podgląd treści wielojęzycznych:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_LANGS.map(lang => {
            const hasTitle = Boolean(getLocalizedField(item.title || item.name, lang.code));
            const hasDesc = Boolean(getLocalizedField(item.description || item.fullDescription, lang.code));
            const isComplete = hasTitle && hasDesc;

            return (
              <button
                key={lang.code}
                onClick={() => setActiveLang(lang.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeLang === lang.code
                    ? 'bg-blue-600 text-white shadow-md font-bold ring-2 ring-blue-300'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>{lang.flag}</span>
                <span className="uppercase font-bold">{lang.code}</span>
                {isComplete ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : hasTitle ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-slate-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* PROMO CODE BANNER (IF PRESENT) */}
      {promoCode && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-xl p-4 shadow-md border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 rounded-lg border border-purple-400/30">
              <Ticket className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <div className="text-xs text-purple-300 font-semibold uppercase tracking-wider">Kod Rabatowy z CSV / Kampanii</div>
              <div className="text-xl font-extrabold tracking-wide font-mono text-yellow-300">{promoCode}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {promoMinSpend && (
              <div className="bg-purple-950/60 px-3 py-1.5 rounded-lg border border-purple-700/50">
                <span className="text-purple-300">Min. koszyk: </span>
                <span className="font-bold text-white">{promoMinSpend}</span>
              </div>
            )}
            {promoDiscount && (
              <div className="bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-700/50">
                <span className="text-emerald-300">Zniżka z kodem: </span>
                <span className="font-bold text-emerald-200">{promoDiscount}</span>
              </div>
            )}
            {incentiveCommission && (
              <div className="bg-amber-950/60 px-3 py-1.5 rounded-lg border border-amber-700/50">
                <span className="text-amber-300">Incentive Prowizja: </span>
                <span className="font-bold text-amber-200">+{incentiveCommission}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <div className="flex flex-col md:flex-row gap-6 bg-card border rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <Badge variant={item.status === 'pending' || item.status === 'pending_approval' ? 'secondary' : item.status === 'approved' ? 'default' : 'destructive'} className="text-sm px-3 py-1 uppercase tracking-wider">
            {item.status || 'Nieznany'}
          </Badge>
        </div>

        {/* Image */}
        <div className="w-full md:w-[200px] flex-shrink-0 flex flex-col gap-2">
          {mainImage ? (
            <div className="aspect-square relative rounded-lg border bg-muted overflow-hidden">
              <img src={withImageProxy(mainImage)} alt={currentTitle} className="object-contain w-full h-full" />
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
              <span className="ml-auto font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">
                {SUPPORTED_LANGS.find(l => l.code === activeLang)?.flag} {activeLang}
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-tight break-words">{currentTitle}</h2>
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

          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg space-y-2">
            {currentDescription ? (
              <div dangerouslySetInnerHTML={{ __html: currentDescription }} />
            ) : (
              <span className="italic text-amber-600">Brak opisu dla języka {activeLang.toUpperCase()}</span>
            )}
          </div>

          {/* SELLING POINTS FOR ACTIVE LANG */}
          {currentSellingPoints.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {currentSellingPoints.map((pt: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  ✓ {pt}
                </Badge>
              ))}
            </div>
          )}
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
            {commissionRate ? `${(Number(commissionRate) * (commissionRate > 1 ? 1 : 100)).toFixed(1)}%` : 'Brak danych'}
          </div>
        </div>

        <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-center items-center text-center">
          <div className="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center gap-1">
            <Package className="w-3 h-3" /> Zainteresowanie
          </div>
          <div className="text-xl font-bold text-orange-600">
            {orders ? `${orders} sprzedanych` : 'Brak danych'}
          </div>
        </div>
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

