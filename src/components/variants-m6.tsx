'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Variant {
  name: string;
  options: string[];
  selectedIndex: number;
}

interface VariantsM6Props {
  specs: Record<string, string>;
  onVariantChange?: (variantName: string, selectedValue: string) => void;
}

export default function VariantsM6({ specs, onVariantChange }: VariantsM6Props) {
  // Parse variants from specs - pattern: variant_N_name
  const variants = useMemo<Variant[]>(() => {
    if (!specs || typeof specs !== 'object') return [];

    const variantMap = new Map<string, Set<string>>();
    const maxVariantIndex: Record<number, string> = {};

    // Extract variants with pattern variant_N_name = "value1, value2, ..."
    Object.entries(specs).forEach(([key, value]) => {
      const match = key.match(/^variant_(\d+)_(.+)$/);
      if (match) {
        const [, indexStr, name] = match;
        const index = parseInt(indexStr, 10);
        
        if (!maxVariantIndex[index] || name < maxVariantIndex[index]) {
          maxVariantIndex[index] = name;
        }

        if (!variantMap.has(name)) {
          variantMap.set(name, new Set());
        }

        // Parse comma-separated values
        if (typeof value === 'string') {
          value.split(',').forEach((option) => {
            variantMap.get(name)?.add(option.trim());
          });
        }
      }
    });

    // Convert to array format
    return Array.from(variantMap.entries()).map(([name, options]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize
      options: Array.from(options).sort(),
      selectedIndex: 0,
    }));
  }, [specs]);

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    Object.fromEntries(variants.map((v) => [v.name, v.options[0]]))
  );

  const handleVariantSelect = (variantName: string, value: string) => {
    const newSelection = {
      ...selectedVariants,
      [variantName]: value,
    };
    setSelectedVariants(newSelection);

    if (onVariantChange) {
      onVariantChange(variantName, value);
    }
  };

  if (variants.length === 0) {
    return null; // No variants to display
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Opcje produktu</CardTitle>
        <CardDescription>
          Wybierz warianty dostępne dla tego produktu
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants.map((variant) => (
          <div key={variant.name} className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {variant.name}
            </label>
            <div className="flex flex-wrap gap-2">
              {variant.options.map((option) => (
                <Button
                  key={option}
                  variant={selectedVariants[variant.name] === option ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleVariantSelect(variant.name, option)}
                  className="whitespace-nowrap"
                >
                  {option}
                </Button>
              ))}
            </div>
            {selectedVariants[variant.name] && (
              <p className="text-xs text-gray-600">
                Wybrane: <span className="font-semibold">{selectedVariants[variant.name]}</span>
              </p>
            )}
          </div>
        ))}

        {/* Summary of selected variants */}
        {Object.entries(selectedVariants).length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs font-medium text-blue-900">Podsumowanie wybranego wariantu:</p>
            <div className="mt-2 space-y-1">
              {Object.entries(selectedVariants).map(([name, value]) => (
                <p key={name} className="text-xs text-blue-800">
                  <span className="font-semibold">{name}:</span> {value}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
