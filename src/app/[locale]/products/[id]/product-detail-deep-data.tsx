'use client';

import { useState } from 'react';
import { ProductCore } from '@/lib/types';
import { DealM6 } from '@/lib/types';
import { MediaGallery } from '@/components/product/MediaGallery';
import { PriceHistoryChart } from '@/components/product/PriceHistoryChart';
import { SpecificationsTable } from '@/components/product/SpecificationsTable';
import { LogisticsBadge } from '@/components/product/LogisticsBadge';
import { SellerInfo } from '@/components/product/SellerInfo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, ShoppingCart, Heart, Share2, ExternalLink, Zap, Globe } from 'lucide-react';
import { useCurrency } from '@/lib/unified-currency';
import Link from 'next/link';
import { CategoryBreadcrumb } from '@/components/category-breadcrumb';
import { getExternalUrl } from '@/lib/external-url';

interface ProductDetailDeepDataProps {
  productCore: ProductCore;
  deals: DealM6[];
}

// M6+: Warehouse badge component
function WarehouseBadge({ warehouses }: { warehouses?: string[] }) {
  if (!warehouses || warehouses.length === 0) return null;
  const hasPLWarehouse = warehouses.includes('PL');
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {hasPLWarehouse && (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
          <Zap className="h-3 w-3 mr-1" />
          Wysyłka z Polski
        </Badge>
      )}
      {warehouses.length > 0 && (
        <Badge variant="outline">
          <Globe className="h-3 w-3 mr-1" />
          {warehouses.join(', ')}
        </Badge>
      )}
    </div>
  );
}

