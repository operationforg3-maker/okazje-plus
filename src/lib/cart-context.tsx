/**
 * Smart Cart Context (M4 Shopping Intelligence)
 * 
 * Manages user's shopping cart with intelligent features:
 * ✅ Add products to "Planning List" (saved cart)
 * ✅ Persist cart across sessions (Firestore for logged-in, localStorage for guests)
 * ✅ Generate deep affiliate links when finalizing purchase
 * ✅ Track price changes for cart items
 * ✅ Calculate total landed cost (product + shipping)
 * ✅ Multi-marketplace comparison (future)
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Product, SmartPrice, Deal } from '@/lib/types';
import { getPriceAmount, getTotalPrice } from '@/lib/i18n-utils';
import { logger } from '@/lib/logging';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getExternalUrl } from '@/lib/external-url';

interface CartItem {
  product?: Product; // legacy/product items
  deal?: Deal;       // new: allow adding deals directly
  quantity: number;
  addedAt: string;
  notes?: string;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  totalWithShipping: number;
  addItem: (product: Product, quantity?: number) => void;
  addDeal: (deal: Deal, quantity?: number) => void;
  removeItem: (id: string) => void; // accepts product.id or deal.id
  updateQuantity: (id: string, quantity: number) => void; // product.id or deal.id
  updateNotes: (id: string, notes: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  shareCart: () => Promise<{ shareUrl: string; shareId: string } | null>;
  finalizeCart: () => Promise<{ links: Array<{ product: Product; affiliateLink: string }> }>;
  isLoading: boolean;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'smart_cart_items';

/**
 * Smart Cart Provider
 */
