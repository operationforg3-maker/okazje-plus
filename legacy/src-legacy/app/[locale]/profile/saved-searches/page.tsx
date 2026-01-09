'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import SavedSearchesList from '@/components/saved-searches-list';
import SavedSearchDialog from '@/components/saved-search-dialog';

export default function SavedSearchesPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Zapisane wyszukiwania
          </h1>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nowe wyszukiwanie
          </Button>
        </div>
        <p className="text-muted-foreground">
          Zarządzaj swoimi zapisanymi wyszukiwaniami i otrzymuj powiadomienia o nowych okazjach
        </p>
      </div>

      <SavedSearchesList />

      <SavedSearchDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
