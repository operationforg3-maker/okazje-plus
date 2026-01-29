/**
 * CardBody Component
 * 
 * Reusable card body with title, description, price info
 * Standardized spacing and typography
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface CardBodyProps {
  title: string;
  description?: string;
  descriptionLines?: number; // Max lines before truncate (default 2)
  className?: string;
  children?: React.ReactNode;
}

export function CardBody({
  title,
  description,
  descriptionLines = 2,
  className,
  children,
}: CardBodyProps) {
  return (
    <div className={cn('px-4 py-3 space-y-2', className)}>
      {/* Title */}
      <h3 className="font-semibold text-sm line-clamp-2 leading-tight hover:text-primary transition-colors">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-xs text-muted-foreground',
            `line-clamp-${descriptionLines}`
          )}
        >
          {description}
        </p>
      )}

      {/* Custom content */}
      {children && <div className="space-y-2">{children}</div>}
    </div>
  );
}

CardBody.displayName = 'CardBody';