export default function ProductDetailDeepData({ productCore, deals }: ProductDetailDeepDataProps) {
  const [selectedDealId, setSelectedDealId] = useState<string>(deals[0]?.id || '');
  const { formatPrice } = useCurrency();
  
  const selectedDeal = deals.find(d => d.id === selectedDealId) || deals[0];
  const bestDeal = deals.reduce((best, deal) => 
    deal.price.amount < best.price.amount ? deal : best
  , deals[0]);
  
  // Calculate discount if originalPrice available
  const discount = selectedDeal?.originalPrice && selectedDeal.price.amount < selectedDeal.originalPrice
    ? Math.round(((selectedDeal.originalPrice - selectedDeal.price.amount) / selectedDeal.originalPrice) * 100)
    : productCore.metadata?.discount;
  const selectedDealOutboundUrl = selectedDeal
    ? getExternalUrl(
        selectedDeal.affiliateLink,
        (selectedDeal as any).affiliateUrl,
        (selectedDeal as any).dealUrl,
        (selectedDeal as any).sourceUrl,
        (selectedDeal as any).url,
        (selectedDeal as any).externalUrl,
        (selectedDeal as any)?.metadata?.offerPreviewUrl,
        (selectedDeal as any)?.metadata?.previewUrl,
        (selectedDeal as any)?.metadata?.offerUrl,
        (selectedDeal as any)?.metadata?.externalUrl,
        (selectedDeal as any)?.metadata?.url,
        (selectedDeal as any)?.metadata?.originalUrl,
        (productCore as any)?.sourceLinks?.[0]?.url
      )
    : null;
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="mb-6 flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-foreground">Products</Link>
        {productCore.mainCategorySlug && (
          <>
            <span>/</span>
            <CategoryBreadcrumb
              mainCategorySlug={productCore.mainCategorySlug}
              subCategorySlug={productCore.subCategorySlug}
              subSubCategorySlug={productCore.subSubCategorySlug}
              contextType="products"
            />
          </>
        )}
      </div>
      
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Left Column: Media Gallery */}
        <div>
          <MediaGallery 
            gallery={productCore.gallery}
            images={productCore.images}
            videoUrl={productCore.videoUrl}
            productTitle={productCore.title.pl}
          />
        </div>
        
        {/* Right Column: Product Info */}
        <div className="space-y-6">
          {/* Title & Rating */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{productCore.title.pl}</h1>
            
            {/* Rating */}
            {productCore.rating && productCore.rating.count > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i}
                      className={`h-5 w-5 ${i < Math.floor(productCore.rating.score) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {productCore.rating.score.toFixed(1)} ({productCore.rating.count} opinii)
                </span>
              </div>
            )}
            
            {/* Short Description */}
            {productCore.shortDescription?.pl && (
              <p className="text-muted-foreground">
                {productCore.shortDescription.pl}
              </p>
            )}
          </div>
          
          {/* Price Box */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-primary">
                    {formatPrice(selectedDeal?.price.amount || productCore.bestPrice.amount)}
                  </span>
                  
                  {selectedDeal?.originalPrice && selectedDeal.originalPrice > selectedDeal.price.amount && (
                    <span className="text-xl text-muted-foreground line-through">
                      {formatPrice(selectedDeal.originalPrice)}
                    </span>
                  )}
                  
                  {discount && discount > 0 && (
                    <Badge variant="destructive" className="text-lg">
                      -{discount}%
                    </Badge>
                  )}
                </div>
                
                {/* Price History Chart */}
                {selectedDeal?.priceHistory && selectedDeal.priceHistory.length > 1 && (
                  <PriceHistoryChart 
                    priceHistory={selectedDeal.priceHistory} 
                    currency={selectedDeal.price.currency}
                  />
                )}
                
                {/* Deal Selector - Multiple Offers */}
                {deals.length > 1 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Dostępne oferty ({deals.length}):</p>
                    <div className="space-y-2">
                      {deals.map(deal => (
                        <button
                          key={deal.id}
                          onClick={() => setSelectedDealId(deal.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedDealId === deal.id 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:border-gray-300'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{deal.merchantName || deal.source}</p>
                              <p className="text-sm text-muted-foreground">
                                Dostawa: {deal.shipping?.timeDays || (deal as any).shippingTimeDays || 'N/A'} dni
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatPrice(deal.price.amount)}</p>
                              {(() => {
                                const dealShippingCost = deal.shipping?.cost ?? (deal as any).shippingCost;
                                return dealShippingCost !== undefined && dealShippingCost > 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    + {formatPrice(dealShippingCost)} wysyłka
                                  </p>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* CTAs */}
                <div className="flex gap-2">
                  {selectedDealOutboundUrl ? (
                    <Button 
                      size="lg" 
                      className="flex-1"
                      asChild
                    >
                      <a 
                        href={selectedDealOutboundUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Kup teraz
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button size="lg" className="flex-1" disabled>
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      Brak linku zewnętrznego
                    </Button>
                  )}
                  
                  <Button size="lg" variant="outline">
                    <Heart className="h-5 w-5" />
                  </Button>
                  
                  <Button size="lg" variant="outline">
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Logistics Info */}
          {productCore.logistics && (
            <LogisticsBadge logistics={productCore.logistics} compact={false} />
          )}
          
          {/* M6+: Warehouse Info - Fast Shipping Badge */}
          <WarehouseBadge warehouses={productCore.warehouses} />
          
          {/* Seller Info (M6+: includes positiveRate) */}
          {productCore.seller && (
            <Card>
              <CardContent className="pt-6">
                <SellerInfo seller={productCore.seller} compact={false} />
                {productCore.seller.positiveRate && (
                  <Badge className="mt-3 bg-blue-100 text-blue-800" variant="secondary">
                    {productCore.seller.positiveRate} pozytywnych opinii
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Tabs: Description & Specifications */}
      <Tabs defaultValue="description" className="mb-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="description">Opis</TabsTrigger>
          <TabsTrigger value="specs">Specyfikacja</TabsTrigger>
          <TabsTrigger value="reviews">Opinie</TabsTrigger>
        </TabsList>
        
        <TabsContent value="description" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Opis produktu</CardTitle>
            </CardHeader>
            <CardContent>
              {productCore.fullDescription?.pl ? (
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: productCore.fullDescription.pl }} />
              ) : productCore.description?.pl ? (
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: productCore.description.pl }} />
              ) : (
                <p className="text-muted-foreground">Brak opisu produktu.</p>
              )}
              
              {/* Features/Pros/Cons if available */}
              {productCore.features?.pl && productCore.features.pl.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Kluczowe cechy:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {productCore.features.pl.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                {productCore.pros?.pl && productCore.pros.pl.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-green-600">✓ Zalety:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {productCore.pros.pl.map((pro, i) => (
                        <li key={i}>{pro}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {productCore.cons?.pl && productCore.cons.pl.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-red-600">✗ Wady:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {productCore.cons.pl.map((con, i) => (
                        <li key={i}>{con}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="specs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Specyfikacja techniczna</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* M6+: Simple attributes (from product_props) - displayed first */}
                {productCore.attributes && productCore.attributes.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Atrybuty produktu</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {productCore.attributes.map((attr, idx) => (
                        <div key={idx} className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">{attr.name}</p>
                          <p className="font-semibold text-sm mt-1">{attr.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Structured specifications table */}
                <SpecificationsTable 
                  specifications={productCore.specificationsStructured}
                  specs={productCore.specs}
                  showCategories={true}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reviews" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Opinie użytkowników</CardTitle>
              <CardDescription>
                {productCore.rating.count} opinii • Średnia ocena: {productCore.rating.score.toFixed(1)}/5.0
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productCore.reviewsSummary?.pl && (
                <div className="mb-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Podsumowanie AI:</h4>
                  <p className="text-sm">{productCore.reviewsSummary.pl}</p>
                </div>
              )}
              
              <p className="text-muted-foreground text-center py-8">
                Szczegółowe opinie wkrótce...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
