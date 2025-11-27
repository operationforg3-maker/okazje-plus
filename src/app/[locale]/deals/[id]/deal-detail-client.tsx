'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Deal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronRight, 
  ExternalLink, 
  Flame, 
  MessageSquare, 
  Clock,
  User,
  Tag,
  ArrowUp,
  Sparkles,
  TrendingUp,
  Copy,
  Timer,
  AlertCircle,
  Gift,
  Truck,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
  Zap,
  Star,
  Package,
} from 'lucide-react';
import DealCard from '@/components/deal-card';
import CommentSection from '@/components/comment-section';
import { useCommentsCount } from '@/hooks/use-comments-count';
import ShareButton from '@/components/share-button';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { SimilarItemsCarousel } from '@/components/similar-items-carousel';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const posted = new Date(isoDate);
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 60) return `${diffMinutes} min temu`;
  if (diffHours < 24) return `${diffHours} godz. temu`;
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg. temu`;
  return `${Math.floor(diffDays / 30)} mies. temu`;
}

function getTimeRemaining(expiryDate: string) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  
  if (diffMs <= 0) return null;
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

interface Props {
  deal: Deal;
  relatedDeals: Deal[];
}

export default function DealDetailClient({ deal, relatedDeals }: Props) {
  const { user } = useAuth();
  const liveComments = useCommentsCount('deals', deal.id, deal.commentsCount);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(
    deal.expiryDate ? getTimeRemaining(deal.expiryDate) : null
  );

  // Update countdown every minute
  useEffect(() => {
    if (!deal.expiryDate) return;
    
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(deal.expiryDate!);
      setTimeRemaining(remaining);
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [deal.expiryDate]);

  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
  const original = typeof deal.originalPrice === 'number' 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice) 
    : null;
  const discount = typeof deal.originalPrice === 'number' && deal.originalPrice > 0 
    ? Math.round(100 - (deal.price / deal.originalPrice) * 100) 
    : null;
  const savings = typeof deal.originalPrice === 'number' && deal.originalPrice > deal.price 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice - deal.price)
    : null;

  const isHot = deal.temperature >= 300;
  const isNew = (() => {
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  })();

  const temperatureColor = deal.temperature >= 500 ? 'from-red-500 to-orange-500' 
    : deal.temperature >= 300 ? 'from-orange-500 to-amber-500'
    : deal.temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((deal.temperature / 500) * 100, 100);

  // Galeria - użyj deal.gallery jeśli istnieje
  const images = deal.gallery && deal.gallery.length > 0 
    ? deal.gallery.map((url, idx) => ({ id: idx.toString(), src: url, alt: deal.title }))
    : [{ id: '0', src: deal.image, alt: deal.title }];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Deal type badge info
  const dealTypeInfo: Record<string, { label: string; icon: any; color: string }> = {
    sale: { label: 'Wyprzedaż', icon: Tag, color: 'bg-blue-600' },
    coupon: { label: 'Kod rabatowy', icon: Tag, color: 'bg-purple-600' },
    freebie: { label: 'Gratis', icon: Gift, color: 'bg-green-600' },
    'pricing-error': { label: 'Błąd cenowy', icon: AlertCircle, color: 'bg-red-600' },
    cashback: { label: 'Cashback', icon: Wallet, color: 'bg-indigo-600' },
    bundle: { label: 'Zestaw', icon: Package, color: 'bg-orange-600' },
  };

  const currentDealType = deal.dealType && dealTypeInfo[deal.dealType];

  const handleCopyCoupon = () => {
    if (deal.couponCode) {
      navigator.clipboard.writeText(deal.couponCode);
      toast.success('Kod skopiowany do schowka!');
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 lg:py-12">
      {/* Breadcrumbs */}
      <div className="mb-4 md:mb-6 flex items-center space-x-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
        <Link href="/" className="hover:text-primary transition-colors whitespace-nowrap">Strona główna</Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <Link href="/deals" className="hover:text-primary transition-colors whitespace-nowrap">Okazje</Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <Link href={`/deals?category=${deal.mainCategorySlug}`} className="hover:text-primary transition-colors whitespace-nowrap">
          {deal.mainCategorySlug}
        </Link>
        {deal.subCategorySlug && (
          <>
            <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
            <Link href={`/deals?category=${deal.mainCategorySlug}&sub=${deal.subCategorySlug}`} className="hover:text-primary transition-colors whitespace-nowrap">
              {deal.subCategorySlug}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <span className="font-medium text-foreground truncate max-w-[200px]">{deal.title}</span>
      </div>

      {/* Main Deal Section */}
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-12">
        {/* Deal Image Gallery */}
        <div className="relative">
          <div className="sticky top-8 space-y-4">
            <div className="relative aspect-[4/3] bg-card rounded-xl shadow-lg overflow-hidden border">
              <Image
                src={images[currentImageIndex].src}
                alt={images[currentImageIndex].alt}
                fill
                className="object-contain p-4 md:p-8"
                priority
              />
              
              {/* Gallery navigation */}
              {images.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
                    onClick={nextImage}
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </Button>
                  
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}

              {/* Top badges */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {isHot && (
                  <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg">
                    <Flame className="mr-1 h-4 w-4" />
                    Hot
                  </Badge>
                )}
                {isNew && (
                  <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg">
                    <Sparkles className="mr-1 h-4 w-4" />
                    Nowość
                  </Badge>
                )}
                {discount && discount > 0 && (
                  <Badge variant="destructive" className="shadow-lg text-lg font-bold">
                    -{discount}%
                  </Badge>
                )}
                {deal.verified && (
                  <Badge className="bg-green-600 text-white shadow-lg">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Zweryfikowane
                  </Badge>
                )}
              </div>

              {/* Stock alert */}
              {deal.stockAlert && (
                <Badge 
                  variant="outline" 
                  className={`absolute top-4 left-4 ${
                    deal.stockAlert === 'ending-soon' ? 'border-red-600 text-red-600 bg-red-50' :
                    deal.stockAlert === 'limited' ? 'border-orange-600 text-orange-600 bg-orange-50' :
                    'border-yellow-600 text-yellow-600 bg-yellow-50'
                  }`}
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {deal.stockAlert === 'ending-soon' ? 'Kończy się' :
                   deal.stockAlert === 'limited' ? 'Limitowana' :
                   'Niski stan'}
                </Badge>
              )}
            </div>

            {/* Thumbnail gallery */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all ${
                      idx === currentImageIndex ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      className="object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deal Info */}
        <div className="flex flex-col space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Tag className="h-3 w-3" />
                {deal.subSubCategorySlug || deal.subCategorySlug || deal.mainCategorySlug}
              </Badge>
              {currentDealType && (
                <Badge className={`${currentDealType.color} text-white text-xs`}>
                  <currentDealType.icon className="h-3 w-3 mr-1" />
                  {currentDealType.label}
                </Badge>
              )}
              {deal.status === 'approved' && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600 text-xs">
                  Zatwierdzone
                </Badge>
              )}
            </div>

            <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl mb-4 break-words">
              {deal.title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>Dodane przez <span className="font-medium text-foreground">{deal.postedBy}</span></span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{getRelativeTime(deal.postedAt)}</span>
              </div>
              {deal.merchant && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  <span>{deal.merchant}</span>
                </div>
              )}
            </div>

            <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-line">
              {deal.description}
            </p>

            {/* Tags */}
            {deal.tags && deal.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {deal.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Coupon Code - PROMINENT */}
          {deal.couponCode && (
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-900 mb-1">Kod rabatowy</p>
                    <p className="text-2xl font-bold font-mono text-purple-700">{deal.couponCode}</p>
                  </div>
                  <Button onClick={handleCopyCoupon} variant="secondary" size="lg">
                    <Copy className="mr-2 h-5 w-5" />
                    Kopiuj
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expiry countdown */}
          {deal.expiryDate && timeRemaining && (
            <Card className="bg-orange-50 border-orange-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Timer className="h-6 w-6 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">Okazja wygasa za</p>
                    <p className="text-2xl font-bold text-orange-700">{timeRemaining}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Benefits badges */}
          <div className="flex flex-wrap gap-2">
            {deal.freeShipping && (
              <Badge className="bg-green-600 text-white">
                <Truck className="mr-1 h-3 w-3" />
                Darmowa dostawa
              </Badge>
            )}
            {deal.cashback && (
              <Badge className="bg-indigo-600 text-white">
                <Wallet className="mr-1 h-3 w-3" />
                Cashback {deal.cashback.percentage ? `${deal.cashback.percentage}%` : `${deal.cashback.amount} PLN`}
              </Badge>
            )}
            {deal.minOrderValue && (
              <Badge variant="outline">
                Min. zamówienie: {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.minOrderValue)}
              </Badge>
            )}
            {deal.limitPerUser && (
              <Badge variant="outline">
                Limit: {deal.limitPerUser} na osobę
              </Badge>
            )}
            {deal.requiresMembership && (
              <Badge variant="outline">
                <Info className="mr-1 h-3 w-3" />
                Wymaga: {deal.requiresMembership}
              </Badge>
            )}
          </div>

          {/* Conditions */}
          {deal.conditions && deal.conditions.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Warunki
                </h3>
                <ul className="space-y-1 text-sm">
                  {deal.conditions.map((condition, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Price Section */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-end gap-3 mb-2 flex-wrap">
                <div className="text-4xl md:text-5xl font-bold text-primary">{price}</div>
                {original && (
                  <div className="text-xl text-muted-foreground line-through mb-1">{original}</div>
                )}
                {typeof discount === 'number' && discount > 0 && (
                  <Badge variant="destructive" className="mb-1 text-lg">-{discount}%</Badge>
                )}
              </div>
              {savings && (
                <p className="text-green-600 font-semibold mb-4 text-lg">
                  💰 Oszczędzasz {savings}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="lg" asChild className="flex-1 bg-primary hover:bg-primary/90 text-base md:text-lg py-6">
                  <a href={deal.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-5 w-5" />
                    Przejdź do okazji
                  </a>
                </Button>
                <ShareButton 
                  type="deal"
                  itemId={deal.id}
                  title={deal.title}
                  url={`/deals/${deal.id}`}
                  size="lg"
                  variant="outline"
                />
              </div>
            </CardContent>
          </Card>

          {/* Temperature & Engagement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Temperatura i statystyki
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Temperatura</span>
                  <span className="font-bold text-lg">{deal.temperature}°</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className={`h-full bg-gradient-to-r ${temperatureColor} transition-all duration-500`}
                    style={{ width: `${temperaturePercent}%` }}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Głosy</p>
                    <p className="text-lg font-semibold">{deal.voteCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Komentarze</p>
                    <p className="text-lg font-semibold">{liveComments.count}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="discussion" className="mb-12">
        <TabsList className="grid w-full grid-cols-1 lg:w-auto">
          <TabsTrigger value="discussion">Dyskusja ({liveComments.count})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="discussion" className="mt-6">
          <CommentSection collectionName="deals" docId={deal.id} />
        </TabsContent>
      </Tabs>

      {/* Related Deals */}
      {relatedDeals.length > 0 && (
        <>
          <Separator className="my-12" />
          <section>
            <h2 className="font-headline text-2xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Podobne okazje
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedDeals.map(d => (
                <DealCard key={d.id} deal={d} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* AI-Powered Similar Items Carousel */}
      <SimilarItemsCarousel
        itemId={deal.id}
        itemType="deal"
        category={deal.mainCategorySlug}
        subcategory={deal.subCategorySlug}
        tags={deal.tags}
        priceRange={deal.price ? [deal.price * 0.7, deal.price * 1.3] : undefined}
        excludeItemId={deal.id}
        maxItems={8}
      />
    </div>
  );
}
