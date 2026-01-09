'use client';

import { useTranslations } from 'next-intl';
import ComingSoonLanding from '@/components/coming-soon-landing';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <div>
      <ComingSoonLanding />
    </div>
  );
}
