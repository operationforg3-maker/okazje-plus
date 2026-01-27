import React from 'react';
import { Button, ButtonProps } from './button';
import { cn } from '@/lib/utils';

/**
 * ResponsiveButton - Przycisk który zmienia się na ikonę na mobile
 * 
 * Użycie:
 * <ResponsiveButton icon={<TrashIcon />} label="Usuń">
 *   Usuń
 * </ResponsiveButton>
 * 
 * Mobile (<sm): Pokaż tylko ikonę (tooltip)
 * Desktop (≥sm): Pokaż tekst + ikonę
 */

interface ResponsiveButtonProps extends ButtonProps {
  icon?: React.ReactNode;
  label?: string;
  showTextOnMobile?: boolean;
}

export const ResponsiveButton = React.forwardRef<
  HTMLButtonElement,
  ResponsiveButtonProps
>(({ icon, label, showTextOnMobile = false, children, className, ...props }, ref) => {
  if (!icon) {
    // Jeśli brak ikony, zwróć zwykły button
    return (
      <Button ref={ref} className={className} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <Button
      ref={ref}
      className={cn(
        'gap-2',
        // Mobile: tylko ikona
        showTextOnMobile ? '' : 'sm:gap-2',
        className
      )}
      title={label || (typeof children === 'string' ? children : undefined)}
      {...props}
    >
      {/* Ikona - zawsze widoczna */}
      <span className="flex-shrink-0">{icon}</span>

      {/* Tekst - ukryty na mobile, widoczny na sm+ */}
      {children && (
        <span className={showTextOnMobile ? '' : 'hidden sm:inline'}>
          {children}
        </span>
      )}
    </Button>
  );
});

ResponsiveButton.displayName = 'ResponsiveButton';

/**
 * ResponsiveButtonGroup - Wrapper dla grupy przycisków z auto-responsywnością
 */
interface ResponsiveButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  stackOnMobile?: boolean; // flex-col na mobile, flex-row na desktop
}

export const ResponsiveButtonGroup: React.FC<ResponsiveButtonGroupProps> = ({
  children,
  className,
  stackOnMobile = true,
}) => {
  return (
    <div
      className={cn(
        'flex gap-2',
        stackOnMobile && 'flex-col sm:flex-row',
        className
      )}
    >
      {children}
    </div>
  );
};
