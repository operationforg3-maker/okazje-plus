'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductPriceHistoryChartProps {
  deals: any[];
  title?: string;
  currency?: string;
}

/**
 * ProductPriceHistoryChart - Visualizes price trends over last 30 days
 * Shows lowest price available each day
 * Omnibus Directive compliance
 */
export function ProductPriceHistoryChart({
  deals,
  title = 'Price History (30 Days)',
  currency = 'USD',
}: ProductPriceHistoryChartProps) {
  // Aggregate price history across all deals
  const chartData = useMemo(() => {
    const priceByDate: Record<string, number> = {};

    // Collect all price history entries
    for (const deal of deals) {
      if (deal.priceHistory && Array.isArray(deal.priceHistory)) {
        for (const entry of deal.priceHistory) {
          const date = entry.date; // YYYY-MM-DD
          const price = entry.price;

          if (!priceByDate[date]) {
            priceByDate[date] = price;
          } else {
            // Keep the lowest price for that date
            priceByDate[date] = Math.min(priceByDate[date], price);
          }
        }
      }
    }

    // Convert to array and sort by date
    const data = Object.entries(priceByDate)
      .map(([date, price]) => ({
        date,
        price: Math.round(price * 100) / 100, // Round to 2 decimals
        displayDate: formatDateForChart(date),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get last 30 days only
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    return data.filter(d => d.date >= thirtyDaysAgoStr);
  }, [deals]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No price history available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>Not enough data to display price history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const avgPrice = (chartData.reduce((sum, d) => sum + d.price, 0) / chartData.length).toFixed(2);
  const priceChange = ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price * 100).toFixed(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Lowest daily price - Last 30 days ({chartData.length} data points)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Lowest Price</p>
            <p className="text-lg font-semibold text-green-600">
              ${minPrice.toFixed(2)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Highest Price</p>
            <p className="text-lg font-semibold text-red-600">
              ${maxPrice.toFixed(2)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Average Price</p>
            <p className="text-lg font-semibold">
              ${avgPrice}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Change</p>
            <p className={`text-lg font-semibold ${parseFloat(priceChange) < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {parseFloat(priceChange) < 0 ? '↓' : '↑'} {Math.abs(parseFloat(priceChange))}%
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12 }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                label={{ value: `Price (${currency})`, angle: -90, position: 'insideLeft' }}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
                formatter={(value) => `$${(value as number).toFixed(2)}`}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorPrice)"
                name="Price"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Omnibus Note */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-xs text-blue-800">
            <strong>Omnibus Directive:</strong> The chart shows the lowest price available each day over the last 30 days.
            This ensures price transparency and compliance with EU regulations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateForChart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
