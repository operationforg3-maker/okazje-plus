'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  Share2,
  ArrowUp,
  Sparkles,
  TrendingUp,
  Copy,
  Facebook,
  Twitter
} from 'lucide-react';
import DealCard from '@/components/deal-card';
import CommentSection from '@/components/comment-section';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { VoteControls } from '@/components/vote-controls';
import { toast } from 'sonner';
import ShareButton from '@/components/share-button';

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

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [relatedDeals, setRelatedDeals] = useState<Deal[]>([]);
  const liveComments = useCommentsCount('deals', params.id, deal?.commentsCount);

  useEffect(() => {
    async function fetchDeal() {
      const docRef = doc(db, "deals", params.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dealData = { id: docSnap.id, ...docSnap.data() } as Deal;
        setDeal(dealData);

        // Fetch related deals from same subcategory
        const relatedQuery = query(
          collection(db, "deals"),
          where("subCategorySlug", "==", dealData.subCategorySlug),
          where("status", "==", "approved"),
          limit(4)
        );
        const relatedSnap = await getDocs(relatedQuery);
        const related = relatedSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Deal))
          .filter(d => d.id !== params.id)
          .slice(0, 3);
        setRelatedDeals(related);
      } else {
        notFound();
      }
    }
    fetchDeal();
  }, [params.id]);

  if (!deal) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

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

  const handleShare = (platform: string) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Sprawdź tę okazję: ${deal.title}`;
    
    if (platform === 'copy') {
      navigator.clipboard.writeText(url);
      toast.success('Link skopiowany do schowka!');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
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
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <span className="font-medium text-foreground truncate">{deal.title}</span>
      </div>

      {/* Main Deal Section */}
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-12">
        {/* Deal Image */}
        <div className="relative">
          <div className="sticky top-8">
            <div className="relative aspect-[4/3] bg-card rounded-xl shadow-lg overflow-hidden border">
              <Image
                src={deal.image}
                alt={deal.title}
                data-ai-hint={deal.imageHint}
                fill
                className="object-contain p-8"
                priority
              />
            </div>
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
            </div>
          </div>
        </div>

        {/* Deal Info */}
        <div className="flex flex-col space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {deal.subCategorySlug || deal.mainCategorySlug}
              </Badge>
              {deal.status === 'approved' && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
                  Zatwierdzone
                </Badge>
              )}
            </div>

            <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl mb-4">
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
            </div>

            <p className="text-base text-muted-foreground leading-relaxed">
              {deal.description}
            </p>
          </div>

          {/* Price Section */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2">
            <CardContent className="p-6">
              <div className="flex items-end gap-3 mb-2">
                <div className="text-4xl font-bold text-primary">{price}</div>
                {original && (
                  <div className="text-xl text-muted-foreground line-through mb-1">{original}</div>
                )}
                {typeof discount === 'number' && discount > 0 && (
                  <Badge variant="destructive" className="mb-1">-{discount}%</Badge>
                )}
              </div>
              {savings && (
                <p className="text-green-600 font-semibold mb-4">
                  Oszczędzasz {savings}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="lg" asChild className="flex-1 bg-primary hover:bg-primary/90">
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
                  <span className="font-bold text-lg">{deal.temperature} pkt</span>
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
                    <p className="text-lg font-semibold">{typeof deal.commentsCount === 'number' ? deal.commentsCount : 0}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-center">
                <VoteControls dealId={deal.id} initialVoteCount={deal.temperature} />
              </div>
            </CardContent>
          </Card>

          {/* Share Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Udostępnij okazję
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleShare('copy')} className="flex-1">
                  <Copy className="mr-2 h-4 w-4" />
                  Kopiuj link
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleShare('facebook')} className="flex-1">
                  <Facebook className="mr-2 h-4 w-4" />
                  Facebook
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleShare('twitter')} className="flex-1">
                  <Twitter className="mr-2 h-4 w-4" />
                  Twitter
                </Button>
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
          <CommentSection collectionName="deals" docId={params.id} />
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
    </div>
  );
}

// Generowanie dynamicznych metadanych dla SEO i Open Graph
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const docRef = doc(db, "deals", params.id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return {
        title: 'Okazja nie znaleziona',
        description: 'Przepraszamy, ta okazja nie istnieje lub została usunięta.',
      };
    }

    const deal = { id: docSnap.id, ...docSnap.data() } as Deal;
    const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
    const discount = typeof deal.originalPrice === 'number' && deal.originalPrice > 0 
      ? Math.round(100 - (deal.price / deal.originalPrice) * 100) 
      : null;
    
    const title = `${deal.title}${discount ? ` -${discount}%` : ''} - ${price}`;
    const description = deal.description || `Sprawdź tę gorącą okazję: ${deal.title} w cenie ${price}. Temperatura: ${deal.temperature}°`;
    const imageUrl = deal.image || '/og-image.png';

    return {
      title,
      description,
      openGraph: {
        type: 'article',
        url: `https://okazje.plus/deals/${params.id}`,
        title,
        description,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: deal.title,
          },
        ],
        siteName: 'Okazje+',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    return {
      title: 'Okazje+',
      description: 'Najlepsze okazje zakupowe w Polsce',
    };
  }
}
