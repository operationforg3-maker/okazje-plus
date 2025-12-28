import Image from 'next/image';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import type { Deal } from '@/lib/types';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VoteControls } from '@/components/vote-controls';
import { Flame, Tag, MessageSquare, Clock, ArrowUp, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import AdminEditButton from '@/components/admin/admin-edit-button';
import DealEditDialog from '@/components/admin/deal-edit-dialog';

interface DealListCardProps {
  deal: Deal;
}

const safeText = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

function toTimestampSafe(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const n = Date.parse(value);
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof value === 'object') {
    try {
      if (typeof (value as any).toDate === 'function') {
        return (value as any).toDate().getTime();
      }
      if (typeof (value as any).seconds === 'number') {
        return ((value as any).seconds * 1000) + Math.floor(((value as any).nanoseconds || 0) / 1e6);
      }
    } catch {}
  }
  return 0;
}

function getRelativeTime(when: any): string {
  const now = new Date();
  const ts = toTimestampSafe(when);
  const posted = ts ? new Date(ts) : new Date(0);
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 60) return `${diffMinutes} min temu`;
  if (diffHours < 24) return `${diffHours} godz. temu`;
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg. temu`;
  return `${Math.floor(diffDays / 30)} mies. temu`;
}

export default function DealListCard({ deal }: DealListCardProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  const liveComments = useCommentsCount('deals', deal.id, deal.commentsCount);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [dealData, setDealData] = useState<{
    isNew: boolean;
    relativeTime: string;
    formattedPrice: string | null;
    formattedOriginal: string | null;
    formattedSavings: string | null;
    discount: number | null;
  }>({
    isNew: false,
    relativeTime: '',
    formattedPrice: null,
    formattedOriginal: null,
    formattedSavings: null,
    discount: null,
  });
  
  const description = safeText(deal.description);
  const categoryLabel = safeText(deal.subCategorySlug || deal.mainCategorySlug);
  const postedBy = safeText(deal.postedBy, 'Użytkownik');

  const isHot = deal.temperature >= 300;

  const temperatureColor = deal.temperature >= 500 ? 'from-red-500 to-orange-500' 
    : deal.temperature >= 300 ? 'from-orange-500 to-amber-500'
    : deal.temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((deal.temperature / 500) * 100, 100);

  // Initialize time-dependent values and format prices on client to fix hydration mismatch
  useEffect(() => {
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    const isNewDeal = diffDays <= 7;
    
    const relTime = getRelativeTime(deal.postedAt);
    
    // Format prices using unified currency system
    import('@/lib/unified-currency').then(({ CurrencyManager }) => {
      const safePrice = typeof deal.price === 'number' ? deal.price : Number(deal.price) || 0;
      const userCurrency = (typeof window !== 'undefined' ? localStorage.getItem('preferredCurrency') : null) as any || 'PLN';
      const formatted = CurrencyManager.formatPrice(safePrice, userCurrency);
      
      let formattedOrig: string | null = null;
      let calculatedDiscount: number | null = null;
      let savings: string | null = null;
      
      if (typeof deal.originalPrice === 'number') {
        formattedOrig = CurrencyManager.formatPrice(deal.originalPrice, userCurrency);
        
        if (deal.originalPrice > 0) {
          calculatedDiscount = Math.round(100 - (deal.price / deal.originalPrice) * 100);
        }
        
        if (deal.originalPrice > deal.price) {
          savings = CurrencyManager.formatPrice(deal.originalPrice - deal.price, userCurrency);
        }
      }
      
      setDealData({
        isNew: isNewDeal,
        relativeTime: relTime,
        formattedPrice: formatted,
        formattedOriginal: formattedOrig,
        formattedSavings: savings,
        discount: calculatedDiscount,
      });
    }).catch(console.error);
  }, [deal.postedAt, deal.price, deal.originalPrice]);

  return (
    <div className="group flex bg-card p-5 rounded-lg border items-stretch gap-6 w-full hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
  <Link href={`${prefix}/deals/${deal.id}`} className="relative flex-shrink-0 overflow-hidden rounded-md">
        <div className="relative w-40 h-32 bg-muted">
          <Image
            src={typeof deal.image === 'string' ? deal.image : '/placeholder.png'}
            alt={safeText(deal.title) || 'Okazja'}
            data-ai-hint={safeText(deal.imageHint)}
            fill
            sizes="160px"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {isHot && (
            <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg text-xs">
              <Flame className="mr-1 h-3 w-3" />
              Hot
            </Badge>
          )}
          {dealData.isNew && (
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg text-xs">
              <Sparkles className="mr-1 h-3 w-3" />
              Nowość
            </Badge>
          )}
        </div>
        
        {/* Admin Edit Button - prawy dolny róg obrazka */}
        <div className="absolute right-2 bottom-2">
          <AdminEditButton
            onClick={() => setEditDialogOpen(true)}
            className="h-8 w-8 rounded-full bg-white/90 shadow-md hover:bg-white"
            tooltip="Edytuj deal (admin)"
          />
        </div>
      </Link>
      
      {/* Edit Dialog */}
      <DealEditDialog
        deal={deal}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      
      <div className="flex flex-col flex-grow min-w-0 justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Link href={`${prefix}/deals/${deal.id}`} className="group/title">
              <h3 className="font-headline text-xl font-semibold group-hover/title:text-primary transition-colors line-clamp-2">
                {safeText(deal.title)}
              </h3>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dealData.relativeTime}
            </span>
            <span>przez <span className="font-medium text-foreground">{postedBy}</span></span>
            {categoryLabel && (
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Tag className="h-3 w-3" aria-hidden />
                {categoryLabel}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>

          {/* Temperature bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Flame className="h-3 w-3" />
                Temperatura
              </span>
              <span className="font-semibold">{deal.temperature} pkt</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div 
                className={`h-full bg-gradient-to-r ${temperatureColor} transition-all duration-500`}
                style={{ width: `${temperaturePercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl font-bold text-primary">{dealData.formattedPrice || 'N/A'}</p>
            {dealData.formattedOriginal && (
              <p className="text-base text-muted-foreground line-through">{dealData.formattedOriginal}</p>
            )}
            {typeof dealData.discount === 'number' && dealData.discount > 0 && (
              <Badge variant="destructive">-{dealData.discount}%</Badge>
            )}
            {dealData.formattedSavings && (
              <span className="text-xs font-semibold text-green-600">Oszczędzasz {dealData.formattedSavings}</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1" title="Głosy">
              <ArrowUp className="h-3 w-3" />
              {typeof deal.voteCount === 'number' ? deal.voteCount : 0}
            </span>
            <span className="flex items-center gap-1" title="Komentarze">
              <MessageSquare className="h-3 w-3" />
              {liveComments.count}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 pl-4 border-l">
        <VoteControls dealId={deal.id} initialVoteCount={deal.temperature} />
        <Button asChild size="lg" className="whitespace-nowrap">
          <Link href={typeof deal.link === 'string' ? deal.link : '#'} target="_blank" rel="noopener noreferrer">
            Idź do okazji
          </Link>
        </Button>
      </div>
    </div>
  );
}
