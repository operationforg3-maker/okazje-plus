// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DealCard from '@/components/deal-card';
import ProductCard from '@/components/product-card';
import {
  Search,
  Flame,
  TrendingUp,
  ShoppingBag,
  Users,
  Heart,
  Bell,
  Gift,
  MessageSquare,
  Star,
  Zap,
  ArrowRight,
  Sparkles,
  Target,
  ShieldCheck,
  Trophy,
  ChevronRight,
} from 'lucide-react';

interface Props {
  initialHotDeals: Deal[];
  initialTopProducts: Product[];
  categories: Category[];
}

export default function HomeClient({ initialHotDeals, initialTopProducts, categories }: Props) {
  const router = useRouter();
  const t = useTranslations('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="page-container relative py-16 md:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Logo & Tagline */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold animate-bounce">
                <Sparkles className="h-4 w-4" />
                {t('hero.badge')}
              </div>
              
              <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                {t('hero.title.discover')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{t('hero.title.best')}</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary">{t('hero.title.deals')}</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                {t('hero.subtitle')}
              </p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder={t('hero.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-32 py-6 text-lg rounded-full border-2 focus:border-primary shadow-lg"
                />
                <Button 
                  type="submit"
                  size="lg"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                >
                  {t('hero.searchButton')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { icon: Flame, label: t('stats.hotDeals'), value: initialHotDeals.length, color: 'text-orange-500' },
                { icon: ShoppingBag, label: t('stats.products'), value: initialTopProducts.length, color: 'text-blue-500' },
                { icon: Users, label: t('stats.community'), value: '1000+', color: 'text-green-500' },
                { icon: Trophy, label: t('stats.savings'), value: '100k+', color: 'text-purple-500' },
              ].map((stat, idx) => (
                <Card key={idx} className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                  <CardContent className="p-4 text-center">
                    <stat.icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES SHOWCASE */}
      <section className="py-12 bg-card/50">
        <div className="page-container">
          <div className="text-center mb-8">
            <h2 className="font-headline text-3xl md:text-4xl font-bold mb-2">
              {t('categories.title')}
            </h2>
            <p className="text-muted-foreground">{t('categories.subtitle')}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug || category.id}`}
                className="group"
                onMouseEnter={() => setHoveredCategory(category.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <Card className="h-full border-2 hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1">
                  <CardContent className="p-6 text-center space-y-2">
                    <div className="text-4xl mb-2 transition-transform group-hover:scale-110">
                      {category.icon || '📦'}
                    </div>
                    <div className="font-semibold text-sm leading-tight">
                      {category.name}
                    </div>
                    {hoveredCategory === category.id && category.subcategories && (
                      <div className="text-xs text-muted-foreground">
                        {category.subcategories.length} {t('categories.subcategories')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" size="lg" asChild>
              <Link href="/products">
                {t('categories.viewAll')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* HOT DEALS SECTION */}
      <section className="py-16">
        <div className="page-container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-8 w-8 text-orange-500" />
                <h2 className="font-headline text-3xl md:text-4xl font-bold">
                  {t('hotDeals.title')}
                </h2>
              </div>
              <p className="text-muted-foreground">{t('hotDeals.subtitle')}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/deals">
                {t('hotDeals.viewAll')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {initialHotDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {initialHotDeals.slice(0, 8).map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('hotDeals.empty')}
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* TOP PRODUCTS SECTION */}
      <section className="py-16 bg-card/50">
        <div className="page-container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-8 w-8 text-amber-500" />
                <h2 className="font-headline text-3xl md:text-4xl font-bold">
                  {t('topProducts.title')}
                </h2>
              </div>
              <p className="text-muted-foreground">{t('topProducts.subtitle')}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/products">
                {t('topProducts.viewAll')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {initialTopProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {initialTopProducts.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('topProducts.empty')}
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* BENEFITS SECTION - Zachęta do rejestracji */}
      <section className="py-16">
        <div className="page-container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 text-lg px-4 py-2">
                <Gift className="mr-2 h-5 w-5" />
                {t('benefits.badge')}
              </Badge>
              <h2 className="font-headline text-4xl md:text-5xl font-bold mb-4">
                {t('benefits.title')}
              </h2>
              <p className="text-xl text-muted-foreground">
                {t('benefits.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Bell,
                  title: t('benefits.items.notifications.title'),
                  description: t('benefits.items.notifications.description'),
                  color: 'from-blue-500 to-cyan-500',
                },
                {
                  icon: Heart,
                  title: t('benefits.items.favorites.title'),
                  description: t('benefits.items.favorites.description'),
                  color: 'from-pink-500 to-rose-500',
                },
                {
                  icon: Zap,
                  title: t('benefits.items.exclusive.title'),
                  description: t('benefits.items.exclusive.description'),
                  color: 'from-orange-500 to-yellow-500',
                },
                {
                  icon: Users,
                  title: t('benefits.items.community.title'),
                  description: t('benefits.items.community.description'),
                  color: 'from-green-500 to-emerald-500',
                },
                {
                  icon: Trophy,
                  title: t('benefits.items.points.title'),
                  description: t('benefits.items.points.description'),
                  color: 'from-purple-500 to-indigo-500',
                },
                {
                  icon: ShieldCheck,
                  title: t('benefits.items.verified.title'),
                  description: t('benefits.items.verified.description'),
                  color: 'from-teal-500 to-blue-500',
                },
              ].map((benefit, idx) => (
                <Card key={idx} className="border-2 hover:border-primary transition-all hover:shadow-xl group">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${benefit.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <benefit.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {benefit.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/login">
                  <Users className="mr-2 h-5 w-5" />
                  {t('benefits.joinButton')}
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                {t('benefits.joinSubtext')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FORUM TEASER */}
      <section className="py-16 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent">
        <div className="page-container">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <MessageSquare className="h-16 w-16 mx-auto text-primary" />
            <h2 className="font-headline text-3xl md:text-4xl font-bold">
              {t('forum.title')}
            </h2>
            <p className="text-xl text-muted-foreground">
              {t('forum.subtitle')}
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="outline" asChild>
                <Link href="/forum">
                  {t('forum.browseButton')}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" asChild>
                <Link href="/forum/new">
                  {t('forum.createButton')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Forum stats */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto pt-8">
              {[
                { label: 'Aktywnych wątków', value: '500+' },
                { label: 'Użytkowników', value: '1000+' },
                { label: 'Odpowiedzi dziennie', value: '200+' },
              ].map((stat, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT / MISSION */}
      <section className="py-16">
        <div className="page-container">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <Badge className="text-base px-4 py-2">
                  <Target className="mr-2 h-4 w-4" />
                  {t('about.badge')}
                </Badge>
                <h2 className="font-headline text-3xl md:text-4xl font-bold">
                  {t('about.title')}<br />
                  <span className="text-primary">{t('about.titleHighlight')}</span>
                </h2>
                <div className="space-y-4 text-muted-foreground">
                  <p className="text-lg">
                    <strong className="text-foreground">Okazje Plus</strong> to polska platforma stworzona przez i dla społeczności 
                    łowców okazji. Naszym celem jest pomóc Ci znaleźć najlepsze promocje, 
                    produkty i oferty specjalne w jednym miejscu.
                  </p>
                  <p className="text-lg">
                    Wierzymy, że mądre zakupy to nie tylko oszczędności finansowe, ale także 
                    czas zaoszczędzony na przeglądaniu dziesiątek sklepów. Dzięki aktywnej 
                    społeczności i zaawansowanej sztucznej inteligencji, dostarczamy Ci 
                    tylko <strong className="text-foreground">sprawdzone i wartościowe okazje</strong>.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>100% darmowa platforma</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Sprawdzone przez społeczność</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>AI wspierające jakość</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <Card className="border-2">
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-4">
                      {[
                        { icon: Sparkles, title: 'Sprawdzone AI', desc: 'Algorytmy weryfikują jakość ofert' },
                        { icon: Users, title: 'Społeczność', desc: 'Tysiące użytkowników dzieli się znaleziskami' },
                        { icon: ShieldCheck, title: 'Moderacja', desc: 'Każda okazja przechodzi weryfikację' },
                        { icon: Zap, title: 'Real-time', desc: 'Natychmiastowe powiadomienia o nowych okazjach' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-semibold mb-1">{item.title}</div>
                            <div className="text-sm text-muted-foreground">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-16 bg-gradient-to-r from-primary to-accent text-white">
        <div className="page-container text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="font-headline text-3xl md:text-5xl font-bold">
              Gotowy na najlepsze okazje?
            </h2>
            <p className="text-xl opacity-90">
              Dołącz do tysięcy użytkowników, którzy już oszczędzają z Okazje Plus
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6" asChild>
                <Link href="/deals">
                  <Flame className="mr-2 h-5 w-5" />
                  Przeglądaj okazje
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-white text-white hover:bg-white/10" asChild>
                <Link href="/products">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Katalog produktów
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
