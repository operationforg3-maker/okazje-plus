'use client';

/**
 * Expired Deal Badge Component
 * 
 * Replaces "Buy Now" button with disabled "Offer Expired" button
 * when deal is detected as expired by link validator
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExpiredDealBadgeProps {
  isExpired?: boolean;
  reason?: string;
  checkedAt?: string;
  className?: string;
  variant?: 'inline' | 'button';
}

export function ExpiredDealBadge({ 
  isExpired = false, 
  reason = 'Oferta wygasła lub link jest niedostępny',
  checkedAt,
  className = '',
  variant = 'inline'
}: ExpiredDealBadgeProps) {
  if (!isExpired) {
    return null;
  }

  if (variant === 'button') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              disabled 
              variant="outline"
              className={`gap-2 text-muted-foreground ${className}`}
            >
              <Clock className="h-4 w-4" />
              Oferta wygasła
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p>❌ {reason}</p>
              {checkedAt && (
                <p className="text-muted-foreground">
                  Sprawdzono: {new Date(checkedAt).toLocaleString('pl-PL')}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="destructive" 
            className="gap-1"
          >
            <AlertTriangle className="h-3 w-3" />
            Wygasła
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p>{reason}</p>
            {checkedAt && (
              <p className="text-muted-foreground">
                Sprawdzono: {new Date(checkedAt).toLocaleString('pl-PL')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
