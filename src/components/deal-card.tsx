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
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from 'react';
import { toast } from 'sonner';

interface DealCardProps {
  deal: Deal;
}

export default function DealCard({ deal }: DealCardProps) {
  const { user } = useAuth();
  const [temperature, setTemperature] = useState(deal.temperature);

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
        <div>
            <span className="font-bold text-foreground text-lg">{deal.price} zł</span>
            {deal.originalPrice && <span className="text-sm text-muted-foreground line-through ml-2">{deal.originalPrice} zł</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleVote(1)}><ArrowUp className="w-5 h-5"/></Button>
          <span className="font-bold text-lg text-destructive">{temperature}°</span>
          <Button variant="ghost" size="icon" onClick={() => handleVote(-1)}><ArrowDown className="w-5 h-5"/></Button>
        </div>
      </CardFooter>
    </Card>
  );
}
