'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UserLevelBadgeProps {
  level: number;
  points: number;
  size?: 'sm' | 'md' | 'lg';
}

export function UserLevelBadge({ level, points, size = 'md' }: UserLevelBadgeProps) {
  const getLevelColor = (lvl: number) => {
    if (lvl >= 10) return 'bg-gradient-to-r from-amber-500 to-orange-500';
    if (lvl >= 7) return 'bg-gradient-to-r from-purple-500 to-pink-500';
    if (lvl >= 5) return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    return 'bg-gradient-to-r from-gray-500 to-gray-600';
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`${getLevelColor(level)} text-white ${sizeClasses[size]} cursor-help font-bold`}
          >
            ⚡ Level {level}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">Poziom {level}</p>
            <p className="text-sm">{points} punktów</p>
            {level < 10 && (
              <p className="text-xs text-muted-foreground">
                Kolejny poziom: {[100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000][level] || 30000} pkt
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
