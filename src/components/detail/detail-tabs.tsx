'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CommentSection from '@/components/comment-section';
import RatingInput from '@/components/rating-input';
import { SpecsTable } from '@/components/specs-table';
import { PriceComparisonTable } from '@/components/price-comparison-table';
import { LogisticsBadge } from '@/components/product/LogisticsBadge';
import { SellerInfo } from '@/components/product/SellerInfo';
import { 
  FileText, 
  Sliders, 
  Store, 
  MessageSquare, 
  Star, 
  AlertCircle, 
  Truck, 
  Wallet, 
  Info 
} from 'lucide-react';

interface DetailTabsProps {
  id: string;
  itemType: 'deal' | 'product';
  description?: string | null;
  hasHtmlDescription?: boolean;
  specifications?: any[];
  deals?: any[];
  productData?: any;
  userRating?: any;
  recentRatings?: any[];
  onRatingSubmitted?: () => void;
  commentsCount?: number;
  conditions?: string[];
  freeShipping?: boolean;
  cashback?: any;
  minOrderValue?: string | null;
  limitPerUser?: number | string | null;
  requiresMembership?: string | null;
}

export function DetailTabs({
  id,
  itemType,
  description,
  hasHtmlDescription,
  specifications = [],
  deals = [],
  productData,
  userRating,
  recentRatings = [],
  onRatingSubmitted,
  commentsCount = 0,
  conditions = [],
  freeShipping,
  cashback,
  minOrderValue,
  limitPerUser,
  requiresMembership,
}: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('description');

  const hasSpecs = specifications.length > 0;
  const hasDeals = deals.length > 0;

  const specsRecord = useMemo(() => {
    if (!specifications || specifications.length === 0) return {};
    const res: Record<string, string> = {};
    specifications.forEach((spec) => {
      const key = spec.name || spec.key || 'Parametr';
      res[key] = String(spec.value || '');
    });
    return res;
  }, [specifications]);

  return (
    <div id="detail-tabs-section" className="space-y-6 pt-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/60 rounded-xl gap-1">
          <TabsTrigger value="description" className="flex items-center gap-1.5 py-2.5 text-xs font-bold rounded-lg">
            <FileText className="h-4 w-4" />
            <span>Opis i Warunki</span>
          </TabsTrigger>
          
          {hasSpecs && (
            <TabsTrigger value="specs" className="flex items-center gap-1.5 py-2.5 text-xs font-bold rounded-lg">
              <Sliders className="h-4 w-4" />
              <span>Specyfikacja</span>
            </TabsTrigger>
          )}

          {hasDeals && (
            <TabsTrigger value="prices" className="flex items-center gap-1.5 py-2.5 text-xs font-bold rounded-lg">
              <Store className="h-4 w-4" />
              <span>Oferty sklepów ({deals.length})</span>
            </TabsTrigger>
          )}

          <TabsTrigger value="discussion" className="flex items-center gap-1.5 py-2.5 text-xs font-bold rounded-lg">
            <MessageSquare className="h-4 w-4" />
            <span>Dyskusja ({commentsCount})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Description & Conditions */}
        <TabsContent value="description" className="space-y-6 pt-4">
          {/* Logistics & Seller Info */}
          {productData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LogisticsBadge logistics={productData?.logistics} />
              <SellerInfo seller={productData?.seller} />
            </div>
          )}

          {/* Benefits Badges */}
          <div className="flex flex-wrap gap-2">
            {freeShipping && (
              <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1">
                <Truck className="mr-1 h-3.5 w-3.5" />
                Darmowa dostawa
              </Badge>
            )}
            {cashback && (
              <Badge className="bg-indigo-600 text-white font-bold text-xs px-2.5 py-1">
                <Wallet className="mr-1 h-3.5 w-3.5" />
                Cashback {cashback.percentage ? `${cashback.percentage}%` : `${cashback.amount} PLN`}
              </Badge>
            )}
            {minOrderValue && (
              <Badge variant="outline" className="font-semibold text-xs px-2.5 py-1">
                Min. zamówienie: {minOrderValue}
              </Badge>
            )}
            {limitPerUser && (
              <Badge variant="outline" className="font-semibold text-xs px-2.5 py-1">
                Limit: {limitPerUser} na osobę
              </Badge>
            )}
            {requiresMembership && (
              <Badge variant="outline" className="font-semibold text-xs px-2.5 py-1">
                <Info className="mr-1 h-3.5 w-3.5" />
                Wymaga: {requiresMembership}
              </Badge>
            )}
          </div>

          {/* Conditions List */}
          {conditions && conditions.length > 0 && (
            <Card className="bg-blue-500/5 border-blue-500/20 rounded-xl">
              <CardContent className="p-4">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-foreground">
                  <Info className="h-4 w-4 text-blue-500" />
                  Warunki skorzystania z oferty
                </h3>
                <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                  {conditions.map((condition, idx) => (
                    <li key={`condition-${idx}`} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Description Text / HTML */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-headline text-lg sm:text-xl font-bold text-foreground mb-3">
                Szczegółowy opis
              </h2>
              {description ? (
                hasHtmlDescription ? (
                  <div
                    className="text-sm sm:text-base text-foreground/90 leading-relaxed prose prose-neutral dark:prose-invert max-w-none break-words"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                ) : (
                  <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                    {description}
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground italic">Brak dodatkowego opisu dla tej oferty.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Specifications Table */}
        {hasSpecs && (
          <TabsContent value="specs" className="pt-4">
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-headline text-lg sm:text-xl font-bold text-foreground mb-4">
                  Pełna specyfikacja techniczna
                </h2>
                <SpecsTable specs={specsRecord} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 3: Price Comparison Table */}
        {hasDeals && (
          <TabsContent value="prices" className="pt-4">
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-headline text-lg sm:text-xl font-bold text-foreground mb-4">
                  Porównanie ofert sklepów
                </h2>
                <PriceComparisonTable productId={id} initialDeals={deals} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 4: Discussion & Reviews */}
        <TabsContent value="discussion" className="space-y-6 pt-4">
          {itemType === 'product' && (
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <h2 className="font-headline text-lg font-bold text-foreground flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  <span>Oceń ten produkt</span>
                </h2>
                <RatingInput
                  productId={id}
                  existingRating={userRating}
                  onRatingSubmitted={onRatingSubmitted}
                />
              </CardContent>
            </Card>
          )}

          <div id="deal-discussion">
            <CommentSection collectionName={itemType === 'deal' ? 'deals' : 'products'} docId={id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
