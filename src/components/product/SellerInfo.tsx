'use client';

import { Seller } from '@/lib/schema';
import { Star, Users, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SellerInfoProps {
  seller?: Seller;
  compact?: boolean;
}

export function SellerInfo({ seller, compact = false }: SellerInfoProps) {
  if (!seller) return null;
  
  const { name, rating, score, followers, storeUrl, positiveRate } = seller;
  
  // Render stars
  const renderStars = () => {
    const stars = [];
    const starRating = rating ?? score ?? 0; // M6+: Use score as fallback
    const fullStars = Math.floor(starRating);
    const hasHalfStar = starRating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />
        );
      } else {
        stars.push(
          <Star key={i} className="h-4 w-4 text-gray-300" />
        );
      }
    }
    
    return stars;
  };
  
  // Compact version for cards
  if (compact) {
    const starRating = rating ?? score ?? 0;
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-gray-900">{name}</span>
        <div className="flex items-center gap-0.5">
          {renderStars()}
        </div>
        <span>({starRating.toFixed(1)})</span>
        {positiveRate && <span className="text-xs text-green-600">• {positiveRate}</span>}
      </div>
    );
  }
  
  // Full version for product pages
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold">Sprzedawca</h3>
      
      <div className="space-y-3">
        {/* Seller Name */}
        <div>
          <p className="text-lg font-semibold text-gray-900">{name}</p>
          {storeUrl && (
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto"
              asChild
            >
              <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                Odwiedź sklep
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
        
        {/* Rating */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Ocena sprzedawcy</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {renderStars()}
            </div>
            <span className="text-sm font-medium">
              {(rating ?? score ?? 0).toFixed(1)} / 5.0
            </span>
          </div>
        </div>
        
        {/* M6+: Positive Rate - Trust Badge */}
        {positiveRate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-green-700">
              ✓ {positiveRate} pozytywnych opinii
            </p>
          </div>
        )}
        
        {/* Followers */}
        {followers !== undefined && followers > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {followers >= 1000 
                ? `${(followers / 1000).toFixed(1)}k obserwujących`
                : `${followers} obserwujących`
              }
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
