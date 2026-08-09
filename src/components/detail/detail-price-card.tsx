'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ShareButton from '@/components/share-button';
import { ExpiredDealBadge } from '@/components/expired-deal-badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  ExternalLink, 
  Copy, 
  Timer, 
  Heart, 
  Scale, 
  ShoppingCart, 
  Check, 
  Flame, 
  ArrowUp,
  MessageSquare
} from 'lucide-react';

interface DetailPriceCardProps {
  id: string;
  itemType: 'deal' | 'product';
  title: string;
  formattedPrice: string;
  formattedOriginal?: string | null;
  formattedSavings?: string | null;
  discount?: number | null;
  couponCode?: string | null;
  expiryTimeRemaining?: string | null;
  isExpired?: boolean;
  expiryReason?: string | null;
  outboundUrl?: string | null;
  temperature?: number;
  userVote?: number | null;
  isVoting?: boolean;
  onVote?: (action: 'up' | 'down') => void;
  isFavorited?: boolean;
  isFavoriteLoading?: boolean;
  onToggleFavorite?: () => void;
  onAddToComparison?: () => void;
  inCart?: boolean;
  onAddToCart?: () => void;
  commentsCount?: number;
  onScrollToComments?: () => void;
}

export function DetailPriceCard({
  id,
  itemType,
  title,
  formattedPrice,
  formattedOriginal,
  formattedSavings,
  discount,
  couponCode,
  expiryTimeRemaining,
  isExpired,
  expiryReason,
  outboundUrl,
  temperature = 0,
  userVote,
  isVoting,
  onVote,
  isFavorited,
  isFavoriteLoading,
  onToggleFavorite,
  onAddToComparison,
  inCart,
  onAddToCart,
  commentsCount = 0,
  onScrollToComments,
}: DetailPriceCardProps) {
  const handleCopyCoupon = () => {
    if (couponCode) {
      navigator.clipboard.writeText(couponCode);
      toast.success('Kod rabatowy skopiowany do schowka!');
    }
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-accent/10 border-border/70 shadow-lg relative overflow-hidden rounded-2xl">
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Price & Discount Section */}
        <div>
          <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">
            Cena i Oszczędność
          </span>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
              {formattedPrice || 'N/A'}
            </div>
            {formattedOriginal && (
              <div className="text-base sm:text-lg text-muted-foreground line-through decoration-muted-foreground/40 font-medium">
                {formattedOriginal}
              </div>
            )}
            {typeof discount === 'number' && discount > 0 && (
              <Badge className="bg-red-500 text-white font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-md shadow-sm">
                -{discount}%
              </Badge>
            )}
          </div>

          {formattedSavings ? (
            <p className="text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-extrabold flex items-center gap-1 mt-1.5">
              <span>Oszczędzasz {formattedSavings}</span>
            </p>
          ) : (
            typeof discount === 'number' && discount > 0 && (
              <p className="text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-extrabold flex items-center gap-1 mt-1.5">
                <span>Zniżka {discount}%</span>
              </p>
            )
          )}
        </div>

        {/* Prominent Coupon Code Box */}
        {couponCode && (
          <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border-2 border-purple-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-purple-900 dark:text-purple-300">Kod rabatowy</p>
              <p className="text-xl font-black font-mono tracking-wider text-purple-700 dark:text-purple-400">{couponCode}</p>
            </div>
            <Button
              onClick={handleCopyCoupon}
              size="sm"
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-sm gap-1.5 text-xs h-9 px-3"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Kopiuj</span>
            </Button>
          </div>
        )}

        {/* Expiry Countdown Timer */}
        {expiryTimeRemaining && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
            <Timer className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">Okazja wygasa za</p>
              <p className="text-sm font-black text-amber-700 dark:text-amber-400">{expiryTimeRemaining}</p>
            </div>
          </div>
        )}

        {/* Main CTA Button */}
        <div>
          {isExpired ? (
            <ExpiredDealBadge
              isExpired={true}
              reason={expiryReason || 'Oferta wygasła'}
              variant="button"
              className="w-full h-12 text-sm font-bold"
            />
          ) : outboundUrl ? (
            <Button
              size="lg"
              asChild
              className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold h-12 text-base shadow-lg shadow-orange-500/30 rounded-xl gap-2 transition-all duration-300 hover:scale-[1.02]"
            >
              <a href={outboundUrl} target="_blank" rel="noopener noreferrer">
                <span>{itemType === 'deal' ? 'Przejdź do okazji' : 'Kup teraz w sklepie'}</span>
                <ArrowUp className="h-4 w-4 rotate-90 stroke-[2.5] animate-bounce" />
              </a>
            </Button>
          ) : (
            <Button size="lg" className="w-full h-12 text-base font-bold rounded-xl" disabled>
              <ExternalLink className="mr-2 h-4 w-4" />
              Brak linku zewnętrznego
            </Button>
          )}
        </div>

        {/* Unified 5 Action Buttons Row (Heart, Scale, Share, Cart, Vote) */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
          {/* Temperature Vote Pill */}
          {onVote && (
            <div className="ux-vote-pill" onClick={(e) => e.stopPropagation()}>
              <button
                className={cn(
                  "flex items-center justify-center transition-all duration-300 font-black text-xs h-6 overflow-hidden px-1.5",
                  userVote === 1 ? "bg-primary text-primary-foreground font-black opacity-100" : "hover:bg-accent",
                  "disabled:opacity-50"
                )}
                style={{ borderRadius: 'var(--ux-radius-btn)' }}
                onClick={() => onVote('up')}
                disabled={isVoting}
                title="Głosuj na +"
              >
                +
              </button>
              <span className="px-2 flex items-center gap-1 font-black text-xs">
                <Flame className="h-4 w-4 shrink-0 animate-pulse text-orange-500 fill-orange-500" />
                <span>{temperature}°</span>
              </span>
              <button
                className={cn(
                  "flex items-center justify-center transition-all duration-300 font-black text-xs h-6 overflow-hidden px-1.5",
                  userVote === -1 ? "bg-red-500 text-white font-black opacity-100" : "hover:bg-accent",
                  "disabled:opacity-50"
                )}
                style={{ borderRadius: 'var(--ux-radius-btn)' }}
                onClick={() => onVote('down')}
                disabled={isVoting}
                title="Głosuj na -"
              >
                -
              </button>
            </div>
          )}

          {/* Comments count link */}
          {onScrollToComments && (
            <button
              onClick={onScrollToComments}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent/50"
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground/70" />
              <span>{commentsCount}</span>
            </button>
          )}

          {/* 4 Action Buttons: Heart, Scale, Share, Cart */}
          <div className="flex items-center gap-1.5 ml-auto">
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className={cn("ux-action-btn", isFavorited && "text-red-500 bg-red-500/10 opacity-100")}
                disabled={isFavoriteLoading}
                title={isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
              >
                <Heart className={cn("h-4 w-4", isFavorited && "fill-current")} />
              </button>
            )}

            {onAddToComparison && (
              <button
                onClick={onAddToComparison}
                className="ux-action-btn"
                title="Porównaj"
              >
                <Scale className="h-4 w-4" />
              </button>
            )}

            <ShareButton
              type={itemType}
              itemId={id}
              title={title}
              url={`/${itemType === 'deal' ? 'deals' : 'products'}/${id}`}
              variant="ghost"
              size="icon"
              className="ux-action-btn"
            />

            {onAddToCart && (
              <button
                onClick={onAddToCart}
                className={cn("ux-action-btn", inCart && "text-emerald-500 bg-emerald-500/10 opacity-100")}
                disabled={inCart}
                title={inCart ? 'Już w koszyku' : 'Dodaj do koszyka'}
              >
                {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
