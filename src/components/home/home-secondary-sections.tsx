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
      <section className="py-16 bg-card/40 border-y border-border/60">
        <div className="page-container">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <MessageSquare className="h-16 w-16 mx-auto text-primary" />
            <h2 className="font-headline text-4xl md:text-5xl font-bold">
              {t('forum.title')}
            </h2>
            <p className="text-xl text-muted-foreground">
              {t('forum.subtitle')}
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="outline" asChild>
                <Link href={`/${locale}/forum`}>
                  {t('forum.browseButton')}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" asChild>
                <Link href={`/${locale}/forum/new`}>
                  {t('forum.createButton')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Forum stats - Real time from database */}
            <div className="pt-4">
              <ForumStats />
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
                <Link href={`/${locale}/deals`}>
                  <Flame className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Przeglądaj okazje
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-white/40 bg-black/15 backdrop-blur-[2px] text-white hover:bg-black/35 hover:border-white transition-all shadow-sm" asChild>
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
