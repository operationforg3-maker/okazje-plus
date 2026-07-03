'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { withImageProxy } from '@/lib/image-proxy';
import { cn } from '@/lib/utils';
import {
  Star, Heart, Share2, ArrowLeft, ExternalLink, ChevronLeft, ChevronRight,
  Package, ShoppingCart, TrendingUp, Truck, ShieldCheck, Zap, MessageSquare,
  ChevronDown, BarChart3, ArrowUpRight, Scale, Tag, Clock
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getText(value: any): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return (value.pl || value.en || value.de || '').trim();
  return '';
}

function getProductImage(p: any): string {
  if (typeof p?.image === 'string' && p.image.trim()) return p.image.trim();
  if (Array.isArray(p?.images) && typeof p.images[0] === 'string') return p.images[0];
  return '/icon_okazjeplus.svg';
}

function getGallery(p: any): string[] {
  const imgs: string[] = [];
  if (Array.isArray(p?.images)) {
    p.images.forEach((i: any) => { if (typeof i === 'string') imgs.push(i); });
  }
  if (Array.isArray(p?.gallery)) {
    p.gallery.forEach((item: any) => {
      const src = typeof item === 'string' ? item : (item?.src || item?.url || '');
      if (src) imgs.push(src);
    });
  }
  const main = getProductImage(p);
  if (imgs.length === 0 && main !== '/icon_okazjeplus.svg') imgs.push(main);
  if (imgs.length === 0) imgs.push('/icon_okazjeplus.svg');
  return [...new Set(imgs)];
}

