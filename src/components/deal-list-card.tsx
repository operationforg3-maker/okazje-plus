import Image from 'next/image';
import Link from 'next/link';
import type { Deal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VoteControls } from '@/components/vote-controls';
import { Flame, Tag, MessageSquare, Clock, ArrowUp, Sparkles } from 'lucide-react';

interface DealListCardProps {
  deal: Deal;
}

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const posted = new Date(isoDate);
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
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
  const original = typeof deal.originalPrice === 'number' ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice) : null;
  const discount = typeof deal.originalPrice === 'number' && deal.originalPrice > 0 ? Math.round(100 - (deal.price / deal.originalPrice) * 100) : null;
  const savings = typeof deal.originalPrice === 'number' && deal.originalPrice > deal.price 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice - deal.price)
    : null;

  const isHot = deal.temperature >= 300;
  const isNew = (() => {
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  })();

  const temperatureColor = deal.temperature >= 500 ? 'from-red-500 to-orange-500' 
    : deal.temperature >= 300 ? 'from-orange-500 to-amber-500'
    : deal.temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((deal.temperature / 500) * 100, 100);

  return (
    <div className="group flex bg-card p-5 rounded-lg border items-stretch gap-6 w-full hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
      <Link href={`/deals/${deal.id}`} className="relative flex-shrink-0 overflow-hidden rounded-md">
        <div className="relative w-40 h-32">
          <Image
            src={deal.image}
            alt={deal.title}
            data-ai-hint={deal.imageHint}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {isHot && (
            <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg text-xs">
              <Flame className="mr-1 h-3 w-3" />
              Hot
            </Badge>
          )}
          {isNew && (
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg text-xs">
              <Sparkles className="mr-1 h-3 w-3" />
              Nowość
            </Badge>
          )}
        </div>
      </Link>
      
      <div className="flex flex-col flex-grow min-w-0 justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/deals/${deal.id}`} className="group/title">
              <h3 className="font-headline text-xl font-semibold group-hover/title:text-primary transition-colors line-clamp-2">
                {deal.title}
              </h3>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getRelativeTime(deal.postedAt)}
            </span>
            <span>przez <span className="font-medium text-foreground">{deal.postedBy}</span></span>
            {(deal.subCategorySlug || deal.mainCategorySlug) && (
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Tag className="h-3 w-3" aria-hidden />
                {deal.subCategorySlug || deal.mainCategorySlug}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {deal.description}
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
            <p className="text-2xl font-bold text-primary">{price}</p>
            {original && (
              <p className="text-base text-muted-foreground line-through">{original}</p>
            )}
            {typeof discount === 'number' && discount > 0 && (
              <Badge variant="destructive">-{discount}%</Badge>
            )}
            {savings && (
              <span className="text-xs font-semibold text-green-600">Oszczędzasz {savings}</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              {deal.voteCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {deal.commentsCount}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 pl-4 border-l">
        <VoteControls dealId={deal.id} initialVoteCount={deal.temperature} />
        <Button asChild size="lg" className="whitespace-nowrap">
          <Link href={deal.link} target="_blank" rel="noopener noreferrer">
            Idź do okazji
          </Link>
        </Button>
      </div>
    </div>
  );
}
