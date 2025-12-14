'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Category } from '@/lib/types';
import { ChevronRight, Grid3x3, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryGridProps {
  categories: Category[];
}

// Category colors and gradients for better visual variety
const CATEGORY_STYLES = [
  { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-200', accent: 'text-blue-600' },
  { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-200', accent: 'text-purple-600' },
  { bg: 'from-orange-500/20 to-red-500/20', border: 'border-orange-200', accent: 'text-orange-600' },
  { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-200', accent: 'text-green-600' },
  { bg: 'from-red-500/20 to-pink-500/20', border: 'border-red-200', accent: 'text-red-600' },
  { bg: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-200', accent: 'text-indigo-600' },
  { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-200', accent: 'text-amber-600' },
  { bg: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-200', accent: 'text-teal-600' },
];

// Sample images for categories (usando Unsplash URLs)
const CATEGORY_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop', // Electronics
  'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=400&h=300&fit=crop', // Fashion
  'https://images.unsplash.com/photo-1505695546585-ceb366acda3f?w=400&h=300&fit=crop', // Shoes
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop', // Sports
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop', // Home
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop', // Beauty
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop', // Toys
  'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400&h=300&fit=crop', // Books
];

export default function CategoryGrid({ categories }: CategoryGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="w-full space-y-6">
      {/* Main Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.slice(0, 12).map((category, idx) => {
          const style = CATEGORY_STYLES[idx % CATEGORY_STYLES.length];
          const imageUrl = CATEGORY_IMAGES[idx % CATEGORY_IMAGES.length];

          return (
            <Link
              key={category.id}
              href={`/products?category=${category.slug || category.id}`}
              className="group"
              onMouseEnter={() => setHoveredId(category.id || null)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                className={cn(
                  'relative h-72 rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer',
                  style.border,
                  hoveredId === category.id ? `bg-gradient-to-br ${style.bg}` : 'bg-card/50'
                )}
              >
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300">
                  <Image
                    src={imageUrl}
                    alt={category.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>

                {/* Content */}
                <div className="relative h-full flex flex-col justify-between p-6">
                  {/* Top Section - Icon & Count */}
                  <div>
                    <div className={cn('mb-4 transition-transform duration-200 group-hover:scale-110')}>
                      {category.icon ? (
                        <span className="text-5xl">{category.icon}</span>
                      ) : (
                        <Package className="h-12 w-12 text-primary" />
                      )}
                    </div>
                    <div className={cn('text-4xl font-headline font-bold leading-tight transition-colors duration-300', hoveredId === category.id ? style.accent : 'text-foreground')}>
                      {category.name}
                    </div>
                  </div>

                  {/* Bottom Section - Subcategories Count & Arrow */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div className="text-sm text-muted-foreground">
                      {category.subcategories?.length || 0} podkategorii
                    </div>
                    <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Mega Menu - Expandable Category Details */}
      {categories.length > 12 && (
        <div className="mt-8 p-6 bg-card/50 rounded-2xl border-2 border-border hover:border-primary/30 transition-all">
          <button
            onClick={() => setExpandedId(expandedId ? null : 'all')}
            className="w-full flex items-center justify-between text-lg font-semibold hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Grid3x3 className="h-5 w-5" />
              Wszystkie kategorie ({categories.length})
            </div>
            <ChevronRight className={cn('h-5 w-5 transition-transform duration-300', expandedId === 'all' && 'rotate-90')} />
          </button>

          {expandedId === 'all' && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${category.slug || category.id}`}
                  className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {category.icon ? (
                      <span className="text-2xl">{category.icon}</span>
                    ) : (
                      <Package className="h-6 w-6 text-primary" />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                        {category.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {category.subcategories?.length || 0} poz.
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
