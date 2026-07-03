'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { withImageProxy } from '@/lib/image-proxy';
import { Flame, ShoppingBag, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';

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

export function UXPreviewV2Client({ initialHotDeals, initialTopProducts, categories }: Props) {
  const locale = useLocale();
  const [heroDeal, ...restDeals] = initialHotDeals;
  const featuredDeals = restDeals.slice(0, 4);
  const gridDeals = restDeals.slice(4, 10);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white py-2 text-center text-xs font-bold tracking-wider uppercase">
        <Sparkles className="inline h-3 w-3 mr-1" />
        Propozycja V2 — Układ magazynowy z hero dealem
      </div>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* HERO DEAL — Full width magazine style */}
        {heroDeal && (() => {
          const title = getLocalizedText((heroDeal as any).title, 'Oferta');
          const image = getDealImage(heroDeal as any);
          const price = formatPrice((heroDeal as any).price);
          const originalPrice = formatPrice((heroDeal as any).originalPrice);
          const temp = Math.round((heroDeal as any).temperature || 0);
          const discountPct = (heroDeal as any).originalPrice && (heroDeal as any).price
            ? Math.round(((heroDeal as any).originalPrice - (heroDeal as any).price) / (heroDeal as any).originalPrice * 100)
            : null;

          return (
            <Link href={`/${locale}/deals/${(heroDeal as any).id}`} className="group block">
              <div className="relative rounded-3xl overflow-hidden h-[420px] shadow-2xl">
                <Image
                  src={withImageProxy(image)}
                  alt={title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
                    Okazja Dnia
                  </span>
                  {discountPct && discountPct > 0 && (
                    <span className="bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-full">
                      -{discountPct}%
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                  <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight line-clamp-2 mb-3">
                    {title}
                  </h1>
                  <div className="flex items-center gap-4">
                    {price && <span className="text-3xl font-black text-white">{price}</span>}
                    {originalPrice && originalPrice !== price && (
                      <span className="text-lg text-white/60 line-through">{originalPrice}</span>
                    )}
                    <span className="flex items-center gap-1 bg-orange-500/20 text-orange-300 border border-orange-400/30 text-sm font-bold px-3 py-1.5 rounded-full ml-auto">
                      <Flame className="h-4 w-4" />{temp}°
                    </span>
                    <span className="bg-white text-gray-900 font-bold text-sm px-5 py-2.5 rounded-full group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      Kup teraz →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })()}

        {/* 4-column featured strip */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" /> Najgorętsze teraz
            </h2>
            <Link href={`/${locale}/admin/ux-preview/deals`} className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-1">
              Wszystkie <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredDeals.map((deal: any) => {
              const title = getLocalizedText(deal.title, 'Oferta');
              const image = getDealImage(deal);
              const price = formatPrice(deal.price ?? deal.legacyPrice);
              const discountPct = deal.originalPrice && deal.price
                ? Math.round((deal.originalPrice - deal.price) / deal.originalPrice * 100)
                : null;
              return (
                <Link key={deal.id} href={`/${locale}/deals/${deal.id}`} className="group block">
                  <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all">
                    <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <Image src={withImageProxy(image)} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      {discountPct && discountPct > 0 && (
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                          -{discountPct}%
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 line-clamp-2">{title}</p>
                      {price && <p className="text-sm font-black text-gray-900 dark:text-white mt-1">{price}</p>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Categories horizontal */}
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Przeglądaj kategorie</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {categories.slice(0, 8).map(cat => (
              <Link
                key={cat.id}
                href={`/${locale}/deals?category=${cat.slug}`}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-emerald-400 hover:shadow-md transition-all group text-center"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-black text-sm group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  {cat.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 line-clamp-1">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom grid — more deals */}
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-500" /> Więcej okazji
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {gridDeals.map((deal: any) => {
              const title = getLocalizedText(deal.title, 'Oferta');
              const image = getDealImage(deal);
              const price = formatPrice(deal.price ?? deal.legacyPrice);
              const originalPrice = formatPrice(deal.originalPrice);
              const temp = Math.round(deal.temperature || 0);

              return (
                <Link key={deal.id} href={`/${locale}/deals/${deal.id}`} className="group block">
                  <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all">
                    <div className="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <Image src={withImageProxy(image)} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      <span className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-orange-400 text-xs font-bold px-2.5 py-1 rounded-full">
                        <Flame className="h-3 w-3" />{temp}°
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-2 group-hover:text-emerald-600 transition-colors">{title}</h3>
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          {price && <span className="text-lg font-black text-gray-900 dark:text-white">{price}</span>}
                          {originalPrice && originalPrice !== price && (
                            <span className="text-xs text-gray-400 line-through ml-2">{originalPrice}</span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-emerald-600 group-hover:underline">Sprawdź →</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
