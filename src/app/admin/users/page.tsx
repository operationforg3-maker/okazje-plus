'use client';

export const dynamic = 'force-dynamic';

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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Shield, ShieldOff, Ban, CheckCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useTableSort } from '@/hooks/use-table-sort';
import { usePagination } from '@/hooks/use-pagination';

interface UserWithMetadata extends User {
  createdAt?: any;
  disabled?: boolean;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithMetadata[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithMetadata | null>(null);
  const [actionDialog, setActionDialog] = useState<'role' | 'block' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sortowanie
  const { sortedData, requestSort, sortConfig } = useTableSort<UserWithMetadata>(
    users,
    { key: 'displayName', direction: 'asc' }
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania użytkowników:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się pobrać listy użytkowników',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const newRole = selectedUser.role === 'admin' ? 'user' : 'admin';
      
      const response = await fetch(`/api/admin/users/${selectedUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Sukces',
          description: `Rola użytkownika została zmieniona na ${newRole}`,
        });
        await fetchUsers();
        setActionDialog(null);
        setSelectedUser(null);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Błąd zmiany roli:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zmienić roli użytkownika',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const newDisabledState = !selectedUser.disabled;
      
      const response = await fetch(`/api/admin/users/${selectedUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: newDisabledState }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Sukces',
          description: `Użytkownik został ${newDisabledState ? 'zablokowany' : 'odblokowany'}`,
        });
        await fetchUsers();
        setActionDialog(null);
        setSelectedUser(null);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Błąd blokowania użytkownika:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zmienić statusu użytkownika',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Użytkownicy</CardTitle>
              <CardDescription>
                Zarządzaj użytkownikami serwisu.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
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
                    columnKey="displayName"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                  >
                    Nazwa
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="role"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                  >
                    Rola
                  </SortableTableHead>
                  <SortableTableHead
                    columnKey="disabled"
                    sortConfig={sortConfig}
                    onSort={requestSort}
                    className="hidden md:table-cell"
                  >
                    Status
                  </SortableTableHead>
                  <TableHead>
                    <span className="sr-only">Akcje</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      Brak użytkowników w systemie
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User'} />
                            <AvatarFallback>
                              {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="grid">
                            <div className="font-medium">{user.displayName || 'Użytkownik'}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={user.disabled ? 'destructive' : 'outline'}>
                          {user.disabled ? 'Zablokowany' : 'Aktywny'}
                        </Badge>
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
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setActionDialog('role');
                              }}
                            >
                              {user.role === 'admin' ? (
                                <>
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  Zmień na użytkownika
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Zmień na admina
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setActionDialog('block');
                              }}
                              className={user.disabled ? undefined : "text-destructive focus:text-destructive"}
                            >
                              {user.disabled ? (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Odblokuj
                                </>
                              ) : (
                                <>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Zablokuj
                                </>
                              )}
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
                goToPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog zmiany roli */}
      <Dialog open={actionDialog === 'role'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmień rolę użytkownika</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz zmienić rolę użytkownika <strong>{selectedUser?.displayName || selectedUser?.email}</strong> 
              {' '}z <strong>{selectedUser?.role}</strong> na{' '}
              <strong>{selectedUser?.role === 'admin' ? 'user' : 'admin'}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog(null);
                setSelectedUser(null);
              }}
              disabled={processing}
            >
              Anuluj
            </Button>
            <Button onClick={handleRoleChange} disabled={processing}>
              {processing ? 'Zmieniam...' : 'Zmień rolę'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog blokowania/odblokowywania */}
      <Dialog open={actionDialog === 'block'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.disabled ? 'Odblokuj użytkownika' : 'Zablokuj użytkownika'}
            </DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz {selectedUser?.disabled ? 'odblokować' : 'zablokować'} użytkownika{' '}
              <strong>{selectedUser?.displayName || selectedUser?.email}</strong>?
              {!selectedUser?.disabled && ' Użytkownik nie będzie mógł się zalogować.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog(null);
                setSelectedUser(null);
              }}
              disabled={processing}
            >
              Anuluj
            </Button>
            <Button
              variant={selectedUser?.disabled ? 'default' : 'destructive'}
              onClick={handleBlockUser}
              disabled={processing}
            >
              {processing ? 'Przetwarzam...' : (selectedUser?.disabled ? 'Odblokuj' : 'Zablokuj')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
