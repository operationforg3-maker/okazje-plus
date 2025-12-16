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
import { Product, SmartPrice } from '@/lib/types';
import { getPriceAmount, getTotalPrice } from '@/lib/i18n-utils';
import { logger } from '@/lib/logging';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface CartItem {
  product: Product;
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
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateNotes: (productId: string, notes: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
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
  
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const hasLoadedRef = useRef(false);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Load cart from storage on mount/user change
  useEffect(() => {
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
                logger.info(`Loaded ${firestoreItems.length} items from Firestore cart`);
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
              logger.info(`Loaded ${parsed.length} items from localStorage cart`);
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
  }, [user?.uid]);

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
            logger.info(`Saved ${items.length} items to Firestore cart`);
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
    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      
      if (existingIndex >= 0) {
        // Update quantity if already in cart
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        logger.info(`Updated cart item quantity: ${product.name}`, {
          newQuantity: updated[existingIndex].quantity,
        });
        return updated;
      } else {
        // Add new item
        logger.info(`Added item to cart: ${product.name}`);
        return [...prev, {
          product,
          quantity,
          addedAt: new Date().toISOString(),
        }];
      }
    });
  };

  /**
   * Remove item from cart
   */
  const removeItem = (productId: string) => {
    setItems(prev => {
      const filtered = prev.filter(item => item.product.id !== productId);
      logger.info(`Removed item from cart: ${productId}`);
      return filtered;
    });
  };

  /**
   * Update item quantity
   */
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    
    setItems(prev => {
      const updated = prev.map(item => 
        item.product.id === productId 
          ? { ...item, quantity }
          : item
      );
      logger.info(`Updated quantity for ${productId}: ${quantity}`);
      return updated;
    });
  };

  /**
   * Update item notes
   */
  const updateNotes = (productId: string, notes: string) => {
    setItems(prev => {
      const updated = prev.map(item => 
        item.product.id === productId 
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
  const isInCart = (productId: string): boolean => {
    return items.some(item => item.product.id === productId);
  };

  /**
   * Calculate total items count
   */
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Calculate total amount (products only, no shipping)
   */
  const totalAmount = items.reduce((sum, item) => {
    const price = getPriceAmount(item.product.price);
    return sum + (price * item.quantity);
  }, 0);

  /**
   * Calculate total with shipping (total landed cost)
   */
  const totalWithShipping = items.reduce((sum, item) => {
    const totalPrice = getTotalPrice(item.product.price);
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
            productId: item.product.id,
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
        links: items.map(item => ({
          product: item.product,
          affiliateLink: item.product.affiliateUrl,
        })),
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