export function SmartCartProvider({ children }: { children: ReactNode }) {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const debugCartLogs = process.env.NEXT_PUBLIC_DEBUG === 'true';
  
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const hasLoadedRef = useRef(false);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // SSR safety - mark as mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load cart from storage on mount/user change
  useEffect(() => {
    if (!isMounted) return;
    
    const currentUserId = user?.uid;
    
    // Only load if: 1. First mount OR 2. User ID changed
    if (!hasLoadedRef.current || prevUserIdRef.current !== currentUserId) {
      const loadCart = async () => {
        try {
          if (user) {
            try {
              const cartDoc = await getDoc(doc(db, 'user_carts', user.uid));
              if (cartDoc.exists()) {
                const cartData = cartDoc.data();
                const firestoreItems = (cartData.items || []) as CartItem[];
                setItems(firestoreItems);
                if (firestoreItems.length > 0) {
                  logger.info(`Loaded ${firestoreItems.length} items from Firestore cart`);
                } else if (debugCartLogs) {
                  logger.debug('Loaded 0 items from Firestore cart');
                }
                return;
              }
            } catch (firestoreError) {
              logger.warn('Failed to load from Firestore, falling back to localStorage', { error: firestoreError });
            }
          }
          
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(CART_STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored) as CartItem[];
              setItems(parsed);
              if (parsed.length > 0) {
                logger.info(`Loaded ${parsed.length} items from localStorage cart`);
              } else if (debugCartLogs) {
                logger.debug('Loaded 0 items from localStorage cart');
              }
            } else {
              if (debugCartLogs) {
                logger.debug('Loaded 0 items from localStorage cart');
              }
            }
          }
        } catch (error) {
          logger.error('Failed to load cart', { error });
        } finally {
          setIsLoading(false);
          hasLoadedRef.current = true;
          prevUserIdRef.current = currentUserId;
        }
      };
      
      loadCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, user?.uid]);

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load
    
    const saveCart = async () => {
      try {
        // Save to localStorage (always, for guests and backup)
        if (typeof window !== 'undefined') {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        }
        
        if (user) {
          // Save to Firestore for logged-in users
          try {
            await setDoc(doc(db, 'user_carts', user.uid), {
              items,
              updatedAt: new Date().toISOString(),
            });
            if (items.length > 0) {
              logger.info(`Saved ${items.length} items to Firestore cart`);
            } else if (debugCartLogs) {
              logger.debug('Saved 0 items to Firestore cart');
            }
          } catch (firestoreError) {
            logger.warn('Failed to save to Firestore, localStorage backup exists', { error: firestoreError });
          }
        }
      } catch (error) {
        logger.error('Failed to save cart', { error });
      }
    };
    
    saveCart();
    // Only run when items or user ID changes, not on user object reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, user?.uid, isLoading]);

  /**
   * Add item to cart
   */
  const addItem = (product: Product, quantity: number = 1) => {
    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const normalizedProduct = (() => {
      const existingPrice = getPriceAmount((product as any).price);
      if (existingPrice > 0) return product;

      const bestPrice = (product as any).bestPrice;
      const amount =
        toNumber(bestPrice?.amount) ||
        toNumber(bestPrice?.totalPrice) ||
        toNumber((product as any).priceAmount) ||
        toNumber((product as any).price);

      if (amount <= 0) return product;

      return {
        ...product,
        price: {
          amount,
          currency: (bestPrice?.currency || 'PLN'),
          shippingCost: toNumber(bestPrice?.shippingCost),
          totalPrice: toNumber(bestPrice?.totalPrice) || (amount + toNumber(bestPrice?.shippingCost)),
        },
      } as Product;
    })();

    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.product?.id === normalizedProduct.id);
      
      if (existingIndex >= 0) {
        // Update quantity if already in cart
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        logger.info(`Updated cart item quantity: ${normalizedProduct.name}`, {
          newQuantity: updated[existingIndex].quantity,
        });
        return updated;
      } else {
        // Add new item
        logger.info(`Added item to cart: ${normalizedProduct.name}`);
        return [...prev, {
          product: normalizedProduct,
          quantity,
          addedAt: new Date().toISOString(),
        }];
      }
    });
  };

  /**
   * Add deal to cart
   */
  const addDeal = (deal: Deal, quantity: number = 1) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.deal?.id === deal.id);
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        logger.info(`Updated cart deal quantity: ${deal.title}`, {
          newQuantity: updated[existingIndex].quantity,
        });
        return updated;
      } else {
        logger.info(`Added deal to cart: ${deal.title}`);
        return [...prev, {
          deal,
          quantity,
          addedAt: new Date().toISOString(),
        }];
      }
    });
  };

  /**
   * Remove item from cart
   */
  const removeItem = (id: string) => {
    setItems(prev => {
      const filtered = prev.filter(item => (item.product?.id ?? item.deal?.id) !== id ? true : false);
      logger.info(`Removed item from cart: ${id}`);
      return filtered;
    });
  };

  /**
   * Update item quantity
   */
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    
    setItems(prev => {
      const updated = prev.map(item => 
        (item.product?.id === id || item.deal?.id === id)
          ? { ...item, quantity }
          : item
      );
      logger.info(`Updated quantity for ${id}: ${quantity}`);
      return updated;
    });
  };

  /**
   * Update item notes
   */
  const updateNotes = (id: string, notes: string) => {
    setItems(prev => {
      const updated = prev.map(item => 
        (item.product?.id === id || item.deal?.id === id)
          ? { ...item, notes }
          : item
      );
      return updated;
    });
  };

  /**
   * Clear entire cart
   */
  const clearCart = () => {
    setItems([]);
    logger.info('Cart cleared');
  };

  /**
   * Check if product is in cart
   */
  const isInCart = (id: string): boolean => {
    return items.some(item => (item.product?.id === id || item.deal?.id === id));
  };

  /**
   * Calculate total items count
   */
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Calculate total amount (products only, no shipping)
   */
  const totalAmount = items.reduce((sum, item) => {
    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    let price = 0;
    if (item.product) {
      price = getPriceAmount(item.product.price);
      if (price <= 0) {
        const bestPrice = (item.product as any).bestPrice;
        price =
          toNumber(bestPrice?.amount) ||
          toNumber(bestPrice?.totalPrice) ||
          toNumber((item.product as any).priceAmount) ||
          toNumber((item.product as any).price);
      }
    } else if (item.deal) {
      const p = item.deal.price;
      price = typeof p === 'object' ? toNumber((p as any).amount) : toNumber(p);
      if (price <= 0) {
        price =
          toNumber((item.deal as any)?.bestPrice?.amount) ||
          toNumber((item.deal as any)?.bestPrice?.totalPrice) ||
          toNumber((item.deal as any)?.totalPrice);
      }
    }
    return sum + (price * item.quantity);
  }, 0);

  /**
   * Calculate total with shipping (total landed cost)
   */
  const totalWithShipping = items.reduce((sum, item) => {
    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    let totalPrice = 0;
    if (item.product) {
      totalPrice = getTotalPrice(item.product.price);
      if (totalPrice <= 0) {
        const bestPrice = (item.product as any).bestPrice;
        const amount =
          toNumber(bestPrice?.amount) ||
          toNumber((item.product as any).priceAmount) ||
          toNumber((item.product as any).price);
        const shipping = toNumber(bestPrice?.shippingCost);
        totalPrice = toNumber(bestPrice?.totalPrice) || (amount + shipping);
      }
    } else if (item.deal) {
      const p = item.deal.price;
      const priceVal = typeof p === 'object' ? toNumber((p as any).amount) : toNumber(p);
      const shipping = toNumber((item.deal as any).shippingCost);
      totalPrice = priceVal + shipping;
      if (totalPrice <= 0) {
        totalPrice =
          toNumber((item.deal as any)?.bestPrice?.totalPrice) ||
          (toNumber((item.deal as any)?.bestPrice?.amount) + toNumber((item.deal as any)?.bestPrice?.shippingCost));
      }
    }
    return sum + (totalPrice * item.quantity);
  }, 0);

  /**
   * Share cart - Generate shareable link
   */
  const shareCart = async (): Promise<{ shareUrl: string; shareId: string } | null> => {
    logger.info('Sharing cart', { itemCount: items.length });
    
    try {
      const response = await fetch('/api/cart/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          userId: user?.uid || null,
          userName: user?.displayName || 'Gość',
          userEmail: user?.email || null,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to share cart');
      }
      
      const data = await response.json();
      
      logger.info('Cart shared', {
        shareId: data.shareId,
        shareUrl: data.shareUrl,
      });
      
      return {
        shareUrl: data.shareUrl,
        shareId: data.shareId,
      };
    } catch (error) {
      logger.error('Failed to share cart', { error });
      return null;
    }
  };

  /**
   * Finalize cart - Generate deep affiliate links for all products
   * 
   * This is the "Smart Cart" magic: when user is ready to purchase,
   * we generate fresh affiliate links for each product and open them
   * in new tabs or display them for user to proceed.
   */
  const finalizeCart = async (): Promise<{ links: Array<{ product: Product; affiliateLink: string }> }> => {
    logger.info('Finalizing cart', { itemCount: items.length });
    
    try {
      // Call API to generate fresh affiliate links
      const response = await fetch('/api/cart/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.product?.id,
            dealId: item.deal?.id || (item.product as any)?.bestDealId,
            quantity: item.quantity,
          })),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to finalize cart');
      }
      
      const data = await response.json();
      
      logger.info('Cart finalized', {
        linksGenerated: data.links?.length || 0,
      });
      
      return data;
    } catch (error) {
      logger.error('Failed to finalize cart', { error });
      
      // Fallback: return existing affiliate URLs
      return {
        links: items.map(item => {
          if (item.product) {
            const fallbackUrl = getExternalUrl(
              (item.product as any).affiliateUrl,
              (item.product as any).link,
              (item.product as any).dealUrl,
              (item.product as any).sourceUrl,
              (item.product as any).externalUrl,
              (item.product as any).sourceLinks?.[0]?.url,
              (item.product as any).sourceLinks?.[0]?.link
            ) || '';
            return {
              product: item.product as Product,
              affiliateLink: fallbackUrl,
            };
          }
          const d = item.deal as any;
          const fallbackUrl = getExternalUrl(
            d?.link,
            d?.affiliateLink,
            d?.affiliateUrl,
            d?.dealUrl,
            d?.sourceUrl,
            d?.url,
            d?.externalUrl,
            d?.metadata?.offerPreviewUrl,
            d?.metadata?.offerUrl,
            d?.metadata?.externalUrl,
            d?.metadata?.url
          ) || '';
          const minimalProduct = {
            id: d?.id,
            name: typeof d?.title === 'object' ? d?.title?.pl : (d?.title || 'Okazja'),
            image: d?.image || d?.imageUrl || '/placeholder.png',
          } as Product;
          return {
            product: minimalProduct,
            affiliateLink: fallbackUrl,
          };
        }),
      };
    }
  };

  const value: CartContextValue = {
    items,
    itemCount,
    totalAmount,
    totalWithShipping,
    addItem,
    removeItem,
    updateQuantity,
    updateNotes,
    clearCart,
    isInCart,
    shareCart,
    finalizeCart,
    isLoading,
    addDeal,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

/**
 * Hook to use Smart Cart
 */
export function useSmartCart() {
  const context = useContext(CartContext);
  
  if (!context) {
    throw new Error('useSmartCart must be used within SmartCartProvider');
  }
  
  return context;
}
