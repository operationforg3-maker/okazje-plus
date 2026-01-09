import { ShoppingBag } from "lucide-react";
import LoginForm from "@/components/auth/login-form";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'login' });
  return {
    title: t('title'),
  };
}

export default function LoginPage() {
  const t = useTranslations('login');
  
  return (
    <div className="container relative flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
            <Link href="/" className="flex items-center justify-center gap-2 mb-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
              <span className="font-bold font-headline text-2xl">Okazje+</span>
            </Link>
          <h1 className="text-2xl font-semibold tracking-tight font-headline">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <LoginForm />
        
        {/* Sign up + Forgot Password Links */}
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
        
        <p className="px-8 text-center text-sm text-muted-foreground">
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
    </div>
  );
}
