'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Deal } from '@/lib/types';
import { voteOnDeal } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Flame, MessageSquare, Tag } from "lucide-react";
import { useState } from 'react';
import { toast } from 'sonner';

interface DealCardProps {
  deal: Deal;
}

export default function DealCard({ deal }: DealCardProps) {
  const { user } = useAuth();
  const [temperature, setTemperature] = useState(deal.temperature);
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
  const original = typeof deal.originalPrice === 'number' ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice) : null;
  const discount = typeof deal.originalPrice === 'number' && deal.originalPrice > 0 ? Math.round(100 - (deal.price / deal.originalPrice) * 100) : null;

  const handleVote = async (vote: 1 | -1) => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby zagłosować.");
      return;
    }
    try {
      await voteOnDeal(deal.id, user.uid, vote);
      setTemperature(temp => temp + vote);
      toast.success("Dziękujemy za oddanie głosu!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="p-0">
        <Link href={`/deals/${deal.id}`} className="block overflow-hidden">
          <Image
            src={deal.image}
            alt={deal.title}
            width={600}
            height={400}
            className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          {(deal.subCategorySlug || deal.mainCategorySlug) && (
            <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" aria-hidden />{deal.subCategorySlug || deal.mainCategorySlug}</span>
          )}
        </div>
        <Link href={`/deals/${deal.id}`}>
          <h3 className="font-headline text-lg font-semibold leading-tight hover:text-primary transition-colors">
            {deal.title}
          </h3>
        </Link>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {deal.description}
        </p>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0">
        <div className="flex items-end gap-2">
          <span className="font-bold text-foreground text-lg">{price}</span>
          {original && <span className="text-sm text-muted-foreground line-through">{original}</span>}
          {typeof discount === 'number' && discount > 0 && (
            <span className="ml-2 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">-{discount}%</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-amber-600" aria-label="Temperatura okazji">
            <Flame className="w-4 h-4" />
            <span className="font-bold text-sm">{temperature} pkt</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground" aria-label="Liczba komentarzy">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">{deal.commentsCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleVote(1)} aria-label="Głos w górę"><ArrowUp className="w-5 h-5"/></Button>
            <Button variant="ghost" size="icon" onClick={() => handleVote(-1)} aria-label="Głos w dół"><ArrowDown className="w-5 h-5"/></Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
