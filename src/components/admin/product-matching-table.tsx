'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  Trash2,
  Merge,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { getAllProductCores, getDealsForProduct, mergeProductCores } from '@/lib/data';

interface ProductMatchingTableProps {
  onMerge?: (sourceId: string, targetId: string) => void;
  status?: string;
}

/**
 * ProductMatchingTable - Admin UI for managing product duplicates
 * Shows: Product title, image, linked deals count, quality warnings
 * Actions: View details, merge with another product, delete
 */
export function ProductMatchingTable({ onMerge, status }: ProductMatchingTableProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [status]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getAllProductCores(status, 100);
      
      // Enrich with deal counts
      const enriched = await Promise.all(
        data.map(async (product) => {
          const deals = await getDealsForProduct(product.id);
          return {
            ...product,
            dealCount: deals.length,
          };
        })
      );

      setProducts(enriched);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedProduct || !mergeTargetId) return;

    setIsMerging(true);
    try {
      await mergeProductCores(selectedProduct, mergeTargetId);
      if (onMerge) {
        onMerge(selectedProduct, mergeTargetId);
      }
      setSelectedProduct(null);
      setMergeTargetId('');
      await loadProducts();
    } catch (error) {
      console.error('Error merging products:', error);
      alert('Failed to merge products');
    } finally {
      setIsMerging(false);
    }
  };

  const getWarnings = (product: any): string[] => {
    const warnings: string[] = [];

    if (!product.specs || Object.keys(product.specs).length === 0) {
      warnings.push('No specs');
    }

    if (!product.reviewsSummary?.pl) {
      warnings.push('No review summary');
    }

    if ((product.aiQualityScore || 0) < 50) {
      warnings.push('Low quality score');
    }

    if (product.status === 'draft') {
      warnings.push('Not enriched');
    }

    return warnings;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading products...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Products {status ? `(${status})` : ''}</h2>
        <span className="text-sm text-gray-500">{products.length} products</span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Specs</TableHead>
              <TableHead>Linked Deals</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Warnings</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const warnings = getWarnings(product);

              return (
                <TableRow key={product.id}>
                  {/* Product Image & Title */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.images?.[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.title?.pl || 'Product'}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {product.title?.pl || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500">{product.id}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Specs Count */}
                  <TableCell>
                    <Badge variant="outline">
                      {Object.keys(product.specs || {}).length} specs
                    </Badge>
                  </TableCell>

                  {/* Linked Deals */}
                  <TableCell>
                    <Badge>{product.dealCount} deals</Badge>
                  </TableCell>

                  {/* Quality Score */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{
                            width: `${Math.min(product.aiQualityScore || 0, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {Math.round(product.aiQualityScore || 0)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Warnings */}
                  <TableCell>
                    {warnings.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-amber-700">
                          {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-green-600">OK</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* View Details */}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="View product details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {/* Merge Dialog */}
                      <Dialog open={selectedProduct === product.id} onOpenChange={(open) => {
                        if (!open) {
                          setSelectedProduct(null);
                          setMergeTargetId('');
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedProduct(product.id)}
                            title="Merge with another product"
                          >
                            <Merge className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Merge Products</DialogTitle>
                            <DialogDescription>
                              Select a target product to merge with "{product.title?.pl}"
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Target Product</label>
                              <select
                                value={mergeTargetId}
                                onChange={(e) => setMergeTargetId(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                              >
                                <option value="">Select a product...</option>
                                {products
                                  .filter((p) => p.id !== product.id)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.title?.pl || 'Untitled'} ({p.id})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <Alert>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                This will merge all deals from the target product into the current product.
                                The target product will be deleted.
                              </AlertDescription>
                            </Alert>

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedProduct(null);
                                  setMergeTargetId('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleMerge}
                                disabled={!mergeTargetId || isMerging}
                                variant="destructive"
                              >
                                {isMerging ? 'Merging...' : 'Merge'}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {products.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No products found
        </div>
      )}
    </div>
  );
}
