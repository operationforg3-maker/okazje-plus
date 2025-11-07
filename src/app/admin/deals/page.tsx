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
import { getHotDeals } from '@/lib/data';
import { Deal } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';

export default function AdminDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    async function fetchDeals() {
      const hotDeals = await getHotDeals(50); // Pobierz 50 najnowszych okazji do panelu admina
      setDeals(hotDeals);
    }

    fetchDeals();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Okazje</CardTitle>
            <CardDescription>
              Zarządzaj listą okazji w swoim serwisie.
            </CardDescription>
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Dodaj okazję
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tytuł</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Cena</TableHead>
              <TableHead className="hidden md:table-cell">Oryginalna cena</TableHead>
              <TableHead className="hidden md:table-cell">Temperatura</TableHead>
              <TableHead>
                <span className="sr-only">Akcje</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => (
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
                      <DropdownMenuItem>Edytuj</DropdownMenuItem>
                      <DropdownMenuItem>Usuń</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
