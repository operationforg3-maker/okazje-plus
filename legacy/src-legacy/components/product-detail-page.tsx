'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ShoppingCart,
  Star,
  Share2,
  Heart,
  TrendingUp,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { getProductWithDeals } from '@/lib/data';
import { PriceComparisonTable } from './price-comparison-table';
import { ProductPriceHistoryChart } from './product-price-history-chart';
import { SpecsTable } from './specs-table';

interface ProductDetailPageProps {
  productId: string;
}

/**
 * ProductDetailPage - The complete product comparison page
 * Hero section with gallery + best price widget
 * Price comparison table
 * Price history chart
 * Specifications
 * Reviews summary
 */
export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getProductWithDeals(productId);
      if (!result) {
        setError('Product not found');
        return;
      }
      setData(result);
    } catch (err) {
      console.error('Error loading product:', err);
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading product...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">{error || 'Product not found'}</p>
      </div>
    );
  }

  const product = data.product;
  const deals = data.deals || [];
  const bestDeal = deals.length > 0
    ? deals.reduce((best: any, current: any) => {
        const bestTotal = (best.price?.amount || 0) + (best.shipping?.cost || 0);
        const currentTotal = (current.price?.amount || 0) + (current.shipping?.cost || 0);
        return currentTotal < bestTotal ? current : best;
      })
    : null;

  const primaryImage = product.images?.[0] || '/placeholder.jpg';
  const totalPrice = bestDeal
    ? (bestDeal.price?.amount || 0) + (bestDeal.shipping?.cost || 0)
    : (product.bestPrice?.amount || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* HERO SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery (Left) */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square flex items-center justify-center">
            <img
              src={product.images?.[selectedImageIndex] || primaryImage}
              alt={product.title?.pl || 'Product'}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Thumbnail Gallery */}
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-6 gap-2">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                    idx === selectedImageIndex ? 'border-blue-500' : 'border-gray-300'
                  }`}
                >
                  <img
                    src={img}
                    alt={`View ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Best Price Widget (Right) */}
        <div className="space-y-6 flex flex-col">
          {/* Title & Status */}
          <div>
            <h1 className="text-3xl font-bold mb-3">
              {product.title?.pl || 'Product'}
            </h1>

            <div className="flex flex-wrap items-center gap-3">
              {/* Rating Stars */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.round(product.rating?.score || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold">
                  {product.rating?.score?.toFixed(1) || 'N/A'}
                </span>
                <span className="text-gray-500">
                  ({product.rating?.count || 0} reviews)
                </span>
              </div>

              {/* Status Badge */}
              {product.status === 'approved' && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
          </div>

          {/* Best Price Card */}
          {bestDeal && (
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Best Price at</p>
                  <p className="text-lg font-semibold capitalize">
                    {bestDeal.source}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Total Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-green-600">
                      ${totalPrice.toFixed(2)}
                    </span>
                    {bestDeal.originalPrice && (
                      <span className="text-xl text-gray-500 line-through">
                        ${bestDeal.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  <div className="pt-3 border-t border-green-200 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Product Price:</span>
                      <span className="font-medium">${(bestDeal.price?.amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping:</span>
                      <span className="font-medium">
                        {bestDeal.shipping?.cost === 0 ? 'FREE' : `$${bestDeal.shipping?.cost?.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Shipping Info */}
                {bestDeal.shipping?.timeDays && (
                  <div className="bg-white rounded p-3">
                    <p className="text-sm">
                      <TrendingUp className="w-4 h-4 inline mr-2" />
                      Estimated delivery: <strong>{bestDeal.shipping.timeDays} days</strong>
                    </p>
                  </div>
                )}

                {/* CTA Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button asChild className="flex-1 h-12 text-lg">
                    <a
                      href={bestDeal.affiliateLink || bestDeal.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Buy Now
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => setIsFavorite(!isFavorite)}
                  >
                    <Heart
                      className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
                    />
                  </Button>
                  <Button variant="outline" size="icon" className="h-12 w-12">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews Summary */}
          {product.reviewsSummary && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">What Users Say</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {product.reviewsSummary.pl || product.reviewsSummary.en}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* PRICE COMPARISON TABLE */}
      <section>
        <PriceComparisonTable productId={productId} />
      </section>

      {/* PRICE HISTORY CHART */}
      {deals.length > 0 && (
        <section>
          <ProductPriceHistoryChart deals={deals} />
        </section>
      )}

      {/* SPECIFICATIONS */}
      {product.specs && Object.keys(product.specs).length > 0 && (
        <section>
          <SpecsTable specs={product.specs} />
        </section>
      )}

      {/* SHORT DESCRIPTION */}
      {product.shortDescription && (
        <section className="bg-gray-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <p className="text-gray-700 leading-relaxed">
            {product.shortDescription.pl || product.shortDescription.en}
          </p>
        </section>
      )}

      {/* FULL DESCRIPTION */}
      {product.fullDescription && (
        <section className="prose max-w-none">
          <h2 className="text-2xl font-bold mb-4">Details</h2>
          <div className="text-gray-700">
            {product.fullDescription.pl || product.fullDescription.en}
          </div>
        </section>
      )}
    </div>
  );
}
