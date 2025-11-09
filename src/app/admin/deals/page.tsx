'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
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
} from '@/components/ui/dialog';
import { getHotDeals } from '@/lib/data';
import { Deal } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DealForm } from '@/components/admin/deal-form';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useTableSort } from '@/hooks/use-table-sort';
import { usePagination } from '@/hooks/use-pagination';
import { Download } from 'lucide-react';

export default function AdminDealsPage() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [deletingDeal, setDeletingDeal] = useState<Deal | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sortowanie
  const { sortedData, requestSort, sortConfig } = useTableSort<Deal>(
    deals,
    { key: 'temperature', direction: 'desc' }
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

  async function fetchDeals() {
    setLoading(true);
    try {
      const hotDeals = await getHotDeals(50);
      setDeals(hotDeals);
    } catch (error) {
      console.error('Error fetching deals:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się pobrać okazji',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingDeal) return;

    try {
      const response = await fetch(`/api/admin/deals/${deletingDeal.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Błąd podczas usuwania');
      }

      toast({
        title: 'Usunięto',
        description: 'Okazja została usunięta',
      });

      fetchDeals();
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć okazji',
        variant: 'destructive',
      });
    } finally {
      setDeletingDeal(null);
    }
  };

  const handleSuccess = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingDeal(null);
    fetchDeals();
  };

  const handleExport = () => {
    // Otwórz link do eksportu w nowej karcie
    window.open('/api/admin/deals/export?status=approved&limit=1000', '_blank');
    toast({
      title: 'Eksport rozpoczęty',
      description: 'Plik CSV zostanie pobrany za chwilę',
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Okazje</CardTitle>
              <CardDescription>
                Zarządzaj listą okazji w swoim serwisie.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Eksportuj CSV
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Dodaj okazję
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12" />
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
                  <SortableTableHead
                    columnKey="title"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                  >
                    Tytuł
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="status"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                  >
                    Status
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="price"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                    className="hidden md:table-cell"
                  >
                    Cena
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="originalPrice"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                    className="hidden md:table-cell"
                  >
                    Oryginalna cena
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="temperature"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                    className="hidden md:table-cell"
                  >
                    Temperatura
                  </SortableTableHead>
                  <TableHead>
                    <span className="sr-only">Akcje</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Brak okazji. Dodaj pierwszą okazję klikając przycisk "Dodaj okazję".
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-medium">{deal.title}</TableCell>
                    <TableCell>
                      <Badge variant={deal.status === 'approved' ? 'secondary' : deal.status === 'draft' ? 'outline' : 'destructive'}>
                        {deal.status === 'approved' ? 'Zatwierdzona' : deal.status === 'draft' ? 'Wersja robocza' : 'Odrzucona'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {deal.price.toFixed(2)} zł
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {deal.originalPrice?.toFixed(2) || 'N/A'} zł
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {deal.temperature}°
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
                          <DropdownMenuItem onClick={() => handleEdit(deal)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edytuj
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingDeal(deal)}
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
          {!loading && totalItems > 0 && (
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
                goToPage(1); // Reset to first page when changing items per page
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog dodawania */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodaj nową okazję</DialogTitle>
          </DialogHeader>
          <DealForm 
            onSuccess={handleSuccess}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog edycji */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edytuj okazję</DialogTitle>
          </DialogHeader>
          <DealForm 
            deal={editingDeal || undefined}
            onSuccess={handleSuccess}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingDeal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog potwierdzenia usunięcia */}
      <ConfirmDialog
        open={!!deletingDeal}
        onOpenChange={(open) => !open && setDeletingDeal(null)}
        onConfirm={handleDelete}
        title="Czy na pewno chcesz usunąć tę okazję?"
        description={`Okazja "${deletingDeal?.title}" zostanie trwale usunięta. Tej operacji nie można cofnąć.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        destructive
      />
    </>
  );
}
