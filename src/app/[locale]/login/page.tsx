import { Sparkles, ShieldCheck, Timer } from "lucide-react";
import LoginForm from "@/components/auth/login-form";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import { LogoSVGWrapper } from '@/components/layout/logo-svg-wrapper';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  return {
    title: t('title'),
  };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  
  return (
    <div className="container relative flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center gap-8 py-12">
      {/* Main Login Form - Primary Focus */}
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
          <div className="relative flex flex-col gap-6 p-8 sm:p-10">
            <div className="flex flex-col space-y-3 text-center">
              <Link href="/" className="flex items-center justify-center mb-2" aria-label="Powrót do strony głównej">
                <LogoSVGWrapper className="h-12 w-auto" />
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight font-headline">
                {t('title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('subtitle')}
              </p>
            </div>
            <LoginForm />
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                {t('noAccount')}{' '}
                <Link
                  href="/register"
                  className="font-semibold text-primary hover:underline underline-offset-2"
                >
                  {t('signUp')}
                </Link>
              </p>
              <Link
                href="/forgot-password"
                className="block text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
              >
                {t('forgotPassword')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Info - Secondary, Below Form */}
      <div className="mx-auto w-full max-w-4xl">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/90 via-primary to-primary/70 p-8 text-white shadow-xl sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.1),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.06),transparent_30%)]" />
          <div className="relative space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-sm text-primary-foreground/80">{t('brand.kicker')}</p>
              <h2 className="font-headline text-2xl font-semibold leading-tight sm:text-3xl">{t('brand.title')}</h2>
              <p className="text-sm text-primary-foreground/80">{t('brand.subtitle')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-white/10 px-4 py-4 text-center backdrop-blur">
                <Sparkles className="h-5 w-5" />
                <div className="text-sm font-medium">{t('brand.points.quality')}</div>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-xl bg-white/10 px-4 py-4 text-center backdrop-blur">
                <ShieldCheck className="h-5 w-5" />
                <div className="text-sm font-medium">{t('brand.points.secure')}</div>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-xl bg-white/10 px-4 py-4 text-center backdrop-blur">
                <Timer className="h-5 w-5" />
                <div className="text-sm font-medium">{t('brand.points.fast')}</div>
              </div>
            </div>
            <div className="text-center text-xs text-primary-foreground/70">
              {t('brand.footer')}
            </div>
          </div>
        </div>
      </div>

      {/* Terms Footer */}
      <p className="text-center text-xs text-muted-foreground max-w-md px-4">
        {t('termsText')}{' '}
        <Link
          href="/terms"
          className="underline underline-offset-4 hover:text-primary"
        >
          {t('termsLink')}
        </Link>{' '}
        {t('and')}{' '}
        <Link
          href="/privacy"
          className="underline underline-offset-4 hover:text-primary"
        >
          {t('privacyLink')}
        </Link>
        .
      </p>
    </div>
  );
}
