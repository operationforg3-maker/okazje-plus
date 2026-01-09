import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps<T> {
  columnKey: keyof T;
  sortConfig: { key: keyof T; direction: 'asc' | 'desc' } | null;
  onSort: (key: keyof T) => void;
  children: React.ReactNode;
  className?: string;
}

export function SortableTableHead<T>({
  columnKey,
  sortConfig,
  onSort,
  children,
  className,
}: SortableTableHeadProps<T>) {
  const isSorted = sortConfig?.key === columnKey;
  const direction = isSorted ? sortConfig.direction : null;

  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(columnKey)}
        className={cn(
          "flex items-center gap-2 hover:text-foreground transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1 -mx-2 -my-1",
          isSorted && "text-foreground font-semibold"
        )}
      >
        {children}
        {direction === 'asc' && <ArrowUp className="h-4 w-4" />}
        {direction === 'desc' && <ArrowDown className="h-4 w-4" />}
        {!direction && <ArrowUpDown className="h-4 w-4 opacity-30" />}
      </button>
    </TableHead>
  );
}
