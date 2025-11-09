'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Deal } from '@/lib/types';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useAuth } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Flame, MessageSquare, Tag, TrendingUp, Sparkles, Clock, Heart } from "lucide-react";
import { useState } from 'react';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/use-favorites';
import { trackVote } from '@/lib/analytics';
import ShareButton from '@/components/share-button';

interface DealCardProps {
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

export default function DealCard({ deal }: DealCardProps) {
  const liveComments = useCommentsCount('deals', deal.id, deal.commentsCount);
  const { user } = useAuth();
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(deal.id, 'deal');
  const [temperature, setTemperature] = useState(deal.temperature);
  const [voteCount, setVoteCount] = useState(deal.voteCount);
  const [isVoting, setIsVoting] = useState(false);
  const [userVote, setUserVote] = useState<1 | -1 | null>(null); // Śledzimy głos użytkownika
  
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
  const original = typeof deal.originalPrice === 'number' ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice) : null;
  const discount = typeof deal.originalPrice === 'number' && deal.originalPrice > 0 ? Math.round(100 - (deal.price / deal.originalPrice) * 100) : null;
  const savings = typeof deal.originalPrice === 'number' && deal.originalPrice > deal.price 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice - deal.price)
    : null;

  const isHot = temperature >= 300;
  const isNew = (() => {
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  })();

  const temperatureColor = temperature >= 500 ? 'from-red-500 to-orange-500' 
    : temperature >= 300 ? 'from-orange-500 to-amber-500'
    : temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((temperature / 500) * 100, 100);

  const handleVote = async (action: 'up' | 'down') => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby zagłosować.");
      return;
    }

    // Optimistic update
    const oldTemperature = temperature;
    const oldVoteCount = voteCount;
    const oldUserVote = userVote;
    
    // Oblicz przewidywane zmiany
    let tempDelta = 0;
    let voteDelta = 0;
    const newVoteValue = action === 'up' ? 1 : -1;
    
    if (userVote === null) {
      // Nowy głos
      tempDelta = newVoteValue;
      voteDelta = newVoteValue;
    } else if (userVote === newVoteValue) {
      // Ten sam głos - brak zmian (idempotencja)
      return;
    } else {
      // Zmiana głosu
      tempDelta = newVoteValue - userVote;
      voteDelta = newVoteValue - userVote;
    }

    // Optimistic update UI
    setTemperature(prev => prev + tempDelta);
    setVoteCount(prev => prev + voteDelta);
    setUserVote(newVoteValue);
    setIsVoting(true);

    try {
      const response = await fetch(`/api/deals/${deal.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action,
          userId: user.uid // TYMCZASOWE - w produkcji token w headerze
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Błąd podczas głosowania');
      }

      // Aktualizuj do rzeczywistych wartości z serwera
      setTemperature(data.temperature);
      setVoteCount(data.voteCount);
      setUserVote(data.userVote);
      
      // Analytics
      trackVote('deal', deal.id, action);
      
      toast.success("Dziękujemy za oddanie głosu!");
    } catch (error: any) {
      // Rollback optimistic update
      setTemperature(oldTemperature);
      setVoteCount(oldVoteCount);
      setUserVote(oldUserVote);
      
      toast.error(error.message || "Wystąpił błąd podczas głosowania.");
      console.error('Vote error:', error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="relative p-0">
        <Link href={`/deals/${deal.id}`} className="block overflow-hidden">
          <Image
            src={deal.image}
            alt={deal.title}
            width={600}
            height={400}
            className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-2 top-2 h-8 w-8 rounded-full bg-white/90 shadow-md hover:bg-white hover:scale-110 transition-all"
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite();
          }}
          disabled={isFavoriteLoading}
        >
          <Heart
            className={`h-4 w-4 transition-all ${
              isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'
            }`}
          />
        </Button>
        <div className="absolute right-2 top-2 flex gap-1">
          {isHot && (
            <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg">
              <Flame className="mr-1 h-3 w-3" />
              Hot
            </Badge>
          )}
          {isNew && (
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg">
              <Sparkles className="mr-1 h-3 w-3" />
              Nowość
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {(deal.subCategorySlug || deal.mainCategorySlug) && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3 w-3" aria-hidden />
                {deal.subCategorySlug || deal.mainCategorySlug}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{getRelativeTime(deal.postedAt)}</span>
          </div>
        </div>

        <Link href={`/deals/${deal.id}`}>
          <h3 className="font-headline text-lg font-semibold leading-tight transition-colors hover:text-primary">
            {deal.title}
          </h3>
        </Link>
        
        <p className="text-sm text-muted-foreground line-clamp-2">
          {deal.description}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-bold text-primary">{price}</span>
          {original && <span className="text-sm text-muted-foreground line-through">{original}</span>}
          {typeof discount === 'number' && discount > 0 && (
            <Badge variant="destructive">-{discount}%</Badge>
          )}
          {savings && (
            <span className="ml-auto text-xs font-semibold text-green-600">Oszczędzasz {savings}</span>
          )}
        </div>

        {/* Temperature bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Flame className="h-3 w-3" />
              Temperatura
            </span>
            <span className="font-semibold">{temperature} pkt</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className={`h-full bg-gradient-to-r ${temperatureColor} transition-all duration-500`}
              style={{ width: `${temperaturePercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Dodane przez <span className="font-medium text-foreground">{deal.postedBy}</span></span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" title="Głosy">
              <ArrowUp className="h-3 w-3" />
              {voteCount}
            </span>
            <span className="flex items-center gap-1" title="Komentarze">
              <MessageSquare className="h-3 w-3" />
              {liveComments.count}
            </span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/30 p-3">
        <div className="flex items-center gap-1">
          <Button 
            variant={userVote === 1 ? "default" : "outline"} 
            size="sm" 
            onClick={() => handleVote('up')} 
            aria-label="Głos w górę"
            disabled={isVoting}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button 
            variant={userVote === -1 ? "default" : "outline"} 
            size="sm" 
            onClick={() => handleVote('down')} 
            aria-label="Głos w dół"
            disabled={isVoting}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 flex-1 justify-end">
          <ShareButton 
            type="deal"
            itemId={deal.id}
            title={deal.title}
            url={`/deals/${deal.id}`}
            variant="ghost"
            size="sm"
          />
          <Button asChild size="sm">
            <Link href={`/deals/${deal.id}`}>
              Zobacz szczegóły
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