function formatPrice(v: any, currency = 'PLN'): string | null {
  const n = typeof v === 'number' ? v
    : typeof v === 'object' && v?.amount ? v.amount
    : parseFloat(String(v || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (isNaN(n) || n <= 0) return null;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(n);
}

function getRating(p: any): { avg: number; count: number } | null {
  const avg = typeof p?.rating === 'number' ? p.rating
    : typeof p?.ratingCard?.average === 'number' ? p.ratingCard.average
    : null;
  if (avg === null) return null;
  const count = typeof p?.ratingCard?.count === 'number' ? p.ratingCard.count
    : typeof p?.reviewCount === 'number' ? p.reviewCount
    : 0;
  return { avg, count };
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'dzisiaj';
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  return `${Math.floor(days / 7)} tyg. temu`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  product: any;
  deals: any[];
  recentRatings: any[];
}

export function UXPreviewProductDetailClient({ product, deals, recentRatings }: Props) {
  const locale = useLocale();
  const [currentImg, setCurrentImg] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [expandDesc, setExpandDesc] = useState(false);
  const [activeTab, setActiveTab] = useState<'opis' | 'deale' | 'recenzje'>('opis');

  const title = getText(product?.title || product?.name) || 'Produkt';
  const description = getText(product?.fullDescription || product?.description || product?.shortDescription);
  const gallery = getGallery(product);
  const price = formatPrice(product?.bestPrice ?? product?.price);
  const originalPrice = formatPrice(product?.originalPrice);
  const rating = getRating(product);
  const category = product?.mainCategorySlug || '';
  const subCategory = product?.subCategorySlug || '';

  // Source links from product
  const sourceLinks: Array<{store: string; url: string; price?: string}> = [];
  if (Array.isArray(product?.sourceLinks)) {
    product.sourceLinks.forEach((sl: any) => {
      sourceLinks.push({
        store: sl.store || sl.merchant || getText(sl.name || 'Sklep'),
        url: sl.url || sl.link || '#',
        price: formatPrice(sl.price) || undefined,
      });
    });
  }

  // Specs
  const specs: Array<{name: string; value: string}> = [];
  const rawSpecs = product?.specsLocalized?.pl || product?.specs || product?.metadata?.specifications;
  if (rawSpecs) {
    if (Array.isArray(rawSpecs)) {
      rawSpecs.forEach((s: any) => specs.push({ name: s.name || s.key || '', value: String(s.value || '') }));
    } else if (typeof rawSpecs === 'object') {
      Object.entries(rawSpecs).forEach(([k, v]) => specs.push({ name: k, value: String(v) }));
    }
  }

  const discountPct = product?.originalPrice && product?.bestPrice
    ? Math.round(((product.originalPrice - (typeof product.bestPrice === 'number' ? product.bestPrice : 0)) / product.originalPrice) * 100)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-6 max-w-6xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
          <Link href={`/${locale}/admin/ux-preview`} className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> UX Preview
          </Link>
          <span>/</span>
          {category && <><span className="capitalize">{category}</span><span>/</span></>}
          {subCategory && <><span className="capitalize">{subCategory}</span><span>/</span></>}
          <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-xs">{title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* ── LEFT: Gallery ── */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
              <Image
                src={withImageProxy(gallery[currentImg])}
                alt={title}
                fill
                className="object-contain p-6"
                priority
              />

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {discountPct && discountPct > 0 && (
                  <span className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-black">
                    -{discountPct}%
                  </span>
                )}
              </div>

              {rating && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/95 dark:bg-gray-800/95 px-3 py-1.5 rounded-full text-xs font-bold shadow-md border border-gray-200 dark:border-gray-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {rating.avg.toFixed(1)}
                  <span className="text-gray-400 font-normal">({rating.count})</span>
                </div>
              )}

              {/* Gallery nav */}
              {gallery.length > 1 && (
                <>
                  <button onClick={() => setCurrentImg(i => (i - 1 + gallery.length) % gallery.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-gray-800/90 border flex items-center justify-center shadow-md hover:bg-white transition-all">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setCurrentImg(i => (i + 1) % gallery.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-gray-800/90 border flex items-center justify-center shadow-md hover:bg-white transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImg(idx)}
                    className={cn(
                      "flex-shrink-0 h-16 w-16 rounded-xl overflow-hidden border-2 transition-all",
                      currentImg === idx ? "border-primary shadow-md" : "border-transparent hover:border-gray-300"
                    )}
                  >
                    <Image src={withImageProxy(img)} alt="" width={64} height={64} className="object-cover w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Product Info ── */}
          <div className="space-y-5">
            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight">{title}</h1>

            {/* Rating stars interactive */}
            {rating && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={cn("h-5 w-5", s <= Math.round(rating.avg) ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600")} />
                  ))}
                </div>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{rating.avg.toFixed(1)}</span>
                <span className="text-xs text-gray-500">({rating.count} ocen)</span>
              </div>
            )}

            {/* Price block */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Najlepsza cena</p>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-black text-gray-900 dark:text-white">
                    {price || 'Porównaj oferty'}
                  </span>
                  {originalPrice && originalPrice !== price && (
                    <span className="text-lg text-gray-400 line-through mb-0.5">{originalPrice}</span>
                  )}
                </div>
              </div>

              {/* Source links / Where to buy */}
              {sourceLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gdzie kupić</p>
                  {sourceLinks.map((sl, idx) => (
                    <a
                      key={idx}
                      href={sl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group/link"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-[10px]">
                          {sl.store.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{sl.store}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sl.price && <span className="font-black text-gray-900 dark:text-white">{sl.price}</span>}
                        <ExternalLink className="h-4 w-4 text-gray-400 group-hover/link:text-primary transition-colors" />
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {/* Primary CTA */}
              <a
                href={sourceLinks[0]?.url || product?.affiliateLink || product?.sourceUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-extrabold text-base py-3.5 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5"
              >
                <ShoppingCart className="h-5 w-5" /> Kup teraz
              </a>

              {/* Secondary actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsFavorited(!isFavorited)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all",
                    isFavorited
                      ? "bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                  )}
                >
                  <Heart className={cn("h-4 w-4", isFavorited && "fill-rose-500")} />
                  {isFavorited ? 'Zapisano' : 'Zapisz'}
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <Scale className="h-4 w-4" /> Porównaj
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <Share2 className="h-4 w-4" /> Udostępnij
                </button>
              </div>
            </div>

            {/* Price history placeholder */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-extrabold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Historia cen
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  Teraz najtaniej
                </span>
              </div>
              <div className="h-24 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl flex items-end px-4 pb-3 gap-1">
                {[65, 72, 80, 60, 55, 70, 65, 40, 45, 35, 38, 30].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-primary/20" style={{ height: `${h}%` }}>
                    {i === 11 && <div className="w-full h-full rounded-t-md bg-primary" />}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">Ostatnie 12 miesięcy</p>
            </div>
          </div>
        </div>

        {/* ── Tabs: Opis / Deale / Recenzje ── */}
        <div className="mb-8">
          <div className="flex gap-1 bg-white dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
            {(['opis', 'deale', 'recenzje'] as const).map(tab => {
              const icons = { opis: Zap, deale: TrendingUp, recenzje: Star };
              const labels = { opis: 'Opis produktu', deale: `Okazje (${deals.length})`, recenzje: `Recenzje (${recentRatings.length})` };
              const Icon = icons[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <Icon className="h-4 w-4" /> {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Tab content: Description */}
          {activeTab === 'opis' && (
            <div className="space-y-6">
              {description && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                  <div className={cn("text-sm text-gray-600 dark:text-gray-400 leading-relaxed", !expandDesc && "line-clamp-6")}>
                    {description}
                  </div>
                  {description.length > 400 && (
                    <button onClick={() => setExpandDesc(!expandDesc)} className="mt-3 text-xs font-bold text-primary hover:underline flex items-center gap-1">
                      {expandDesc ? 'Pokaż mniej' : 'Pokaż więcej'} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expandDesc && "rotate-180")} />
                    </button>
                  )}
                </div>
              )}

              {/* Specifications */}
              {specs.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> Specyfikacje
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {specs.slice(0, 12).map((spec, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{spec.name}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab content: Deals */}
          {activeTab === 'deale' && (
            <div className="space-y-4">
              {deals.length > 0 ? (
                deals.map((deal: any, i: number) => {
                  const dealTitle = getText(deal?.title) || 'Oferta';
                  const dealPrice = formatPrice(deal?.price ?? deal?.legacyPrice);
                  const dealOrigPrice = formatPrice(deal?.originalPrice);
                  const dealTemp = Math.round(deal?.temperature || 0);
                  const dealMerchant = getText(deal?.merchant || deal?.metadata?.merchant || deal?.source || '');
                  const isHot = dealTemp >= 200;

                  return (
                    <Link key={deal.id || i} href={`/${locale}/admin/ux-preview/deal/${deal.id}`}
                      className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                    >
                      {/* Temperature */}
                      <div className={cn("h-14 w-14 flex-shrink-0 rounded-2xl flex flex-col items-center justify-center", isHot ? "bg-gradient-to-b from-red-500 to-orange-400 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400")}>
                        <Zap className="h-4 w-4" />
                        <span className="text-xs font-black">{dealTemp}°</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-primary transition-colors">{dealTitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {dealMerchant && <span className="text-[10px] text-gray-500">{dealMerchant}</span>}
                          {deal?.couponCode && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">KOD: {deal.couponCode}</span>}
                          {deal?.freeShipping && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5"><Truck className="h-3 w-3" /> Gratis</span>}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        {dealPrice && <p className="font-black text-gray-900 dark:text-white">{dealPrice}</p>}
                        {dealOrigPrice && dealOrigPrice !== dealPrice && <p className="text-[10px] text-gray-400 line-through">{dealOrigPrice}</p>}
                      </div>

                      <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-primary flex-shrink-0 transition-colors" />
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-500">Brak aktywnych okazji dla tego produktu</p>
                </div>
              )}
            </div>
          )}

          {/* Tab content: Reviews */}
          {activeTab === 'recenzje' && (
            <div className="space-y-4">
              {/* Rate this product */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white mb-3">Oceń ten produkt</h3>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onClick={() => setUserRating(s)}
                      className="group/star p-1 transition-all hover:scale-110"
                    >
                      <Star className={cn(
                        "h-8 w-8 transition-all",
                        (userRating !== null && s <= userRating) ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600 group-hover/star:text-amber-300"
                      )} />
                    </button>
                  ))}
                  {userRating !== null && (
                    <span className="ml-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                      {userRating}/5 ★
                    </span>
                  )}
                </div>
              </div>

              {/* Recent reviews */}
              {recentRatings.length > 0 ? (
                recentRatings.map((review: any, i: number) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                          {(review?.userName || review?.userId || 'U').substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{review?.userName || 'Użytkownik'}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={cn("h-3.5 w-3.5", s <= (review?.rating || 0) ? "fill-amber-400 text-amber-400" : "text-gray-300")} />
                        ))}
                      </div>
                    </div>
                    {review?.comment && <p className="text-sm text-gray-600 dark:text-gray-400">{review.comment}</p>}
                    {review?.createdAt && <p className="text-[10px] text-gray-400 mt-2">{getRelativeTime(review.createdAt)}</p>}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-500">Brak recenzji — bądź pierwszym!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
