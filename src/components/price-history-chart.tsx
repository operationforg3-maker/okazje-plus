'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, TrendingUp, Bell, BellOff } from 'lucide-react';
import { PriceHistory, PriceAlert } from '@/lib/types';
import { getPriceHistory, getPriceSnapshots } from '@/lib/price-monitoring';

interface PriceHistoryChartProps {
  itemId: string;
  itemType: 'product' | 'deal';
}

export function PriceHistoryChart({ itemId, itemType }: PriceHistoryChartProps) {
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await getPriceHistory(itemId);
        if (data) {
          // Fetch recent snapshots to build chart data
          const snapshots = await getPriceSnapshots(itemId, 30);
          const chartData = snapshots.map((snapshot) => ({
            date: new Date(snapshot.timestamp).toLocaleDateString('pl-PL', {
              month: 'short',
              day: 'numeric',
            }),
            price: snapshot.price,
            originalPrice: snapshot.originalPrice,
          }));
          setHistory({ ...data, chartData });
        }
      } catch (error) {
        console.error('Error fetching price history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [itemId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historia cen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Ładowanie...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || !history.chartData || history.chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historia cen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Brak danych historycznych</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priceChange = history.currentPrice - history.lowestPrice;
  const priceChangePercent = ((priceChange / history.lowestPrice) * 100).toFixed(1);
  const isIncreasing = priceChange > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historia cen (ostatnie 30 dni)</CardTitle>
        <CardDescription>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <span className="text-sm text-muted-foreground">Aktualna cena: </span>
              <span className="font-bold text-lg">{history.currentPrice.toFixed(2)} PLN</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Najniższa: </span>
              <span className="font-semibold">{history.lowestPrice.toFixed(2)} PLN</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Najwyższa: </span>
              <span className="font-semibold">{history.highestPrice.toFixed(2)} PLN</span>
            </div>
            <div className="flex items-center gap-1">
              {isIncreasing ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
              <span
                className={`font-semibold ${
                  isIncreasing ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {isIncreasing ? '+' : ''}
                {priceChangePercent}%
              </span>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={history.chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `${value.toFixed(2)} PLN`}
              labelStyle={{ color: '#000' }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Cena"
            />
            {history.chartData.some((d) => d.originalPrice) && (
              <Line
                type="monotone"
                dataKey="originalPrice"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Cena oryginalna"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        {history.priceDropCount > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            Liczba obniżek ceny w ostatnim miesiącu: {history.priceDropCount}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
