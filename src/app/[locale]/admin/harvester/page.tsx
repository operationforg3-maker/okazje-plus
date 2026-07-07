'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';

function HarvesterPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const localePrefix = (() => {
      const first = pathname.split('/')[1];
      return ['pl', 'en', 'de'].includes(first) ? `/${first}` : '';
    })();
    router.replace(`${localePrefix}/admin/import`);
  }, [router, pathname]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Przekierowywanie do pulpitu importu M6...</p>
    </div>
  );
}

export default withAuth(HarvesterPage, { requiredRole: 'admin' });
