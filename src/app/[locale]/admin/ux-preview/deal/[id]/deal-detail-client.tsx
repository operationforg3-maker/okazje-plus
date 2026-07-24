'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { withImageProxy } from '@/lib/image-proxy';
import { cn } from '@/lib/utils';
import {
  Flame, ExternalLink, Copy, Heart, Share2, ArrowLeft, Clock, Tag,
  ChevronLeft, ChevronRight, CheckCircle2, Gift, Wallet, AlertCircle,
  Package, Truck, Users, MessageSquare, ThumbsUp, ThumbsDown, Star,
  ShieldCheck, Zap, ArrowUpRight, TrendingUp, ChevronDown
} from 'lucide-react';
import { DealCard as UXRedesignDealCard } from '@/components/ux-redesign/deal-card';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getText(value: any): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    return (value.pl || value.en || value.de || '').trim();
  }
  return '';
}

function getDealImage(deal: any): string {
  const candidates = [deal?.image, deal?.imageUrl, deal?.mainImage, deal?.thumbnail, deal?.metadata?.image];
  for (const c of candidates) if (typeof c === 'string' && c.trim()) return c.trim();
  return '/icon_okazjeplus.svg';
}

function getGallery(deal: any): string[] {
  const mainImg = getDealImage(deal);
  if (Array.isArray(deal?.gallery) && deal.gallery.length > 0) {
    const imgs = deal.gallery
      .map((item: any) => typeof item === 'string' ? item : (item?.src || item?.url || ''))
      .filter(Boolean);
    if (imgs.length > 0) return imgs;
  }
  return [mainImg];
}

