import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type SpecEntry = {
  key?: string;
  name?: string;
  label?: string;
  value: string | number;
};

interface SpecCardGridProps {
  specs: SpecEntry[];
  title?: string;
  maxItems?: number;
  className?: string;
}

// Displays compact cards with key specs; meant for product/deal detail pages
export function SpecCardGrid({ specs, title = 'Specyfikacja', maxItems = 6, className }: SpecCardGridProps) {
  const visible = (specs || [])
    .filter((s) => s && s.value !== undefined && s.value !== null && String(s.value).trim() !== '')
    .slice(0, maxItems);

  if (visible.length === 0) return null;

  return (
    <section className={cn('spec-card-grid', className)}>
      <div className="spec-card-grid-header">
        <div className="spec-card-grid-title">
          <Badge variant="secondary" className="text-xs">{visible.length} kluczowe parametry</Badge>
          <span>{title}</span>
        </div>
      </div>
      <div className="spec-card-grid-container">
        {visible.map((spec, idx) => (
          <div
            key={`${spec.key || spec.name || spec.label || 'spec'}-${idx}`}
            className="spec-card-grid-item"
          >
            <p className="spec-card-grid-label">
              {spec.label || spec.name || spec.key || 'Parametr'}
            </p>
            <p className="spec-card-grid-value">{String(spec.value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
