'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { withImageProxy } from '@/lib/image-proxy';
import { Flame, Bolt, Zap, Star, ArrowUpRight } from 'lucide-react';

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

export function UXPreviewV3Client({ initialHotDeals, initialTopProducts, categories }: Props) {
  const locale = useLocale();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0a1f 50%, #0a0f1a 100%)' }}>
      {/* Top Banner */}
      <div className="text-center text-xs font-bold tracking-wider uppercase py-2" style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)', color: 'white' }}>
        <Zap className="inline h-3 w-3 mr-1" />
        Propozycja V3 — Dark Mode z neonowymi akcentami
      </div>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-12 pb-8">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider" style={{ borderColor: 'rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.1)', color: '#a78bfa' }}>
            <Zap className="h-3.5 w-3.5" /> Nowa era zakupów
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Okazje+ Dark
          </h1>
          <p style={{ color: '#6b7280' }} className="text-base max-w-lg mx-auto">
            Znajdź najlepsze oferty w nowoczesnym, ciemnym interfejsie. Twoje oczy podziękują.
          </p>
        </div>

        {/* Categories ribbon */}
        <div className="flex gap-2 overflow-x-auto pb-3 justify-center flex-wrap">
          {categories.slice(0, 8).map(cat => (
            <Link
              key={cat.id}
              href={`/${locale}/deals?category=${cat.slug}`}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Deals grid */}
      <section className="container mx-auto px-4 pb-16">
        <div className="flex items-center gap-3 mb-8">
          <div style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)' }} className="p-2 rounded-xl">
            <Flame className="h-5 w-5" style={{ color: '#a78bfa' }} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: '#f3f4f6' }}>Gorące Okazje</h2>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.5), transparent)' }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {initialHotDeals.slice(0, 12).map((deal: any, idx) => {
            const title = getLocalizedText(deal.title, 'Oferta');
            const image = getDealImage(deal);
            const price = formatPrice(deal.price ?? deal.legacyPrice);
            const originalPrice = formatPrice(deal.originalPrice);
            const temp = Math.round(deal.temperature || 0);
            const isHot = temp >= 100;
            const discountPct = deal.originalPrice && deal.price && deal.originalPrice > deal.price
              ? Math.round((deal.originalPrice - deal.price) / deal.originalPrice * 100)
              : null;

            return (
              <Link key={deal.id} href={`/${locale}/admin/ux-preview/deal/${deal.id}`} className="group block">
                <div
                  className="h-full rounded-2xl overflow-hidden flex flex-col transition-all duration-300 group-hover:-translate-y-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={withImageProxy(image)}
                      alt={title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                      loading={idx < 4 ? 'eager' : 'lazy'}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    {isHot && (
                      <span
                        className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)', color: 'white' }}
                      >
                        <Flame className="h-3 w-3" /> {temp}°
                      </span>
                    )}
                    {discountPct && discountPct > 0 && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                        -{discountPct}%
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <h3 className="text-sm font-semibold leading-snug line-clamp-2 transition-colors" style={{ color: '#e5e7eb' }}>
                      {title}
                    </h3>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        {price && (
                          <span className="text-lg font-black" style={{ color: '#a78bfa' }}>{price}</span>
                        )}
                        {originalPrice && originalPrice !== price && (
                          <span className="text-xs ml-2 line-through" style={{ color: '#4b5563' }}>{originalPrice}</span>
                        )}
                      </div>
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                        style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa' }}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Products section */}
      <section className="container mx-auto px-4 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <div style={{ background: 'rgba(236,72,153,0.2)', border: '1px solid rgba(236,72,153,0.4)' }} className="p-2 rounded-xl">
            <Star className="h-5 w-5" style={{ color: '#f472b6' }} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: '#f3f4f6' }}>Polecane Produkty</h2>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(236,72,153,0.5), transparent)' }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {initialTopProducts.slice(0, 6).map((p: any) => {
            const title = getLocalizedText(p.title || p.name, 'Produkt');
            const img = p.image || p.images?.[0] || '/placeholder.png';
            const slug = typeof p.slug === 'string' ? p.slug : p.id;
            const price = formatPrice(p.bestPrice ?? p.price);
            return (
              <Link key={p.id} href={`/${locale}/admin/ux-preview/product/${slug}`} className="group block">
                <div
                  className="rounded-2xl overflow-hidden transition-all group-hover:-translate-y-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-900">
                    <Image src={withImageProxy(img)} alt={title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold line-clamp-2" style={{ color: '#9ca3af' }}>{title}</p>
                    {price && <p className="text-sm font-black mt-1" style={{ color: '#f472b6' }}>{price}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
