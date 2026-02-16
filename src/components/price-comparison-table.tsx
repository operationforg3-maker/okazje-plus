'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingDown } from 'lucide-react';
import { getDealsForProduct } from '@/lib/data';
import { getExternalUrl } from '@/lib/external-url';

interface PriceComparisonTableProps {
  productId: string;
  onBuyClick?: (deal: any) => void;
}

/**
 * PriceComparisonTable - Shows all available deals for a product
 * Sorted by total price (product + shipping)
 * Shows store logo, price, shipping, delivery time
 */
export function PriceComparisonTable({
  productId,
  onBuyClick,
}: PriceComparisonTableProps) {
  const t = useTranslations('products');
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    loadDeals();
  }, [productId]);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const dealsData = await getDealsForProduct(productId);
      setDeals(dealsData);
    } catch (error) {
      console.error('Error loading deals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">{t('productDetail.priceComparison.loading')}</div>;
  }

  if (deals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{t('productDetail.priceComparison.empty')}</p>
      </div>
    );
  }

  // Calculate best deal (lowest total price)
  const bestDealId = deals.length > 0
    ? deals.reduce((best, current) => {
        const bestTotal = (best.price?.amount || 0) + (best.shipping?.cost || 0);
        const currentTotal = (current.price?.amount || 0) + (current.shipping?.cost || 0);
        return currentTotal < bestTotal ? current : best;
      }).id
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('productDetail.priceComparison.title')}</h3>
        <span className="text-sm text-gray-500">{t('productDetail.priceComparison.storesCount', { count: deals.length })}</span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>{t('productDetail.priceComparison.store')}</TableHead>
              <TableHead className="text-right">{t('productDetail.priceComparison.price')}</TableHead>
              <TableHead className="text-right">{t('productDetail.priceComparison.shipping')}</TableHead>
              <TableHead className="text-right">{t('productDetail.priceComparison.total')}</TableHead>
              <TableHead>{t('productDetail.priceComparison.delivery')}</TableHead>
              <TableHead>{t('productDetail.priceComparison.rating')}</TableHead>
              <TableHead className="text-right">{t('productDetail.priceComparison.action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => {
              // Convert to PLN (Base)
              const sourceCurrency = deal.price?.currency || 'PLN';
              const productPrice = CurrencyManager.convertToPLN(deal.price?.amount || 0, sourceCurrency);
              const shippingCost = CurrencyManager.convertToPLN(deal.shipping?.cost || 0, sourceCurrency);
              const originalPriceInPLN = deal.originalPrice ? CurrencyManager.convertToPLN(deal.originalPrice, sourceCurrency) : 0;
              
              const totalPrice = productPrice + shippingCost;
              const isBestDeal = deal.id === bestDealId;
              const externalUrl = getExternalUrl(
                deal.affiliateLink,
                deal.affiliateUrl,
                deal.dealUrl,
                deal.sourceUrl,
                deal.link
              );

              return (
                <TableRow
                  key={deal.id}
                  className={isBestDeal ? 'bg-green-50 font-medium' : ''}
                >
                  {/* Store Name & Logo */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isBestDeal && (
                        <Badge variant="default" className="text-xs">
                          {t('productDetail.priceComparison.bestPriceBadge')}
                        </Badge>
                      )}
                      <span className="font-medium capitalize">{deal.source}</span>
                    </div>
                  </TableCell>

                  {/* Product Price */}
                  <TableCell className="text-right">
                    <span className="font-semibold">
                      {formatPrice(productPrice)}
                    </span>
                    {deal.originalPrice && (
                      <p className="text-xs text-gray-500 line-through">
                        {formatPrice(originalPriceInPLN)}
                      </p>
                    )}
                  </TableCell>

                  {/* Shipping Cost */}
                  <TableCell className="text-right">
                    {shippingCost === 0 ? (
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        {t('productDetail.priceComparison.freeShipping')}
                      </Badge>
                    ) : (
                      <span>{formatPrice(shippingCost)}</span>
                    )}
                  </TableCell>

                  {/* Total Price (Highlighted) */}
                  <TableCell className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {formatPrice(totalPrice)}
                    </div>
                  </TableCell>

                  {/* Delivery Time */}
                  <TableCell>
                    {deal.shipping?.timeDays ? (
                      <span className="text-sm">
                        {t('productDetail.priceComparison.deliveryDays', { count: deal.shipping.timeDays })}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">{t('productDetail.priceComparison.deliveryDash')}</span>
                    )}
                  </TableCell>

                  {/* Merchant Rating */}
                  <TableCell>
                    {deal.merchantRating ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">
                          {deal.merchantRating.toFixed(1)}
                        </span>
                        <span className="text-yellow-500">★</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Buy Button */}
                  <TableCell className="text-right">
                    {externalUrl ? (
                      <Button
                        size="sm"
                        variant={isBestDeal ? 'default' : 'outline'}
                        onClick={() => onBuyClick?.(deal)}
                        asChild
                      >
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2"
                        >
                          {t('productDetail.priceComparison.buy')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={isBestDeal ? 'default' : 'outline'}
                        disabled
                      >
                        Brak linku
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Best Deal Info */}
      {bestDealId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800">
              {t('productDetail.priceComparison.lowestInfo')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
