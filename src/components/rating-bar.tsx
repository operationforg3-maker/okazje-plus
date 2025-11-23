import { Star } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RatingBarProps {
  editorial?: { average: number; count?: number };
  users?: { average: number; count?: number };
  external?: { average: number; count?: number; source?: string };
}

export function RatingBar({ editorial, users, external }: RatingBarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Użytkownicy */}
      {users && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{users.average.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({users.count})</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Ocena użytkowników</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {/* Redakcja */}
      {editorial && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-violet-400 text-violet-400" />
                <span className="font-semibold">{editorial.average.toFixed(1)}</span>
                {editorial.count ? <span className="text-xs text-muted-foreground">({editorial.count})</span> : null}
              </div>
            </TooltipTrigger>
            <TooltipContent>Ocena redakcji</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {/* Zewnętrzne */}
      {external && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-cyan-400 text-cyan-400" />
                <span className="font-semibold">{external.average.toFixed(1)}</span>
                {external.count ? <span className="text-xs text-muted-foreground">({external.count})</span> : null}
                {external.source ? <span className="text-xs text-muted-foreground">{external.source}</span> : null}
              </div>
            </TooltipTrigger>
            <TooltipContent>Ocena zewnętrzna (np. AliExpress)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
