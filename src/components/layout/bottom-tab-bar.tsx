"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Flame, ShoppingBag, ShoppingCart, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useLocale, useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { useNotifications } from '@/hooks/use-notifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AccountMenuPanel } from '@/components/layout/account-menu-panel';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/unified-currency';
import { withImageProxy } from '@/lib/image-proxy';
import { getPriceAmount } from '@/lib/i18n-utils';

type BottomNavItem = {
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: (pathname: string) => boolean;
};

export function BottomTabBar() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const pathname = usePathname();
  const rawLocale = useLocale();
  const locale = (rawLocale as string) || 'pl';
  const prefix = `/${locale}`;

  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const { items: cartItems, itemCount, totalAmount, totalWithShipping, removeItem } = useSmartCart();
  const { formatPrice } = useCurrency();

  const handleLogout = async () => {
    await auth.signOut();
  };

  let userInitial = 'U';
  if (user?.displayName && typeof user.displayName === 'string' && user.displayName.length > 0) {
    userInitial = user.displayName.charAt(0).toUpperCase();
  } else if (user?.email && typeof user.email === 'string' && user.email.length > 0) {
    userInitial = user.email.charAt(0).toUpperCase();
  }

  const items: BottomNavItem[] = [
    {
      key: 'deals',
      href: `${prefix}/deals`,
      label: t('deals'),
      icon: Flame,
      isActive: (p) => p === `${prefix}/deals` || p.startsWith(`${prefix}/deals/`),
    },
    {
      key: 'products',
      href: `${prefix}/products`,
      label: t('products'),
      icon: ShoppingBag,
      isActive: (p) => p === `${prefix}/products` || p.startsWith(`${prefix}/products/`),
    },
    {
      key: 'cart',
      href: '#',
      label: 'Koszyk',
      icon: ShoppingCart,
      isActive: () => isCartOpen,
    },
    {
      key: 'account',
      href: `${prefix}/profile`,
      label: 'Konto',
      icon: User,
      isActive: (p) => p === `${prefix}/profile` || p.startsWith(`${prefix}/profile/`) || isAccountOpen,
    },
  ];

  return (
    <>
      {/* Cart Bottom Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-xl flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left flex items-center justify-between">
              <span>{t('cart')}</span>
              <span className="text-xs font-normal text-muted-foreground">{itemCount} szt.</span>
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Twój koszyk jest pusty</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {cartItems.map((item) => {
                  const priceSource = item.product ? item.product.price : item.deal?.price;
                  const price = getPriceAmount(priceSource);
                  const title = item.product
                    ? ((item.product as any).title?.pl || (item.product as any).name || 'Produkt')
                    : ((item.deal as any)?.title?.pl || (item.deal as any)?.title || 'Okazja');
                  const imageUrl = item.product
                    ? ((item.product as any).image || (item.product as any).imageUrl || '/placeholder.png')
                    : (((item.deal as any)?.image || (item.deal as any)?.imageUrl) || '/placeholder.png');
                  const keyId = (item.product as any)?.id ?? (item.deal as any)?.id;
                  
                  return (
                    <div key={keyId} className="flex items-center gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div className="relative h-14 w-14 flex-shrink-0">
                        <img 
                          src={withImageProxy(imageUrl)} 
                          alt={title} 
                          className="h-full w-full object-cover rounded-lg border border-border/40" 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Ilość: {item.quantity}</p>
                        <p className="text-sm font-bold text-primary mt-1">{formatPrice(price)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(keyId)}
                        className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-destructive transition-colors shrink-0"
                        aria-label="Usuń przedmiot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {cartItems.length > 0 && (
            <div className="border-t border-border/80 pt-4 mt-auto space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Suma częściowa</span>
                <span className="font-semibold text-foreground">{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dostawa</span>
                <span className="font-semibold text-foreground">
                  {totalWithShipping && totalWithShipping > totalAmount ? formatPrice(totalWithShipping - totalAmount) : 'Darmowa'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-base font-bold">
                <span>Razem</span>
                <span className="text-primary">{formatPrice(totalWithShipping)}</span>
              </div>
              
              <div className="pt-2 flex gap-3">
                <Link
                  href={`${prefix}/cart`}
                  onClick={() => setIsCartOpen(false)}
                  className="flex-1 text-center py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
                >
                  {tCommon('labels.goToCheckout')}
                </Link>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="px-4 py-3 border border-border rounded-xl hover:bg-muted text-sm font-semibold transition-colors"
                >
                  Zamknij
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Account Settings Sheet */}
      <Sheet open={isAccountOpen} onOpenChange={setIsAccountOpen}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">{t('account')}</SheetTitle>
          </SheetHeader>
          <div className="flex justify-center">
            <AccountMenuPanel
              user={user}
              loading={loading}
              onLogout={handleLogout}
              onNavigate={() => setIsAccountOpen(false)}
              unreadCount={unreadCount}
            />
          </div>
        </SheetContent>
      </Sheet>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden pb-[env(safe-area-inset-bottom,0px)]"
        aria-label={t('mobileNavigation')}
      >
        <ul className="mx-auto grid h-16 max-w-screen-sm grid-cols-4 px-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.isActive
              ? item.isActive(pathname)
              : pathname === item.href;

            return (
              <li key={item.key}>
                {item.key === 'cart' ? (
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(true)}
                    className={cn(
                      'flex h-full w-full flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
                      active
                        ? 'text-primary font-bold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:text-foreground active:scale-[0.98]'
                    )}
                    aria-label="Koszyk"
                  >
                    <div className="relative flex items-center justify-center">
                      <Icon className={cn('h-5 w-5', active && 'text-primary')} />
                      {itemCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center scale-90 border border-background">
                          {itemCount > 9 ? '9+' : itemCount}
                        </span>
                      )}
                    </div>
                    <span>{item.label}</span>
                  </button>
                ) : item.key === 'account' ? (
                  <button
                    type="button"
                    onClick={() => setIsAccountOpen(true)}
                    className={cn(
                      'flex h-full w-full flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
                      active
                        ? 'text-primary font-bold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:text-foreground active:scale-[0.98]'
                    )}
                    aria-label={t('account')}
                  >
                    {user ? (
                      <div className="relative flex items-center justify-center">
                        <Avatar className={cn(
                          "h-6 w-6 border transition-all shadow-sm",
                          active ? "border-primary ring-2 ring-primary/20" : "border-border/60"
                        )}>
                          {user.photoURL ? (
                            <AvatarImage src={user.photoURL} alt={user?.displayName || 'User'} />
                          ) : null}
                          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                            {userInitial}
                          </AvatarFallback>
                        </Avatar>
                        {unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full bg-destructive shadow-sm" />
                        )}
                      </div>
                    ) : (
                      <div className={cn(
                        "h-6 w-6 rounded-full border flex items-center justify-center transition-all shadow-sm",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-background/50 text-zinc-600 dark:text-zinc-400"
                      )}>
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <span>{item.label}</span>
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-full flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
                      active
                        ? 'text-primary font-bold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:text-foreground active:scale-[0.98]'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className={cn('h-5 w-5', active && 'text-primary')} />
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
