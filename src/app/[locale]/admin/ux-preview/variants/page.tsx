import React from 'react';
import { UXVariantsPlayground } from '@/components/admin/ux-variants-playground';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function UXVariantsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/20 pb-4">
        <div>
          <h1 className="font-headline text-3xl font-black tracking-tight text-foreground">
            Warianty Interfejsu (UX Playground)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Laboratorium testowe i audytor nowych stylów wizualnych dla Okazje+
          </p>
        </div>
        <Button asChild>
          <Link href="/new-ux">Uruchom Prototypy Nowego UX</Link>
        </Button>
      </div>

      <UXVariantsPlayground />
    </div>
  );
}
