'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { withImageProxy } from '@/lib/image-proxy';
import { Flame, Grid3X3, LayoutGrid, ArrowUpRight, Tag } from 'lucide-react';
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

export function UXPreviewV4Client({ initialHotDeals, initialTopProducts, categories }: Props) {
  const locale = useLocale();
  const [viewMode, setViewMode] = useState<'masonry' | 'grid'>('masonry');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = ['🔥 Hot', '💸 Najtańsze', '⭐ Top rated', '🆕 Nowe'];

  // For masonry-like effect we use CSS columns
  const deals = initialHotDeals.slice(0, 16);

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-zinc-950">
      {/* Banner */}
      <div className="bg-amber-500 text-amber-950 py-2 text-center text-xs font-bold tracking-wider uppercase">
        <LayoutGrid className="inline h-3 w-3 mr-1" />
        Propozycja V4 — Kafelki / Masonry z tagami
      </div>

      {/* Sticky top nav */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-amber-200 dark:border-zinc-800">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <span className="font-black text-amber-600 dark:text-amber-400 text-lg">Okazje+</span>
          
          {/* Tags */}
          <div className="flex gap-2 overflow-x-auto flex-1">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all",
                  activeTag === tag
                    ? "bg-amber-500 text-white"
                    : "bg-amber-100 dark:bg-zinc-800 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-zinc-700"
                )}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setViewMode('masonry')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'masonry' ? "bg-amber-500 text-white" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-amber-500 text-white" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Categories pills */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-8">
          {categories.slice(0, 10).map(cat => (
            <Link
              key={cat.id}
              href={`/${locale}/deals?category=${cat.slug}`}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-700 hover:border-amber-400 hover:shadow-md transition-all group"
            >
              <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center font-black text-xs group-hover:bg-amber-500 group-hover:text-white transition-all">
                {cat.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{cat.name}</span>
            </Link>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Flame className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Gorące Okazje</h1>
          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full">
            {deals.length} okazji
          </span>
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="ml-auto text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" /> Wyczyść tag
            </button>
          )}
        </div>

        {/* Masonry/Grid */}
        {viewMode === 'masonry' ? (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {deals.map((deal: any, idx) => {
              const title = getLocalizedText(deal.title, 'Oferta');
              const image = getDealImage(deal);
              const price = formatPrice(deal.price ?? deal.legacyPrice);
              const originalPrice = formatPrice(deal.originalPrice);
              const temp = Math.round(deal.temperature || 0);
              const isHot = temp >= 100;
              const discountPct = deal.originalPrice && deal.price && deal.originalPrice > deal.price
                ? Math.round((deal.originalPrice - deal.price) / deal.originalPrice * 100)
                : null;
              // Vary image aspect for masonry feel
              const aspects = ['aspect-[4/3]', 'aspect-[3/4]', 'aspect-square', 'aspect-[16/9]', 'aspect-[4/3]'];
              const aspect = aspects[idx % aspects.length];

              return (
                <Link key={deal.id} href={`/${locale}/admin/ux-preview/deal/${deal.id}`} className="group block break-inside-avoid mb-4">
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-amber-100 dark:border-zinc-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                    <div className={cn("relative overflow-hidden", aspect)}>
                      <Image
                        src={withImageProxy(image)}
                        alt={title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        loading={idx < 4 ? 'eager' : 'lazy'}
                      />
                      {isHot && (
                        <span className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Flame className="h-3 w-3" />{temp}°
                        </span>
                      )}
                      {discountPct && discountPct > 0 && (
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                          -{discountPct}%
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2 group-hover:text-amber-600 transition-colors">{title}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          {price && <span className="text-sm font-black text-zinc-900 dark:text-white">{price}</span>}
                          {originalPrice && originalPrice !== price && (
                            <span className="text-[10px] text-zinc-400 line-through ml-1">{originalPrice}</span>
                          )}
                        </div>
                        <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {deals.map((deal: any, idx) => {
              const title = getLocalizedText(deal.title, 'Oferta');
              const image = getDealImage(deal);
              const price = formatPrice(deal.price ?? deal.legacyPrice);
              const temp = Math.round(deal.temperature || 0);

              return (
                <Link key={deal.id} href={`/${locale}/admin/ux-preview/deal/${deal.id}`} className="group block">
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-amber-100 dark:border-zinc-800 hover:shadow-lg transition-all">
                    <div className="relative aspect-square overflow-hidden">
                      <Image src={withImageProxy(image)} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-400" loading={idx < 4 ? 'eager' : 'lazy'} />
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <Flame className="h-3 w-3" />{temp}°
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 line-clamp-2">{title}</p>
                      {price && <p className="text-sm font-black text-zinc-900 dark:text-white mt-1">{price}</p>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
