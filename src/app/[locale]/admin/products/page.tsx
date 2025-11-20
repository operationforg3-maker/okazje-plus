'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getRecommendedProducts, getProductsForAdmin } from '@/lib/data';
import { Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Download, AlertTriangle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ProductForm } from '@/components/admin/product-form';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useTableSort } from '@/hooks/use-table-sort';
import { usePagination } from '@/hooks/use-pagination';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { auth } from '@/lib/firebase';

export default function AdminProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sortowanie
  const { sortedData, requestSort, sortConfig } = useTableSort<Product>(
    products,
    { key: 'name', direction: 'asc' }
  );

  // Paginacja
  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    canGoNext,
    canGoPrev,
    goToPage,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
  } = usePagination(sortedData, itemsPerPage);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const allProducts = await getProductsForAdmin(statusFilter === 'all' ? undefined : statusFilter, 200);
      setProducts(allProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się pobrać produktów',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;

    try {
      const response = await fetch(`/api/admin/products/${deletingProduct.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Błąd podczas usuwania');
      }

      toast({
        title: 'Usunięto',
        description: 'Produkt został usunięty',
      });

      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć produktu',
        variant: 'destructive',
      });
    } finally {
      setDeletingProduct(null);
    }
  };

  const handleCreateDealFromProduct = async (product: Product) => {
    try {
      const res = await fetch('/api/admin/deals/from-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Błąd tworzenia okazji');
      }
      toast({ title: 'Utworzono okazję', description: `ID: ${data.id}` });
      // Opcjonalnie: otwórz listę okazji
      // window.open('/admin/deals', '_blank');
    } catch (error) {
      console.error('Create deal from product failed:', error);
      toast({ title: 'Błąd', description: 'Nie udało się utworzyć okazji', variant: 'destructive' });
    }
  };

  const handleSuccess = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const handleExport = () => {
    window.open('/api/admin/products/export?status=approved&limit=1000', '_blank');
    toast({
      title: 'Eksport rozpoczęty',
      description: 'Plik CSV zostanie pobrany za chwilę',
    });
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteConfirmation !== 'DELETE_ALL_PRODUCTS') {
      toast({
        title: 'Błąd',
        description: 'Nieprawidłowe potwierdzenie',
        variant: 'destructive',
      });
      return;
    }

    setBulkDeleting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Brak tokenu uwierzytelniającego');
      }

      const response = await fetch('/api/admin/products/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ confirmation: 'DELETE_ALL_PRODUCTS' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Błąd podczas usuwania');
      }

      toast({
        title: 'Usunięto wszystkie produkty',
        description: `Usunięto ${data.deleted} produktów`,
      });

      setIsBulkDeleteDialogOpen(false);
      setBulkDeleteConfirmation('');
      fetchProducts();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast({
        title: 'Błąd',
        description: error instanceof Error ? error.message : 'Nie udało się usunąć produktów',
        variant: 'destructive',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Produkty</CardTitle>
              <CardDescription>
                Zarządzaj listą produktów w swoim serwisie.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Eksportuj CSV
              </Button>
              <Button variant="destructive" onClick={() => setIsBulkDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Usuń wszystkie
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Dodaj produkt
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <Label htmlFor="status-filter" className="whitespace-nowrap">Filtruj status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" className="w-[200px]">
                <SelectValue placeholder="Wszystkie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Znaleziono: {products.length}
            </span>
          </div>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-16 w-16" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-[100px] sm:table-cell">
                    <span className="sr-only">Zdjęcie</span>
                  </TableHead>
                  <SortableTableHead
                    columnKey="name"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                  >
                    Nazwa
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="category"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                  >
                    Kategoria
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="price"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                    className="hidden md:table-cell"
                  >
                    Cena
                  </SortableTableHead>
                  <TableHead className="hidden md:table-cell">Oceny</TableHead>
                  <TableHead>
                    <span className="sr-only">Akcje</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Brak produktów. Dodaj pierwszy produkt klikając przycisk "Dodaj produkt".
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="hidden sm:table-cell">
                      <Image
                        alt={product.name}
                        className="aspect-square rounded-md object-cover"
                        height="64"
                        src={product.image}
                        width="64"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {product.price.toFixed(2)} zł
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {product.ratingCard.count}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Akcje</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edytuj
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCreateDealFromProduct(product)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Utwórz okazję
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingProduct(product)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {!loading && totalItems > 0 && (
          <div className="px-6">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPageChange={goToPage}
              onFirstPage={goToFirstPage}
              onLastPage={goToLastPage}
              onPrevPage={prevPage}
              onNextPage={nextPage}
              onItemsPerPageChange={(value) => {
                setItemsPerPage(value);
                goToPage(1);
              }}
            />
          </div>
        )}
      </Card>

      {/* Dialog dodawania */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodaj nowy produkt</DialogTitle>
          </DialogHeader>
          <ProductForm 
            onSuccess={handleSuccess}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog edycji */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edytuj produkt</DialogTitle>
          </DialogHeader>
          <ProductForm 
            product={editingProduct || undefined}
            onSuccess={handleSuccess}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingProduct(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog potwierdzenia usunięcia */}
      <ConfirmDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        onConfirm={handleDelete}
        title="Czy na pewno chcesz usunąć ten produkt?"
        description={`Produkt "${deletingProduct?.name}" zostanie trwale usunięty. Tej operacji nie można cofnąć.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        destructive
      />

      {/* Dialog masowego usuwania */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Usuń wszystkie produkty
            </DialogTitle>
            <DialogDescription>
              Ta operacja usunie wszystkie produkty z bazy danych. Tej operacji nie można cofnąć!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Wpisz <code className="bg-muted px-2 py-1 rounded text-sm">DELETE_ALL_PRODUCTS</code> aby potwierdzić:
              </Label>
              <Input
                id="confirmation"
                value={bulkDeleteConfirmation}
                onChange={(e) => setBulkDeleteConfirmation(e.target.value)}
                placeholder="DELETE_ALL_PRODUCTS"
                disabled={bulkDeleting}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Wszystkie produkty ({products.length}) zostaną trwale usunięte.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkDeleteDialogOpen(false);
                setBulkDeleteConfirmation('');
              }}
              disabled={bulkDeleting}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteConfirmation !== 'DELETE_ALL_PRODUCTS' || bulkDeleting}
            >
              {bulkDeleting ? 'Usuwanie...' : 'Usuń wszystkie produkty'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
