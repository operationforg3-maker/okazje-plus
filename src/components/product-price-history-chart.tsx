'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';

interface ProductPriceHistoryChartProps {
  deals: any[];
  title?: string;
  currency?: string;
}

/**
 * ProductPriceHistoryChart - Visualizes price trends over last 30 days
 * Shows lowest price available each day
 * Omnibus Directive compliance
 * Now respects user's selected currency preference
 */
export function ProductPriceHistoryChart({
  deals,
  title,
}: ProductPriceHistoryChartProps) {
  const t = useTranslations('products');
  const locale = useLocale();
  const { currency, formatPrice, isMounted } = useCurrency();
  const [displayCurrency, setDisplayCurrency] = useState('PLN');

  // Update display currency when user's preference changes
  useEffect(() => {
    if (isMounted) {
      setDisplayCurrency(currency);
    }
  }, [currency, isMounted]);

  // Aggregate price history across all deals and keep reference to best deal and deal ID
  const chartData = useMemo(() => {
    const priceByDate: Record<string, { price: number; dealId?: string; source?: string; affiliateLink?: string }> = {};

    // Collect all price history entries
    for (const deal of deals) {
      if (deal.priceHistory && Array.isArray(deal.priceHistory)) {
        for (const entry of deal.priceHistory) {
          const date = entry.date; // YYYY-MM-DD
          const price = entry.price;

          const currentItem = priceByDate[date];
          if (!currentItem || price < currentItem.price) {
            priceByDate[date] = {
              price,
              dealId: deal.id,
              source: deal.source,
              affiliateLink: deal.affiliateLink || deal.affiliateUrl || deal.dealUrl || deal.sourceUrl || deal.link
            };
          }
        }
      }
    }

    // Convert to array and sort by date
    const data = Object.entries(priceByDate)
      .map(([date, item]) => ({
        date,
        price: Math.round(item.price * 100) / 100, // Round to 2 decimals
        displayDate: formatDateForChart(date, locale),
        dealId: item.dealId,
        source: item.source,
        affiliateLink: item.affiliateLink,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get last 30 days only
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    return data.filter(d => d.date >= thirtyDaysAgoStr);
  }, [deals, locale]);

  // Extract chronological price changes (whenever price changes)
  const priceChanges = useMemo(() => {
    const changes: Array<{ date: string; displayDate: string; price: number; dealId?: string; source?: string; affiliateLink?: string }> = [];
    let lastPrice: number | null = null;
    
    // Sort oldest to newest to detect changes
    const sorted = [...chartData].sort((a, b) => a.date.localeCompare(b.date));
    for (const item of sorted) {
      if (lastPrice === null || item.price !== lastPrice) {
        changes.push(item);
        lastPrice = item.price;
      }
    }
    // Return newest changes first, limit to last 5
    return changes.reverse().slice(0, 5);
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title ?? t('productDetail.priceHistory.title')}</CardTitle>
          <CardDescription>{t('productDetail.priceHistory.noDataTitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>{t('productDetail.priceHistory.noDataDescription')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const avgPrice = (chartData.reduce((sum, d) => sum + d.price, 0) / chartData.length).toFixed(2);
  const priceChange = ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price * 100).toFixed(1);

  // Handle clicking a point on the chart to navigate to the deal
  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const data = state.activePayload[0].payload;
      const url = data.affiliateLink || (data.dealId ? `/pl/deals/${data.dealId}` : null);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? t('productDetail.priceHistory.title')}</CardTitle>
        <CardDescription>
          {t('productDetail.priceHistory.description', { points: chartData.length, currency: displayCurrency })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">{t('productDetail.priceHistory.stats.min')}</p>
            <p className="text-lg font-semibold text-green-600">
              {isMounted ? formatPrice(minPrice) : `${minPrice.toFixed(2)} ${CurrencyManager.getSymbol(currency as any)}`}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">{t('productDetail.priceHistory.stats.max')}</p>
            <p className="text-lg font-semibold text-red-600">
              {isMounted ? formatPrice(maxPrice) : `${maxPrice.toFixed(2)} ${CurrencyManager.getSymbol(currency as any)}`}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">{t('productDetail.priceHistory.stats.avg')}</p>
            <p className="text-lg font-semibold">
              {isMounted ? formatPrice(Number(avgPrice)) : `${avgPrice} ${CurrencyManager.getSymbol(currency as any)}`}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">{t('productDetail.priceHistory.stats.change')}</p>
            <p className={`text-lg font-semibold ${parseFloat(priceChange) < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {parseFloat(priceChange) < 0 ? '↓' : '↑'} {Math.abs(parseFloat(priceChange))}%
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-96 w-full cursor-pointer" title="Kliknij punkt wykresu, aby przejść do oferty">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={chartData} onClick={handleChartClick}>
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
                label={{ value: t('productDetail.priceHistory.axisLabel', { currency: displayCurrency }), angle: -90, position: 'insideLeft' }}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-md text-xs space-y-1 z-50">
                        <p className="font-semibold text-gray-900">{data.displayDate}</p>
                        <p className="text-blue-600 font-bold text-sm">
                          Cena: {isMounted ? formatPrice(data.price) : `${data.price.toFixed(2)} ${displayCurrency}`}
                        </p>
                        {data.source && (
                          <p className="text-gray-500 capitalize">Sklep: {data.source}</p>
                        )}
                        <p className="text-[10px] text-green-600 font-medium animate-pulse mt-1">
                          👉 Kliknij punkt, aby przejść do oferty
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorPrice)"
                name={t('productDetail.priceHistory.price')}
                activeDot={{ r: 6, style: { cursor: 'pointer' } }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chronological Price Changes List */}
        {priceChanges.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-800">Ostatnie zmiany cen i oferty:</h4>
            <div className="divide-y divide-gray-100">
              {priceChanges.map((change, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="space-y-0.5">
                    <p className="font-medium text-gray-900">
                      {isMounted ? formatPrice(change.price) : `${change.price.toFixed(2)} ${displayCurrency}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {change.displayDate} {change.source && <span className="capitalize">({change.source})</span>}
                    </p>
                  </div>
                  {change.affiliateLink ? (
                    <a
                      href={change.affiliateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                    >
                      Idź do oferty ↗
                    </a>
                  ) : change.dealId ? (
                    <a
                      href={`/pl/deals/${change.dealId}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      Zobacz okazję
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Brak linku</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Omnibus Note */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-xs text-blue-800">
            <strong>{t('productDetail.priceHistory.omnibusTitle')}:</strong> {t('productDetail.priceHistory.omnibusText')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateForChart(dateStr: string, locale: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}

