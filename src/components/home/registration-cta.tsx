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
    <section className="py-16 bg-background">
      <div className="page-container">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 text-lg px-4 py-2">
              <Gift className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
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
              <Card key={idx} className="border-2 hover:border-primary transition-[box-shadow,border-color] hover:shadow-xl group">
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
              <Link href={`/${locale}/login`}>
                <Users className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
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
  );
}
