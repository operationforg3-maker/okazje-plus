'use client';

import { SpecCardGrid } from '@/components/spec-card-grid';

interface SpecItem {
  name: string;
  value: string;
  key?: string;
}

interface DetailSpecTeaserProps {
  specifications: SpecItem[];
  title?: string;
}

export function DetailSpecTeaser({ specifications, title = 'Parametry kluczowe' }: DetailSpecTeaserProps) {
  if (!specifications || specifications.length === 0) return null;

  const formattedSpecs = specifications.map((s) => ({
    key: s.key || s.name,
    label: s.name || s.key || '',
    value: s.value,
  }));

  return (
    <div className="pt-2">
      <SpecCardGrid
        specs={formattedSpecs}
        title={title}
      />
    </div>
  );
}
