'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Heart, 
  MessageSquare, 
  ThumbsUp, 
  TrendingUp,
  Calendar,
  Award,
  Activity,
  Flame,
  Bell,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Package
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Comment, Deal, Product } from '@/lib/types';
import Link from 'next/link';
import { getFavoriteDeals, getFavoriteProducts, getDealById, getProductById } from '@/lib/data';
import DealListCard from '@/components/deal-list-card';
import ProductCard from '@/components/product-card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserActivity = {
  votes: number;
  comments: number;
  dealsPosted: number;
  productsReviewed: number;
  memberSince: string;
};

function ProfilePage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<UserActivity>({
    votes: 0,
    comments: 0,
    dealsPosted: 0,
    productsReviewed: 0,
    memberSince: 'Styczeń 2024'
  });
  const [recentComments, setRecentComments] = useState<Comment[]>([]);
  const [favoriteDeals, setFavoriteDeals] = useState<Deal[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  
  // Filtry dla komentarzy
  const [commentFilter, setCommentFilter] = useState<'all' | 'deals' | 'products'>('all');
  const [commentSort, setCommentSort] = useState<'newest' | 'oldest'>('newest');
  const [commentsWithContext, setCommentsWithContext] = useState<Array<Comment & { 
    itemTitle?: string; 
    itemType?: 'deal' | 'product';
  }>>([]);

  useEffect(() => {
    if (!user) return;

    async function fetchUserData() {
      if (!user) return;
      
      setLoading(true);
      try {
        // Pobierz komentarze użytkownika
        const commentsQuery = query(
          collection(db, 'comments'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        const comments = commentsSnapshot.docs.map(doc => { 
          const data = doc.data();
          return {
            id: doc.id, 
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
          } as Comment;
        });

        // Pobierz dodane okazje użytkownika
        const userDealsQuery = query(
          collection(db, 'deals'),
          where('createdBy', '==', user.uid),
          limit(10)
        );
        const userDealsSnapshot = await getDocs(userDealsQuery);
        const userDeals = userDealsSnapshot.docs.length;

        // Pobierz oceny produktów użytkownika
        const ratingsQuery = query(
          collection(db, 'productRatings'),
          where('userId', '==', user.uid),
          limit(10)
        );
        const ratingsSnapshot = await getDocs(ratingsQuery);
        const ratingsCount = ratingsSnapshot.docs.length;

        // Mock głosy - wymaga query na subkolekcjach
        const voteCount = 15;

        setActivity({
          votes: voteCount,
          comments: comments.length,
          dealsPosted: userDeals,
          productsReviewed: ratingsCount,
          memberSince: 'Styczeń 2024'
        });

        setRecentComments(comments.slice(0, 5));
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user]);

  // Pobierz kontekst komentarzy (tytuły okazji/produktów)
  useEffect(() => {
    if (!user || recentComments.length === 0) return;

    async function enrichComments() {
      const enriched = await Promise.all(
        recentComments.map(async (comment) => {
          try {
            // Comment ma dealId, sprawdźmy czy to deal czy product
            // Spróbuj najpierw pobrać jako deal
            const deal = await getDealById(comment.dealId);
            if (deal) {
              return { ...comment, itemTitle: deal.title, itemType: 'deal' as const };
            }
            
            // Jeśli nie deal, to może product
            const product = await getProductById(comment.dealId); // dealId jest używane dla obu typów
            if (product) {
              return { ...comment, itemTitle: product.name, itemType: 'product' as const };
            }
            
            return comment;
          } catch (error) {
            console.error('Error enriching comment:', error);
            return comment;
          }
        })
      );
      setCommentsWithContext(enriched);
    }

    enrichComments();
  }, [recentComments, user]);

  // Pobierz ulubione gdy zakładka jest aktywna
  useEffect(() => {
    if (!user || activeTab !== 'favorites') return;

    async function fetchFavorites() {
      if (!user) return;
      
      setFavoritesLoading(true);
      try {
        const [deals, products] = await Promise.all([
          getFavoriteDeals(user.uid, 20),
          getFavoriteProducts(user.uid, 20)
        ]);
        setFavoriteDeals(deals);
        setFavoriteProducts(products);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setFavoritesLoading(false);
      }
    }

    fetchFavorites();
  }, [user, activeTab]);

  if (!user) {
    return null;
  }

  const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <h3 className="text-2xl font-bold mt-2">{value}</h3>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User avatar'} />}
            <AvatarFallback className="text-2xl">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
              <h1 className="text-3xl font-bold">{user.displayName || 'Użytkownik'}</h1>
              <Badge variant="secondary" className="w-fit">
                <Calendar className="h-3 w-3 mr-1" />
                Członek od {activity.memberSince}
              </Badge>
            </div>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/profile/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Ustawienia
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Wyloguj
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Statystyki */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ThumbsUp} label="Głosy oddane" value={activity.votes} />
        <StatCard icon={MessageSquare} label="Komentarze" value={activity.comments} />
        <StatCard icon={Flame} label="Dodane okazje" value={activity.dealsPosted} />
        <StatCard icon={Award} label="Oceny produktów" value={activity.productsReviewed} />
      </div>

      {/* Zakładki */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Przegląd</span>
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Ulubione</span>
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Komentarze</span>
          </TabsTrigger>
          <TabsTrigger value="deals" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            <span className="hidden sm:inline">Moje okazje</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Powiadomienia</span>
          </TabsTrigger>
        </TabsList>

        {/* Przegląd */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Ostatnia aktywność
                </CardTitle>
                <CardDescription>Twoje ostatnie działania</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : recentComments.length > 0 ? (
                  <div className="space-y-4">
                    {recentComments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 p-3 border rounded-lg">
                        <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2">{comment.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(comment.createdAt).toLocaleDateString('pl-PL')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Brak aktywności</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Osiągnięcia
                </CardTitle>
                <CardDescription>Zdobyte odznaki</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {activity.comments >= 10 && (
                    <div className="flex flex-col items-center p-3 border rounded-lg">
                      <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-2">
                        <MessageSquare className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="text-xs font-medium text-center">Komentator</p>
                    </div>
                  )}
                  {activity.votes >= 50 && (
                    <div className="flex flex-col items-center p-3 border rounded-lg">
                      <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-2">
                        <ThumbsUp className="h-6 w-6 text-purple-600" />
                      </div>
                      <p className="text-xs font-medium text-center">Głosujący</p>
                    </div>
                  )}
                  {activity.dealsPosted >= 5 && (
                    <div className="flex flex-col items-center p-3 border rounded-lg">
                      <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-2">
                        <Flame className="h-6 w-6 text-orange-600" />
                      </div>
                      <p className="text-xs font-medium text-center">Łowca</p>
                    </div>
                  )}
                  {activity.comments < 10 && activity.votes < 50 && activity.dealsPosted < 5 && (
                    <div className="col-span-3 text-center py-8 text-muted-foreground">
                      <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Bądź aktywny, aby zdobywać odznaki!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Dodaj swoją pierwszą okazję!</h3>
                  <p className="text-sm text-muted-foreground">
                    Podziel się świetnymi znaleziskami ze społecznością.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/add-deal">
                    <Flame className="h-4 w-4 mr-2" />
                    Dodaj okazję
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ulubione */}
        <TabsContent value="favorites">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Ulubione
              </CardTitle>
              <CardDescription>Zapisane okazje i produkty ({favoriteDeals.length + favoriteProducts.length})</CardDescription>
            </CardHeader>
            <CardContent>
              {favoritesLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">Ładowanie ulubionych...</p>
                </div>
              ) : favoriteDeals.length === 0 && favoriteProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">Brak ulubionych</h3>
                  <p className="text-muted-foreground mb-4">
                    Zacznij dodawać okazje i produkty do ulubionych, klikając ikonę serca.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href="/deals">Przeglądaj okazje</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Ulubione okazje */}
                  {favoriteDeals.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        Okazje ({favoriteDeals.length})
                      </h3>
                      <div className="space-y-4">
                        {favoriteDeals.map((deal) => (
                          <DealListCard key={deal.id} deal={deal} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ulubione produkty */}
                  {favoriteProducts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Produkty ({favoriteProducts.length})
                      </h3>
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {favoriteProducts.map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Komentarze */}
        <TabsContent value="comments">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Komentarze
                  </CardTitle>
                  <CardDescription>Historia komentarzy ({commentsWithContext.length})</CardDescription>
                </div>
                
                {/* Filtry */}
                <div className="flex gap-2">
                  <Select value={commentFilter} onValueChange={(value: any) => setCommentFilter(value)}>
                    <SelectTrigger className="w-[140px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie</SelectItem>
                      <SelectItem value="deals">Okazje</SelectItem>
                      <SelectItem value="products">Produkty</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={commentSort} onValueChange={(value: any) => setCommentSort(value)}>
                    <SelectTrigger className="w-[140px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Najnowsze</SelectItem>
                      <SelectItem value="oldest">Najstarsze</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : commentsWithContext.length > 0 ? (
                <div className="space-y-4">
                  {commentsWithContext
                    .filter(comment => {
                      if (commentFilter === 'all') return true;
                      if (commentFilter === 'deals') return comment.itemType === 'deal';
                      if (commentFilter === 'products') return comment.itemType === 'product';
                      return true;
                    })
                    .sort((a, b) => {
                      const dateA = new Date(a.createdAt).getTime();
                      const dateB = new Date(b.createdAt).getTime();
                      return commentSort === 'newest' ? dateB - dateA : dateA - dateB;
                    })
                    .map((comment) => (
                      <div key={comment.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            comment.itemType === 'deal' ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-primary/10'
                          }`}>
                            {comment.itemType === 'deal' ? (
                              <Flame className="h-5 w-5 text-orange-500" />
                            ) : (
                              <Package className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Link do okazji/produktu */}
                            {comment.itemTitle && (
                              <Link 
                                href={comment.itemType === 'deal' ? `/deals/${comment.dealId}` : `/products/${comment.dealId}`}
                                className="text-sm font-medium text-primary hover:underline mb-2 flex items-center gap-1 group"
                              >
                                <span className="truncate">{comment.itemTitle}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            )}
                            
                            {/* Treść komentarza */}
                            <p className="text-sm mb-2 text-foreground">{comment.content}</p>
                            
                            {/* Meta info */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(comment.createdAt).toLocaleDateString('pl-PL', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {comment.itemType === 'deal' ? 'Okazja' : 'Produkt'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">Brak komentarzy</h3>
                  <p className="text-muted-foreground mb-4">
                    Zacznij komentować okazje i produkty
                  </p>
                  <Button variant="outline" asChild>
                    <Link href="/deals">Przeglądaj okazje</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Moje okazje */}
        <TabsContent value="deals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5" />
                Moje okazje
              </CardTitle>
              <CardDescription>Dodane przez Ciebie</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Flame className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">Brak okazji</h3>
                <Button asChild>
                  <Link href="/add-deal">
                    <Flame className="h-4 w-4 mr-2" />
                    Dodaj okazję
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Powiadomienia */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Powiadomienia
              </CardTitle>
              <CardDescription>Centrum powiadomień</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">System powiadomień wkrótce!</h3>
                <p className="text-muted-foreground">
                  Funkcja w przygotowaniu.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(ProfilePage);
