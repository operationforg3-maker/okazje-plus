import React from 'react';
import { LayoutGrid, List as ListIcon, Columns } from 'lucide-react';
import { useUX } from '@/context/UXContext';
import { cn } from '@/lib/utils';

export function ViewModeSwitcher() {
  const { viewMode, setViewMode } = useUX();
  return (
    <div className="flex items-center space-x-2">
      <button
        className={cn('p-2 rounded', viewMode === 'grid' && 'bg-primary/10')}
        onClick={() => setViewMode('grid')}
        aria-label="Grid view"
      >
        <LayoutGrid size={20} />
      </button>
      <button
        className={cn('p-2 rounded', viewMode === 'list' && 'bg-primary/10')}
        onClick={() => setViewMode('list')}
        aria-label="List view"
      >
        <ListIcon size={20} />
      </button>
      <button
        className={cn('p-2 rounded', viewMode === 'masonry' && 'bg-primary/10')}
        onClick={() => setViewMode('masonry')}
        aria-label="Masonry view"
      >
        <Columns size={20} />
      </button>
    </div>
  );
}
