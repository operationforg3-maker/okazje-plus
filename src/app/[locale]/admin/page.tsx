'use client';

import { useTranslations } from 'next-intl';
import { Logo } from '@/components/logo';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const t = useTranslations('admin');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo />
          <nav className="text-sm text-slate-600 dark:text-slate-400">
            {t('title')}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          {t('title')}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t('dashboard.stats')}
            </h3>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {t('dashboard.stats')}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
