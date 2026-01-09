'use client';

import { PriceHistoryEntry } from '@/lib/schema';
import { useMemo } from 'react';

interface SparklineProps {
  data: PriceHistoryEntry[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Mini price trend sparkline using pure SVG
 * No external dependencies, ultra-lightweight
 */
export function Sparkline({ 
  data, 
  width = 100, 
  height = 20,
  className = '' 
}: SparklineProps) {
  const { points, isDown, isEmpty } = useMemo(() => {
    if (!data || data.length < 2) {
      return { points: '', isDown: false, isEmpty: true };
    }
    
    // Sort by date
    const sorted = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const prices = sorted.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    
    // If range is 0, show flat line
    if (range === 0) {
      const y = height / 2;
      const pointsStr = prices.map((_, i) => {
        const x = (i / (prices.length - 1)) * width;
        return `${x},${y}`;
      }).join(' ');
      
      return { 
        points: pointsStr, 
        isDown: false, 
        isEmpty: false 
      };
    }
    
    // Calculate points
    const pointsStr = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    
    // Determine trend (first vs last price)
    const isDownTrend = prices[prices.length - 1] < prices[0];
    
    return { 
      points: pointsStr, 
      isDown: isDownTrend, 
      isEmpty: false 
    };
  }, [data, width, height]);
  
  if (isEmpty) {
    return null;
  }
  
  return (
    <svg 
      width={width} 
      height={height} 
      className={`inline-block ${className}`}
      aria-label="Price trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke={isDown ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Generate smart badges based on product/deal data
 */
export function generateSmartBadges(data: {
  price?: { current: number; lowest30d?: number };
  logistics?: { isFreeShipping?: boolean; deliveryDays?: number };
  priceHistory?: PriceHistoryEntry[];
}): Array<{ text: string; color: string; icon?: string }> {
  const badges: Array<{ text: string; color: string; icon?: string }> = [];
  
  // Super Cena badge - price at or below 30-day low
  if (data.price?.lowest30d && data.price.current <= data.price.lowest30d) {
    badges.push({ 
      text: '🔥 Super Cena', 
      color: 'bg-red-500',
      icon: 'fire'
    });
  }
  
  // Free Shipping badge
  if (data.logistics?.isFreeShipping) {
    badges.push({ 
      text: '🚚 Free Ship', 
      color: 'bg-green-500',
      icon: 'truck'
    });
  }
  
  // Fast Delivery badge
  if (data.logistics?.deliveryDays && data.logistics.deliveryDays <= 3) {
    badges.push({ 
      text: '⚡ Szybka dostawa', 
      color: 'bg-blue-500',
      icon: 'zap'
    });
  }
  
  // Price Drop badge - check recent trend
  if (data.priceHistory && data.priceHistory.length >= 2) {
    const sorted = [...data.priceHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const recent = sorted.slice(-7); // Last 7 entries
    if (recent.length >= 2) {
      const oldPrice = recent[0].price;
      const newPrice = recent[recent.length - 1].price;
      const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;
      
      if (dropPercent >= 10) {
        badges.push({
          text: `📉 -${Math.round(dropPercent)}%`,
          color: 'bg-purple-500',
          icon: 'trending-down'
        });
      }
    }
  }
  
  return badges;
}
