'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { withImageProxy } from '@/lib/image-proxy';
import { Flame, ShoppingBag, Search, Filter, ChevronRight, Star, ArrowUpRight, Tag, Zap } from 'lucide-react';
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

interface Props {
  initialHotDeals: Deal[];
  initialTopProducts: Product[];
  categories: Category[];
}

export function UXPreviewV1Client({ initialHotDeals, initialTopProducts, categories }: Props) {
  const locale = useLocale();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredDeals = activeCategory
    ? initialHotDeals.filter(d => {
        const catName = getLocalizedText((d as any).category?.name || (d as any).categoryName || '');
        return catName.toLowerCase().includes(activeCategory.toLowerCase());
      })
    : initialHotDeals;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2 text-center text-xs font-bold tracking-wider uppercase">
        <Zap className="inline h-3 w-3 mr-1" />
        Propozycja V1 — Układ z filtrem bocznym i listą dealów
      </div>

      <div className="container mx-auto px-4 py-8 flex gap-8">
        {/* SIDEBAR */}
        <aside className="hidden lg:block w-64 flex-shrink-0 space-y-6">
          {/* Search */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj okazji..."
                className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Kategorie
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  !activeCategory ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                Wszystkie kategorie
              </button>
              {categories.slice(0, 12).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.name)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between group",
                    activeCategory === cat.name ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <span>{cat.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>

          {/* Top Products Mini */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Top Produkty
            </h3>
            <div className="space-y-3">
              {initialTopProducts.slice(0, 4).map((p: any) => {
                const img = (p.image || p.images?.[0] || '/placeholder.png');
                const title = getLocalizedText(p.title || p.name, 'Produkt');
                const slug = typeof p.slug === 'string' ? p.slug : p.id;
                return (
                  <Link key={p.id} href={`/${locale}/products/${slug}`} className="flex items-center gap-3 group">
                    <div className="h-12 w-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 relative">
                      <Image src={withImageProxy(img)} alt={title} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 line-clamp-2 group-hover:text-blue-600 transition-colors">{title}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                Gorące Okazje
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {filteredDeals.length} okazji {activeCategory ? `w kategorii "${activeCategory}"` : 'w bazie'}
              </p>
            </div>
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Tag className="h-3.5 w-3.5" /> Wyczyść filtr
              </button>
            )}
          </div>

          {/* Deals - List view on mobile, 2-col on md+ */}
          <div className="space-y-4">
            {filteredDeals.slice(0, 12).map((deal: any, idx) => {
              const title = getLocalizedText(deal.title, 'Oferta');
              const image = getDealImage(deal);
              const price = formatPrice(deal.price ?? deal.legacyPrice);
              const originalPrice = formatPrice(deal.originalPrice);
              const temp = Math.round(deal.temperature || 0);
              const merchant = getLocalizedText(deal.merchant || deal.metadata?.merchant || deal.source, '');
              const isHot = temp >= 100;

              return (
                <Link key={deal.id} href={`/${locale}/deals/${deal.id}`} className="group block">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex">
                    {/* Image */}
                    <div className="w-36 sm:w-48 flex-shrink-0 relative bg-slate-100 dark:bg-slate-800">
                      <Image
                        src={withImageProxy(image)}
                        alt={title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        loading={idx < 3 ? 'eager' : 'lazy'}
                      />
                      {isHot && (
                        <span className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                          🔥 HOT
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {title}
                        </h3>
                        {merchant && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{merchant}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          {price && (
                            <span className="text-lg font-black text-slate-900 dark:text-white">{price}</span>
                          )}
                          {originalPrice && originalPrice !== price && (
                            <span className="text-xs text-slate-400 line-through ml-2">{originalPrice}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
                            isHot ? "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            <Flame className="h-3 w-3" />{temp}°
                          </span>
                          <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
