'use client';

import { Specification } from '@/lib/schema';
import { useMemo } from 'react';

interface SpecificationsTableProps {
  specifications: Specification[];
  maxRows?: number;
  showCategories?: boolean;
}

export function SpecificationsTable({ 
  specifications, 
  maxRows,
  showCategories = false 
}: SpecificationsTableProps) {
  // Group specs by category if enabled
  const groupedSpecs = useMemo(() => {
    if (!showCategories) {
      return { 'All': specifications };
    }
    
    const groups: Record<string, Specification[]> = {};
    
    specifications.forEach(spec => {
      const category = spec.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(spec);
    });
    
    return groups;
  }, [specifications, showCategories]);
  
  if (!specifications || specifications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Brak specyfikacji
      </div>
    );
  }
  
  const displaySpecs = maxRows 
    ? specifications.slice(0, maxRows) 
    : specifications;
  
  return (
    <div className="space-y-6">
      {Object.entries(groupedSpecs).map(([category, specs]) => (
        <div key={category}>
          {showCategories && (
            <h3 className="text-lg font-semibold mb-3">{category}</h3>
          )}
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody>
                {specs.map((spec, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-4 py-3 font-medium text-gray-700 w-1/3">
                      {spec.label}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {spec.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      
      {maxRows && specifications.length > maxRows && (
        <p className="text-sm text-muted-foreground text-center">
          ...oraz {specifications.length - maxRows} więcej
        </p>
      )}
    </div>
  );
}

/**
 * Compact inline spec display for cards
 */
export function SpecsTeaserInline({ 
  specifications,
  maxSpecs = 2 
}: { 
  specifications: Specification[];
  maxSpecs?: number;
}) {
  if (!specifications || specifications.length === 0) return null;
  
  const topSpecs = specifications.slice(0, maxSpecs);
  const text = topSpecs.map(s => `${s.label}: ${s.value}`).join(' • ');
  
  return (
    <p className="text-sm text-muted-foreground line-clamp-1">
      {text}
    </p>
  );
}
