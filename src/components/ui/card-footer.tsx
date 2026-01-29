/**
 * CardFooter Component
 * 
 * Reusable card footer with action buttons, stats
 * Flex layout for easy button/stat arrangement
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface CardFooterProps {
  className?: string;
  children?: React.ReactNode;
}

export function CardFooter({ className, children }: CardFooterProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 border-t border-muted flex items-center justify-between gap-2 flex-wrap',
        className
      )}
    >
      {children}
    </div>
  );
}

CardFooter.displayName = 'CardFooter';
