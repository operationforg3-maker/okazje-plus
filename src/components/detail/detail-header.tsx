'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CategoryBreadcrumb } from '@/components/category-breadcrumb';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
import { 
  ChevronRight, 
  Clock, 
  User, 
  Tag, 
  Star, 
  Store, 
  ShieldCheck 
} from 'lucide-react';

interface DetailHeaderProps {
  locale: string;
  itemType: 'deal' | 'product';
  id: string;
  title: string;
  mainCategorySlug?: string | null;
  subCategorySlug?: string | null;
  subSubCategorySlug?: string | null;
  postedBy?: string | null;
  relativeTime?: string | null;
  merchant?: string | null;
  rating?: number | null;
  dealTypeLabel?: string | null;
  dealTypeColor?: string | null;
  status?: string | null;
  productId?: string | null;
}

export function DetailHeader({
  locale,
  itemType,
  id,
  title,
  mainCategorySlug,
  subCategorySlug,
  subSubCategorySlug,
  postedBy,
  relativeTime,
  merchant,
  rating,
  dealTypeLabel,
  dealTypeColor,
  status,
  productId,
}: DetailHeaderProps) {
  const categoryLabel = subSubCategorySlug || subCategorySlug || mainCategorySlug;

  return (
    <div className="space-y-3">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs md:text-sm text-muted-foreground overflow-x-auto scrollbar-none">
        <Link href={`/${locale}`} className="hover:text-primary transition-colors whitespace-nowrap">
          Strona główna
        </Link>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        <Link
          href={`/${locale}/${itemType === 'deal' ? 'deals' : 'products'}`}
          className="hover:text-primary transition-colors whitespace-nowrap"
        >
          {itemType === 'deal' ? 'Okazje' : 'Produkty'}
        </Link>

        {mainCategorySlug && (
          <>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <CategoryBreadcrumb
              mainCategorySlug={mainCategorySlug}
              subCategorySlug={subCategorySlug || undefined}
              subSubCategorySlug={subSubCategorySlug || undefined}
              contextType={itemType === 'deal' ? 'deals' : 'products'}
              className="pl-0"
            />
          </>
        )}

        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium text-foreground truncate max-w-[180px] sm:max-w-[240px]">
          {title}
        </span>
      </div>

      {/* Category Badges & Deal Types */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {categoryLabel && (
          <Badge variant="secondary" className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5">
            <Tag className="h-3 w-3" />
            {categoryLabel}
          </Badge>
        )}
        {dealTypeLabel && (
          <Badge className={`${dealTypeColor || 'bg-purple-600'} text-white text-xs font-bold px-2.5 py-0.5`}>
            {dealTypeLabel}
          </Badge>
        )}
        {status === 'approved' && (
          <Badge variant="outline" className="flex items-center gap-1 text-emerald-600 border-emerald-600/40 bg-emerald-500/10 text-xs font-bold px-2 py-0.5">
            <ShieldCheck className="h-3 w-3" />
            Zatwierdzone
          </Badge>
        )}
      </div>

      {/* Title & Admin Quick Actions */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-headline text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-tight break-words flex-1">
          {title}
        </h1>
        <AdminQuickActions
          productId={productId || id}
          itemType={itemType}
          className="mt-1 flex-shrink-0"
        />
      </div>

      {/* Meta Info Bar */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground pt-1 pb-2 border-b border-border/40">
        {postedBy && (
          <div className="flex items-center gap-1.5 font-medium">
            <User className="h-4 w-4 text-muted-foreground/70" />
            <span>Dodał: <span className="font-bold text-foreground">{postedBy}</span></span>
          </div>
        )}
        {relativeTime && (
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="h-4 w-4 text-muted-foreground/70" />
            <span>{relativeTime}</span>
          </div>
        )}
        {merchant && (
          <div className="flex items-center gap-1.5 font-semibold text-foreground bg-accent/50 px-2 py-0.5 rounded-md border border-border/30">
            <Store className="h-3.5 w-3.5 text-primary" />
            <span>{merchant}</span>
          </div>
        )}
        {typeof rating === 'number' && rating > 0 && (
          <div className="flex items-center gap-1 text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>{rating.toFixed(1)} / 5</span>
          </div>
        )}
      </div>
    </div>
  );
}
