'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { withImageProxy } from '@/lib/image-proxy';
import { Flame, ChevronRight, MapPin, Grid2X2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function getLocalizedText(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const candidate = localized.pl || localized.en || localized.de;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function getDealImage(deal: any): string {
  const candidates = [deal?.image, deal?.imageUrl, deal?.mainImage, deal?.thumbnail];
  for (const c of candidates) if (typeof c === 'string' && c.trim()) return c.trim();
  return '/icon_okazjeplus.svg';
}

function formatPrice(v: any): string {
  const n = typeof v === 'number' ? v : parseFloat(String(v || '0').replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (isNaN(n) || n === 0) return '';
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
}

const catColors = [
  { bg: 'bg-rose-100 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800', activeBg: 'bg-rose-500', abbr: 'bg-rose-500' },
  { bg: 'bg-sky-100 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800', activeBg: 'bg-sky-500', abbr: 'bg-sky-500' },
  { bg: 'bg-violet-100 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', activeBg: 'bg-violet-500', abbr: 'bg-violet-500' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', activeBg: 'bg-emerald-500', abbr: 'bg-emerald-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', activeBg: 'bg-amber-500', abbr: 'bg-amber-500' },
  { bg: 'bg-pink-100 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800', activeBg: 'bg-pink-500', abbr: 'bg-pink-500' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800', activeBg: 'bg-cyan-500', abbr: 'bg-cyan-500' },
  { bg: 'bg-lime-100 dark:bg-lime-900/20', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-200 dark:border-lime-800', activeBg: 'bg-lime-500', abbr: 'bg-lime-500' },
];

interface Props {
  initialHotDeals: Deal[];
  initialTopProducts: Product[];
  categories: Category[];
}

export function UXPreviewV5Client({ initialHotDeals, initialTopProducts, categories }: Props) {
  const locale = useLocale();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const visibleCategories = categories.slice(0, 8);

  // Map deals by category for category-first display
  // Since we may not have category match on deals, show all deals with category filter
  const filteredDeals = selectedCat
    ? initialHotDeals.filter((d: any) => {
        const catStr = getLocalizedText((d as any).category?.name || (d as any).categoryName || '');
        return catStr.toLowerCase().includes(selectedCat.toLowerCase());
      })
    : initialHotDeals;

  // Split deals into "per category" sections for category-first view
  const dealsToShow = filteredDeals.slice(0, 12);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-500 text-white py-2 text-center text-xs font-bold tracking-wider uppercase">
        <Grid2X2 className="inline h-3 w-3 mr-1" />
        Propozycja V5 — Przeglądanie przez kategorie
      </div>

      {/* Two-column layout */}
      <div className="container mx-auto px-4 py-8 flex gap-8">
        {/* LEFT: Category nav — sticky */}
        <nav className="hidden md:flex flex-col gap-2 w-52 flex-shrink-0 sticky top-4 self-start">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-3">
            <MapPin className="inline h-3.5 w-3.5 mr-1" /> Kategorie
          </h2>
          <button
            onClick={() => setSelectedCat(null)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
              !selectedCat
                ? "bg-teal-500 text-white shadow-md shadow-teal-500/20"
                : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-neutral-900"
            )}
          >
            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white", !selectedCat ? "bg-white/30" : "bg-gray-200 dark:bg-neutral-800")}>
              ✦
            </div>
            Wszystkie
          </button>
          {visibleCategories.map((cat, i) => {
            const c = catColors[i % catColors.length];
            const isActive = selectedCat === cat.name;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(isActive ? null : cat.name)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left",
                  isActive
                    ? `${c.activeBg} text-white shadow-md`
                    : `text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-neutral-900`
                )}
              >
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white", isActive ? "bg-white/30" : c.abbr)}>
                  {cat.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{cat.name}</span>
              </button>
            );
          })}
        </nav>

        {/* RIGHT: Deals Content */}
        <div className="flex-1 min-w-0 space-y-10">
          {/* Mobile categories horizontal */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:hidden">
            {visibleCategories.map((cat, i) => {
              const c = catColors[i % catColors.length];
              const isActive = selectedCat === cat.name;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(isActive ? null : cat.name)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                    isActive ? `${c.activeBg} text-white` : `${c.bg} ${c.text}`
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Section header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Flame className="h-6 w-6 text-teal-500" />
                {selectedCat ? `Okazje: ${selectedCat}` : 'Wszystkie Okazje'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {dealsToShow.length} {dealsToShow.length === 1 ? 'okazja' : dealsToShow.length < 5 ? 'okazje' : 'okazji'}
              </p>
            </div>
            {selectedCat && (
              <button
                onClick={() => setSelectedCat(null)}
                className="text-xs font-bold text-teal-600 hover:underline"
              >
                Pokaż wszystkie
              </button>
            )}
          </div>

          {/* Deals grid */}
          {dealsToShow.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {dealsToShow.map((deal: any, idx) => {
                const title = getLocalizedText(deal.title, 'Oferta');
                const image = getDealImage(deal);
                const price = formatPrice(deal.price ?? deal.legacyPrice);
                const originalPrice = formatPrice(deal.originalPrice);
                const temp = Math.round(deal.temperature || 0);
                const isHot = temp >= 100;
                const merchant = getLocalizedText(deal.merchant || deal.metadata?.merchant || deal.source, '');
                const discountPct = deal.originalPrice && deal.price && deal.originalPrice > deal.price
                  ? Math.round((deal.originalPrice - deal.price) / deal.originalPrice * 100)
                  : null;

                return (
                  <Link key={deal.id} href={`/${locale}/admin/ux-preview/deal/${deal.id}`} className="group block">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-neutral-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                      {/* Image */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-neutral-800">
                        <Image
                          src={withImageProxy(image)}
                          alt={title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          loading={idx < 3 ? 'eager' : 'lazy'}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <div className="absolute top-2 left-2 flex gap-2">
                          {isHot && (
                            <span className="flex items-center gap-1 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              <Flame className="h-3 w-3" /> HOT
                            </span>
                          )}
                        </div>
                        {discountPct && discountPct > 0 && (
                          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                            -{discountPct}%
                          </span>
                        )}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          {merchant && <span className="text-white/80 text-[10px] font-medium">{merchant}</span>}
                          <span className="ml-auto flex items-center gap-0.5 text-orange-300 text-[10px] font-bold">
                            <Flame className="h-3 w-3" />{temp}°
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-2 group-hover:text-teal-600 transition-colors">
                          {title}
                        </h3>
                        <div className="flex items-center justify-between mt-3">
                          <div>
                            {price && <span className="text-lg font-black text-gray-900 dark:text-white">{price}</span>}
                            {originalPrice && originalPrice !== price && (
                              <span className="text-xs text-gray-400 line-through ml-2">{originalPrice}</span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-teal-600 group-hover:underline flex items-center gap-0.5">
                            Szczegóły <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800">
              <Flame className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-semibold">Brak okazji w tej kategorii</p>
              <button onClick={() => setSelectedCat(null)} className="mt-3 text-sm text-teal-600 font-bold hover:underline">
                Wyczyść filtr
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
