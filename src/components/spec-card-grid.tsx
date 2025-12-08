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
    <section className={cn('rounded-xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm', className)}>
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Badge variant="secondary" className="text-xs">{visible.length} kluczowe parametry</Badge>
          <span>{title}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
        {visible.map((spec, idx) => (
          <div
            key={`${spec.key || spec.name || spec.label || 'spec'}-${idx}`}
            className="rounded-lg border border-border/50 bg-muted/40 p-3 shadow-xs"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {spec.label || spec.name || spec.key || 'Parametr'}
            </p>
            <p className="text-sm font-semibold text-foreground break-words">{String(spec.value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
