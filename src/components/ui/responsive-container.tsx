import React from 'react';
import { cn } from '@/lib/utils';

/**
 * ResponsiveContainer - Garantuje max-width i padding na wszystkich urządzeniach
 * Zastępuje ręczne używanie page-container - automatycznie optymalny
 */
interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; // full = bez ograniczenia
  padding?: 'compact' | 'default' | 'loose'; // mobile padding
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-none',
};

const paddingClasses = {
  compact: 'px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4',
  default: 'px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6',
  loose: 'px-6 py-4 sm:px-8 sm:py-6 md:px-12 md:py-8',
};

export const ResponsiveContainer = React.forwardRef<
  HTMLDivElement,
  ResponsiveContainerProps
>(
  (
    {
      children,
      className,
      as: Component = 'div',
      maxWidth = 'lg',
      padding = 'default',
    },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        className={cn(
          'w-full mx-auto',
          maxWidthClasses[maxWidth],
          paddingClasses[padding],
          className
        )}
      >
        {children}
      </Component>
    );
  }
);

ResponsiveContainer.displayName = 'ResponsiveContainer';

/**
 * ResponsiveGrid - Automatycznie dostosowuje liczbę kolumn
 */
interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    mobile?: number; // xs
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'compact' | 'default' | 'loose';
}

const gapClasses = {
  compact: 'gap-2 sm:gap-3 md:gap-4',
  default: 'gap-3 sm:gap-4 md:gap-6',
  loose: 'gap-4 sm:gap-6 md:gap-8',
};

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className,
  cols = { mobile: 1, sm: 2, md: 3 },
  gap = 'default',
}) => {
  const colsClass = `
    grid-cols-${cols.mobile || 1}
    ${cols.sm ? `sm:grid-cols-${cols.sm}` : ''}
    ${cols.md ? `md:grid-cols-${cols.md}` : ''}
    ${cols.lg ? `lg:grid-cols-${cols.lg}` : ''}
    ${cols.xl ? `xl:grid-cols-${cols.xl}` : ''}
  `;

  return (
    <div className={cn('grid', gapClasses[gap], colsClass, className)}>
      {children}
    </div>
  );
};
