'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';
import Link from 'next/link';

export default function AdminBlogPage() {
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-headline">Blog / Artykuły</h1>
          <p className="text-sm text-muted-foreground mt-1">Zarządzaj wpisami na blogu</p>
        </div>
        <div className="flex gap-2">
          <Button disabled className="gap-2">
            <Plus className="h-4 w-4" /> Nowy Artykuł
          </Button>
        </div>
      </div>
      
      <div className="bg-card border border-border/40 rounded-xl p-8 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-2">Moduł CMS w przygotowaniu</h3>
        <p className="max-w-md mx-auto">
          Zbudowaliśmy już architekturę bazy danych i strukturę tras dla Bloga. Pełny edytor wizualny będzie dostępny w kolejnej aktualizacji.
        </p>
      </div>
    </div>
  );
}
