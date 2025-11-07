import Image from 'next/image';
import Link from 'next/link';
import type { Deal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { VoteControls } from '@/components/vote-controls';
import { Flame, Tag, MessageSquare } from 'lucide-react';

interface DealListCardProps {
  deal: Deal;
}

export default function DealListCard({ deal }: DealListCardProps) {
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
  const original = typeof deal.originalPrice === 'number' ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice) : null;
  const discount = typeof deal.originalPrice === 'number' && deal.originalPrice > 0 ? Math.round(100 - (deal.price / deal.originalPrice) * 100) : null;
  return (
    <div className="flex bg-card p-4 rounded-lg border items-center gap-6 w-full hover:shadow-md transition-shadow">
      <Link href={`/deals/${deal.id}`} className="flex-shrink-0">
        <div className="relative w-28 h-28">
          <Image
            src={deal.image}
            alt={deal.title}
            fill
            className="object-cover rounded-md"
          />
        </div>
      </Link>
      <div className="flex-grow">
        <Link href={`/deals/${deal.id}`} className="group">
            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{deal.title}</h3>
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Dodane przez <span className="font-medium">{deal.postedBy}</span></span>
          {(deal.subCategorySlug || deal.mainCategorySlug) && (
            <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" aria-hidden />{deal.subCategorySlug || deal.mainCategorySlug}</span>
          )}
          <span className="inline-flex items-center gap-1" aria-label="Temperatura"><Flame className="h-3 w-3" />{deal.temperature} pkt</span>
          <span className="inline-flex items-center gap-1" aria-label="Komentarze"><MessageSquare className="h-3 w-3" />{deal.commentsCount}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-primary">{price}</p>
            {original && (
                <p className="text-md text-muted-foreground line-through">{original}</p>
            )}
            {typeof discount === 'number' && discount > 0 && (
              <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">-{discount}%</span>
            )}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-4 w-32">
        <VoteControls dealId={deal.id} initialVoteCount={deal.temperature} />
      </div>
      <Button asChild size="lg" className="self-center">
        <Link href={deal.link} target="_blank" rel="noopener noreferrer">
          Idź do okazji
        </Link>
      </Button>
    </div>
  );
}
