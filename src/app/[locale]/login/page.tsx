'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import AuthForm from '@/components/auth-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col justify-center items-center p-4">
      {/* Background gradient elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-200 dark:bg-teal-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200 dark:bg-orange-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <button
            onClick={() => router.push('/')}
            className="hover:opacity-80 transition-opacity"
          >
            <Logo />
          </button>
        </div>

        {/* Auth Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/20 dark:border-slate-700/20 rounded-2xl shadow-2xl p-8 animate-fade-in animation-delay-300">
          <AuthForm />
        </div>

        {/* Footer links */}
        <div className="mt-8 flex justify-center gap-6 text-sm text-slate-600 dark:text-slate-400 animate-fade-in animation-delay-500">
          <a
            href="#"
            className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {t('link.forgot')}
          </a>
          <span>•</span>
          <a
            href="#"
            className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {t('footer.privacy')}
          </a>
        </div>
      </div>
    </div>
  );
}
