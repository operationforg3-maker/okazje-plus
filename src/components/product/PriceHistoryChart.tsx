'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PriceHistoryEntry } from '@/lib/schema';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface PriceHistoryChartProps {
  priceHistory: PriceHistoryEntry[];
  currency?: string;
}

export function PriceHistoryChart({ priceHistory, currency = 'PLN' }: PriceHistoryChartProps) {
  // Sort by date and prepare chart data
  const chartData = useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) return [];
    
    return [...priceHistory]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(entry => ({
        date: new Date(entry.date),
        dateStr: entry.date,
        price: entry.price,
        discount: entry.discount,
      }));
  }, [priceHistory]);
  
  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return 'neutral';
    
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    if (change < -5) return 'down'; // Price dropped significantly
    if (change > 5) return 'up'; // Price increased significantly
    return 'neutral';
  }, [chartData]);
  
  if (chartData.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Brak historii cen
      </div>
    );
  }
  
  // Calculate price range for Y-axis
  const prices = chartData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const yAxisMin = Math.floor(minPrice - priceRange * 0.1);
  const yAxisMax = Math.ceil(maxPrice + priceRange * 0.1);
  
  // Color based on trend
  const colors = {
    down: {
      gradient: ['#10b981', '#059669'],
      stroke: '#10b981',
      text: 'text-green-600',
      icon: TrendingDown,
    },
    up: {
      gradient: ['#ef4444', '#dc2626'],
      stroke: '#ef4444',
      text: 'text-red-600',
      icon: TrendingUp,
    },
    neutral: {
      gradient: ['#3b82f6', '#2563eb'],
      stroke: '#3b82f6',
      text: 'text-blue-600',
      icon: null,
    },
  };
  
  const color = colors[trend];
  const TrendIcon = color.icon;
  
  return (
    <div className="space-y-2">
      {/* Trend Indicator */}
      {TrendIcon && (
        <div className={`flex items-center gap-1 text-sm font-medium ${color.text}`}>
          <TrendIcon className="h-4 w-4" />
          <span>
            {trend === 'down' ? 'Cena spada' : 'Cena rośnie'}
          </span>
        </div>
      )}
      
      {/* Chart */}
      <ResponsiveContainer width="100%" height={150} minWidth={0}>
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id={`priceGradient-${trend}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color.gradient[0]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color.gradient[1]} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(date, 'd MMM', { locale: pl })}
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          
          <YAxis
            domain={[yAxisMin, yAxisMax]}
            tickFormatter={(value) => `${value.toFixed(0)} ${currency}`}
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              
              const data = payload[0].payload;
              
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {format(data.date, 'd MMMM yyyy', { locale: pl })}
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {data.price.toFixed(2)} {currency}
                  </p>
                  {data.discount && (
                    <p className="text-sm text-green-600 font-medium">
                      -{data.discount}% rabat
                    </p>
                  )}
                </div>
              );
            }}
          />
          
          <Area
            type="monotone"
            dataKey="price"
            stroke={color.stroke}
            strokeWidth={2}
            fill={`url(#priceGradient-${trend})`}
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
      
      {/* Price Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="block font-medium text-gray-900">Najniższa</span>
          {minPrice.toFixed(2)} {currency}
        </div>
        <div>
          <span className="block font-medium text-gray-900">Najwyższa</span>
          {maxPrice.toFixed(2)} {currency}
        </div>
        <div>
          <span className="block font-medium text-gray-900">Obecna</span>
          {chartData[chartData.length - 1].price.toFixed(2)} {currency}
        </div>
      </div>
    </div>
  );
}
