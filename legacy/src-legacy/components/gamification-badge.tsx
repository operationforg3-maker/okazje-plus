'use client';

import { Badge as BadgeUI } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GamificationBadgeProps {
  badgeId: string;
  badgeName: string;
  badgeIcon?: string;
  badgeRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  badgeDescription?: string;
  earnedAt?: string;
  size?: 'sm' | 'md' | 'lg';
}

const rarityColors: Record<string, string> = {
  common: 'bg-gray-500',
  uncommon: 'bg-green-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-amber-500',
};

export function GamificationBadge({ badgeId, badgeName, badgeIcon, badgeRarity = 'common', badgeDescription, earnedAt, size = 'md' }: GamificationBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <BadgeUI
            className={`${rarityColors[badgeRarity] || 'bg-gray-500'} text-white ${sizeClasses[size]} cursor-help`}
          >
            <span className="mr-1">{badgeIcon || '🏆'}</span>
            {badgeName}
          </BadgeUI>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">{badgeName}</p>
            {badgeDescription && <p className="text-sm text-muted-foreground">{badgeDescription}</p>}
            {earnedAt && (
              <p className="text-xs text-muted-foreground">
                Odblokowano: {new Date(earnedAt).toLocaleDateString('pl-PL')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
