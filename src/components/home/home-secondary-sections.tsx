'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Heart,
  Bell,
  Gift,
  MessageSquare,
  Zap,
  ArrowRight,
  Sparkles,
  Target,
  ShieldCheck,
  Trophy,
  ChevronRight,
  Flame,
  ShoppingBag,
} from 'lucide-react';

import { ForumStats } from '@/components/home/real-time-stats';

export default function HomeSecondarySections() {
  const t = useTranslations('home');
  const locale = useLocale();

  return (
    <>
      {/* FORUM TEASER */}
      <section className="py-20 bg-gradient-to-b from-card/30 to-card/10 border-y border-border/40">
        <div className="page-container">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-12 gap-12 items-center">
              {/* Left Column: Text & Action CTAs */}
              <div className="md:col-span-6 space-y-6 text-left">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <MessageSquare className="h-8 w-8 animate-pulse" />
                </div>
                <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                  {t('forum.title')}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {t('forum.subtitle')}
                </p>

                <div className="flex flex-wrap gap-4 pt-2">
                  <Button size="lg" variant="outline" className="rounded-xl font-semibold shadow-sm" asChild>
                    <Link href={`/${locale}/forum`}>
                      {t('forum.browseButton')}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-md" asChild>
                    <Link href={`/${locale}/forum/new`}>
                      {t('forum.createButton')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Right Column: Forum Real-time Stats Card */}
              <div className="md:col-span-6">
                <Card className="border border-border/30 bg-background/60 backdrop-blur-md rounded-3xl shadow-lg p-6 sm:p-8 hover:shadow-2xl transition-all duration-300">
                  <ForumStats />
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT / MISSION */}
      <section className="py-16">
        <div className="page-container">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <Badge className="text-base px-4 py-2 rounded-xl">
                  <Target className="mr-2 h-4 w-4 text-primary" />
                  {t('about.badge')}
                </Badge>
                <h2 className="font-headline text-3xl md:text-4xl font-bold leading-tight">
                  {t('about.title')}
                  <br />
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

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>100% darmowa platforma</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>Sprawdzone przez społeczność</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>AI wspierające jakość</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <Card className="border border-border/40 bg-background/60 backdrop-blur-md rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-4">
                      {[
                        { icon: Sparkles, title: 'Sprawdzone AI', desc: 'Algorytmy weryfikują jakość ofert' },
                        { icon: Users, title: 'Społeczność', desc: 'Tysiące użytkowników dzieli się znaleziskami' },
                        { icon: ShieldCheck, title: 'Moderacja', desc: 'Każda okazja przechodzi weryfikację' },
                        { icon: Zap, title: 'Real-time', desc: 'Natychmiastowe powiadomienia o nowych okazjach' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
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
      <section className="py-20 relative overflow-hidden bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-white rounded-3xl mx-4 sm:mx-6 my-16 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
        <div className="page-container text-center relative z-10">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="font-headline text-3xl md:text-5xl font-black tracking-tight">
              Gotowy na najlepsze okazje?
            </h2>
            <p className="text-base sm:text-xl opacity-90 max-w-xl mx-auto font-medium">
              Dołącz do tysięcy użytkowników, którzy już oszczędzają z Okazje Plus.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-6">
              <Button size="lg" variant="secondary" className="text-sm font-bold px-8 py-6 rounded-xl hover:shadow-lg transition-all" asChild>
                <Link href={`/${locale}/deals`}>
                  <Flame className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 text-primary fill-primary" />
                  Przeglądaj okazje
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-sm font-bold px-8 py-6 rounded-xl border-white/40 bg-black/15 backdrop-blur-[2px] text-white hover:bg-black/35 hover:border-white transition-all shadow-sm" asChild>
                <Link href={`/${locale}/products`}>
                  <ShoppingBag className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Katalog produktów
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
