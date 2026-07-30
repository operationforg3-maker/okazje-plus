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
  Zap,
  ShieldCheck,
  Trophy,
} from 'lucide-react';

export default function RegistrationCTA() {
  const t = useTranslations('home');
  const locale = useLocale();

  return (
    <section className="py-20 bg-background/50 border-t border-border/20">
      <div className="page-container">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Title, Subtitle and Main CTA */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="inline-block">
                <Badge className="text-base px-4 py-2 rounded-xl">
                  <Gift className="mr-2 h-4 w-4 text-primary animate-pulse" />
                  {t('benefits.badge')}
                </Badge>
              </div>
              <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                {t('benefits.title')}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t('benefits.subtitle')}
              </p>

              <div className="pt-2">
                <Button size="lg" className="text-lg px-8 py-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto shadow-md" asChild>
                  <Link href={`/${locale}/login`}>
                    <Users className="mr-2 h-5 w-5" />
                    {t('benefits.joinButton')}
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  {t('benefits.joinSubtext')}
                </p>
                <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span>{t('benefits.gdpr')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span>{t('benefits.ssl')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Cards Grid */}
            <div className="lg:col-span-7">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Bell,
                    title: t('benefits.items.notifications.title'),
                    description: t('benefits.items.notifications.description'),
                    color: 'from-blue-500/10 to-cyan-500/10 text-blue-500 border-blue-500/20',
                  },
                  {
                    icon: Heart,
                    title: t('benefits.items.favorites.title'),
                    description: t('benefits.items.favorites.description'),
                    color: 'from-pink-500/10 to-rose-500/10 text-rose-500 border-rose-500/20',
                  },
                  {
                    icon: Zap,
                    title: t('benefits.items.exclusive.title'),
                    description: t('benefits.items.exclusive.description'),
                    color: 'from-orange-500/10 to-yellow-500/10 text-orange-500 border-orange-500/20',
                  },
                  {
                    icon: Users,
                    title: t('benefits.items.community.title'),
                    description: t('benefits.items.community.description'),
                    color: 'from-green-500/10 to-emerald-500/10 text-emerald-500 border-emerald-500/20',
                  },
                  {
                    icon: Trophy,
                    title: t('benefits.items.points.title'),
                    description: t('benefits.items.points.description'),
                    color: 'from-purple-500/10 to-indigo-500/10 text-purple-500 border-purple-500/20',
                  },
                  {
                    icon: ShieldCheck,
                    title: t('benefits.items.verified.title'),
                    description: t('benefits.items.verified.description'),
                    color: 'from-teal-500/10 to-blue-500/10 text-teal-500 border-teal-500/20',
                  },
                ].map((benefit, idx) => (
                  <Card key={idx} className="border border-border/30 hover:border-primary/40 bg-card/60 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
                    <CardHeader className="p-5 pb-2">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${benefit.color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border`}>
                        <benefit.icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg font-semibold tracking-tight">{benefit.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                        {benefit.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
