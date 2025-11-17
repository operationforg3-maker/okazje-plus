"use client";

import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdminEditButtonProps {
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  tooltip?: string;
}

/**
 * Przycisk edycji widoczny tylko dla adminów.
 * Można go użyć na kartach produktów/dealów lub w nagłówkach stron.
 */
export default function AdminEditButton({
  onClick,
  className = '',
  variant = 'ghost',
  size = 'icon',
  tooltip = 'Edytuj (admin)',
}: AdminEditButtonProps) {
  const { user } = useAuth();

  // Widoczny tylko dla adminów
  if (!user || user.role !== 'admin') return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
            variant={variant}
            size={size}
            className={`z-10 ${className}`}
            aria-label="Edytuj jako admin"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
