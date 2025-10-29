import Image from 'next/image';
import Link from 'next/link';
import type { Deal } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface DealListCardProps {
  deal: Deal;
}

export default function DealListCard({ deal }: DealListCardProps) {
  const temperatureColor = deal.temperature >= 0 ? 'text-red-500' : 'text-blue-500';

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
        <p className="text-sm text-muted-foreground mt-1">
          Dodane przez <span className="font-medium">{deal.author}</span>
        </p>
        <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-primary">{new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price)}</p>
            {deal.originalPrice && (
                <p className="text-md text-muted-foreground line-through">{new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice)}</p>
            )}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-4 w-32">
        <span className={`font-bold text-3xl ${temperatureColor}`}>{deal.temperature}°</span>
      </div>
      <Button asChild size="lg" className="self-center">
        <Link href={deal.link} target="_blank" rel="noopener noreferrer">
          Idź do okazji
        </Link>
      </Button>
    </div>
  );
}
