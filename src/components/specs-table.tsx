'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SpecsTableProps {
  specs: Record<string, string>;
  title?: string;
}

/**
 * SpecsTable - Clean, zebra-striped table for product specifications
 * Renders specs as key-value pairs in a professional format
 */
export function SpecsTable({ specs, title = 'Specifications' }: SpecsTableProps) {
  if (!specs || Object.keys(specs).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No specifications available</p>
        </CardContent>
      </Card>
    );
  }

  // Group specs by category (optional - for better organization)
  const specCategories = groupSpecsByCategory(specs);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {Object.keys(specs).length} specification{Object.keys(specs).length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Specification</TableHead>
                <TableHead className="text-right font-semibold">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(specs).map(([key, value], index) => (
                <TableRow
                  key={key}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <TableCell className="font-medium text-gray-700">
                    {formatSpecKey(key)}
                  </TableCell>
                  <TableCell className="text-right text-gray-900">
                    {value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format spec key for display
 * e.g., "RAM" -> "RAM", "storage_type" -> "Storage Type"
 */
function formatSpecKey(key: string): string {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/_/g, ' ') // Replace underscores with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

/**
 * Group specs by category for better organization
 */
function groupSpecsByCategory(specs: Record<string, string>): Record<string, Record<string, string>> {
  const categories: Record<string, Record<string, string>> = {
    'Performance': {},
    'Display': {},
    'Memory': {},
    'Physical': {},
    'Other': {},
  };

  const categoryMap: Record<string, string> = {
    'processor': 'Performance',
    'cpu': 'Performance',
    'gpu': 'Performance',
    'ram': 'Memory',
    'memory': 'Memory',
    'storage': 'Memory',
    'disk': 'Memory',
    'screen': 'Display',
    'display': 'Display',
    'resolution': 'Display',
    'refresh': 'Display',
    'weight': 'Physical',
    'dimensions': 'Physical',
    'color': 'Physical',
  };

  for (const [key, value] of Object.entries(specs)) {
    const lowerKey = key.toLowerCase();
    let category = 'Other';

    for (const [keyword, cat] of Object.entries(categoryMap)) {
      if (lowerKey.includes(keyword)) {
        category = cat;
        break;
      }
    }

    categories[category][key] = value;
  }

  // Remove empty categories
  for (const cat in categories) {
    if (Object.keys(categories[cat]).length === 0) {
      delete categories[cat];
    }
  }

  return categories;
}