function formatPrice(v: any, currency = 'PLN'): string | null {
  const n = typeof v === 'number' ? v
    : typeof v === 'object' && v?.amount ? v.amount
    : parseFloat(String(v || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (isNaN(n) || n <= 0) return null;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(n);
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  return `${Math.floor(days / 7)} tyg. temu`;
}

function getTimeRemaining(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

const DEAL_TYPES: Record<string, { label: string; color: string; icon: any }> = {
  sale: { label: 'Wyprzedaż', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Tag },
  coupon: { label: 'Kod rabatowy', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Tag },
  freebie: { label: 'Gratis', color: 'bg-green-100 text-green-700 border-green-200', icon: Gift },
  'pricing-error': { label: 'Błąd cenowy', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  cashback: { label: 'Cashback', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Wallet },
  bundle: { label: 'Zestaw', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Package },
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  deal: any;
  product: any;
  relatedDeals: any[];
}

export function UXPreviewDealDetailClient({ deal, product, relatedDeals }: Props) {
  const locale = useLocale();
  const [currentImg, setCurrentImg] = useState(0);
  const [temperature, setTemperature] = useState(Math.round(deal?.temperature || 0));
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);

  const title = getText(deal?.title) || 'Oferta';
  const description = getText(deal?.description) || getText(deal?.metadata?.offerSummary) || '';
  const gallery = getGallery(deal);
  const price = formatPrice(deal?.price ?? deal?.legacyPrice);
  const originalPrice = formatPrice(deal?.originalPrice);
  const currency = (deal?.price?.currency || 'PLN').toUpperCase();
  const merchant = getText(deal?.merchant || deal?.metadata?.merchant || deal?.source || '');
  const postedAt = deal?.postedAt ? getRelativeTime(deal.postedAt) : '';
  const timeRemaining = deal?.expiryDate ? getTimeRemaining(deal.expiryDate) : null;
  const commentsCount = deal?.commentsCount ?? 0;
  const dealType = deal?.dealType ? DEAL_TYPES[deal.dealType] : null;
  const isHot = temperature >= 200;
  const isFree = deal?.price === 0 || deal?.dealType === 'freebie';

  const discountPct = deal?.originalPrice && deal?.price != null
    ? Math.round(((deal.originalPrice - (typeof deal.price === 'number' ? deal.price : deal.price?.amount || 0)) / deal.originalPrice) * 100)
    : null;

  const temperaturePct = Math.min((temperature / 500) * 100, 100);

  const handleVote = (dir: 'up' | 'down') => {
    if (userVote === dir) return;
    setTemperature(prev => prev + (dir === 'up' ? 1 : -1));
    setUserVote(dir);
  };

  const copyCoupon = () => {
    if (deal?.couponCode) {
      navigator.clipboard.writeText(deal.couponCode).catch(() => {});
      setCopiedCoupon(true);
      setTimeout(() => setCopiedCoupon(false), 2000);
    }
  };

  const tags: string[] = Array.isArray(deal?.tags) ? deal.tags.slice(0, 6) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-6 max-w-6xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
          <Link href={`/${locale}/admin/ux-preview`} className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> UX Preview
          </Link>
          <span>/</span>
          {deal?.mainCategorySlug && (
            <>
              <span className="capitalize">{deal.mainCategorySlug}</span>
              <span>/</span>
            </>
          )}
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
                className="object-contain p-4"
                priority
              />

              {/* Badges over image */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {dealType && (
                  <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border", dealType.color)}>
                    <dealType.icon className="h-3.5 w-3.5" />
                    {dealType.label}
                  </span>
                )}
                {discountPct && discountPct > 0 && (
                  <span className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-black">
                    -{discountPct}%
                  </span>
                )}
                {isFree && (
                  <span className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5" /> GRATIS
                  </span>
                )}
              </div>

              {/* Verified badge */}
              {deal?.verified && (
                <div className="absolute top-4 right-4">
                  <span className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                    <ShieldCheck className="h-3.5 w-3.5" /> Zweryfikowana
                  </span>
                </div>
              )}

              {/* Gallery nav */}
              {gallery.length > 1 && (
                <>
                  <button onClick={() => setCurrentImg(i => (i - 1 + gallery.length) % gallery.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-md hover:bg-white transition-all">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setCurrentImg(i => (i + 1) % gallery.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-md hover:bg-white transition-all">
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

            {/* Store/merchant info */}
            {merchant && (
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                  {merchant.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{merchant}</p>
                  <p className="text-xs text-gray-500">Sprzedawca</p>
                </div>
                {deal?.freeShipping && (
                  <div className="ml-auto flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                    <Truck className="h-4 w-4" /> Darmowa dostawa
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Deal Info ── */}
          <div className="space-y-5">
            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight">{title}</h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {postedAt && (
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {postedAt}</span>
              )}
              {timeRemaining && (
                <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 px-2.5 py-1 rounded-full font-bold">
                  <Clock className="h-3.5 w-3.5" /> Kończy się: {timeRemaining}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> {commentsCount} komentarzy
              </span>
              {deal?.views && (
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {deal.views.toLocaleString()} wyświetleń</span>
              )}
            </div>

            {/* Price block */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-3">
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-gray-900 dark:text-white">
                  {isFree ? 'GRATIS' : (price || 'Sprawdź cenę')}
                </span>
                {originalPrice && originalPrice !== price && (
                  <span className="text-lg text-gray-400 line-through mb-0.5">{originalPrice}</span>
                )}
                {discountPct && discountPct > 0 && (
                  <span className="mb-0.5 bg-red-500 text-white text-sm font-black px-2.5 py-1 rounded-lg">
                    Oszczędzasz {discountPct}%
                  </span>
                )}
              </div>

              {/* Coupon code */}
              {deal?.couponCode && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                  <Tag className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <code className="text-sm font-black text-purple-700 dark:text-purple-300 tracking-widest flex-1">
                    {deal.couponCode}
                  </code>
                  <button
                    onClick={copyCoupon}
                    className="flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    {copiedCoupon ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    {copiedCoupon ? 'Skopiowano!' : 'Kopiuj'}
                  </button>
                </div>
              )}

              {/* Min order */}
              {deal?.minOrderValue && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Minimalne zamówienie: {formatPrice(deal.minOrderValue) || `${deal.minOrderValue} PLN`}
                </p>
              )}

              {/* CTA Button */}
              <a
                href={deal?.link || deal?.affiliateLink || deal?.sourceUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-extrabold text-base py-3.5 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                <ExternalLink className="h-5 w-5" />
                {isFree ? 'Odbierz gratis' : 'Przejdź do oferty'}
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsFavorited(!isFavorited)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all",
                    isFavorited
                      ? "bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                  )}
                >
                  <Heart className={cn("h-4 w-4", isFavorited && "fill-rose-500")} />
                  {isFavorited ? 'Zapisano' : 'Zapisz'}
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <Share2 className="h-4 w-4" /> Udostępnij
                </button>
              </div>
            </div>

            {/* ── Temperature Bar + Voting ── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className={cn("h-5 w-5", isHot ? "text-orange-500" : "text-gray-400")} />
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300">Temperatura okazji</span>
                </div>
                <span className={cn(
                  "text-2xl font-black",
                  temperature >= 400 ? "text-red-500" : temperature >= 200 ? "text-orange-500" : temperature >= 100 ? "text-amber-500" : "text-gray-500"
                )}>
                  {temperature}°
                </span>
              </div>

              {/* Temperature bar */}
              <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    temperature >= 400 ? "bg-gradient-to-r from-red-500 to-orange-400"
                    : temperature >= 200 ? "bg-gradient-to-r from-orange-500 to-amber-400"
                    : "bg-gradient-to-r from-amber-400 to-yellow-400"
                  )}
                  style={{ width: `${Math.max(temperaturePct, 3)}%` }}
                />
              </div>

              {/* Voting buttons */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">Czy to dobra okazja?</span>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => handleVote('up')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                      userVote === 'up'
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                        : "border border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:text-orange-600"
                    )}
                  >
                    <Flame className="h-4 w-4" /> Gorące!
                  </button>
                  <button
                    onClick={() => handleVote('down')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                      userVote === 'down'
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                        : "border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600"
                    )}
                  >
                    <ThumbsDown className="h-4 w-4" /> Zimne
                  </button>
                </div>
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium border border-gray-200 dark:border-gray-700">
                    <Tag className="h-3 w-3" /> {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Description ── */}
        {description && (
          <div className="mb-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h2 className="font-extrabold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Opis okazji
            </h2>
            <div className={cn("text-sm text-gray-600 dark:text-gray-400 leading-relaxed", !expandDesc && "line-clamp-4")}>
              {description}
            </div>
            {description.length > 300 && (
              <button
                onClick={() => setExpandDesc(!expandDesc)}
                className="mt-3 text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                {expandDesc ? 'Pokaż mniej' : 'Pokaż więcej'}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expandDesc && "rotate-180")} />
              </button>
            )}
          </div>
        )}

        {/* ── Conditions / Requirements ── */}
        {Array.isArray(deal?.conditions) && deal.conditions.length > 0 && (
          <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-6">
            <h2 className="font-extrabold text-base text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
              <AlertCircle className="h-4.5 w-4.5" /> Warunki oferty
            </h2>
            <ul className="space-y-2">
              {deal.conditions.map((c: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Linked Product ── */}
        {product && (
          <div className="mb-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h2 className="font-extrabold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Powiązany produkt
            </h2>
            <Link
              href={`/${locale}/admin/ux-preview/product/${typeof product.slug === 'string' ? product.slug : (product.id || '')}`}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
            >
              {product.image && (
                <div className="h-20 w-20 rounded-xl overflow-hidden flex-shrink-0 relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <Image src={withImageProxy(product.image)} alt={getText(product.title || product.name)} fill className="object-contain p-1" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors line-clamp-2">
                  {getText(product.title || product.name)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {product.mainCategorySlug && <span className="capitalize">{product.mainCategorySlug}</span>}
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors flex-shrink-0" />
            </Link>
          </div>
        )}

        {/* ── Related Deals ── */}
        {relatedDeals.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-extrabold text-xl text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Podobne okazje
              </h2>
              <Link href={`/${locale}/admin/ux-preview/deals`} className="text-sm font-bold text-primary hover:underline">
                Wszystkie →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {relatedDeals.slice(0, 3).map((d: any) => (
                <UXRedesignDealCard key={d.id} deal={d} previewMode />
              ))}
            </div>
          </div>
        )}

        {/* ── Discussion placeholder ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h2 className="font-extrabold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Dyskusja ({commentsCount})
          </h2>
          <div className="text-center py-10 text-gray-400 dark:text-gray-600">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Zaloguj się, aby dołączyć do dyskusji</p>
            <button className="mt-4 bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-all">
              Zaloguj się
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
