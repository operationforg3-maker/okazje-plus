/**
 * Database Cleaner - Masowe usuwanie i czyszczenie bazy danych
 *
 * Funkcjonalność:
 * - Usuwa produkty, okazje, kategorie, użytkowników, osierocone wpisy
 * - Filtrowanie po kategorii, statusie, dacie, cenie
 * - Preview przed wykonaniem (policz + pokaż sample)
 * - Potwierdzenie kodem dla bezpieczeństwa
 * - Anonimizacja użytkowników dla GDPR
 * - Kaskaadowe usuwanie dla kategorii
 *
 * API:
 * - POST /api/admin/delete/preview - Przygotuj podgląd
 * - POST /api/admin/delete/execute - Wykonaj usuwanie
 *
 * Bezpieczeństwo:
 * - Wymaga potwierdzenia kodem "USUŃ_WSZYSTKO"
 * - Wyświetla ostrzeżenia (kaskaada, GDPR)
 * - Backup reminder
 * - Sample preview (pierwsze 10 elementów)
 *
 * Todo:
 * - Firestore batch transaction delete
 * - Cascade delete handler
 * - User anonymization flow
 * - Orphaned document detection
 * - Rollback support (backup)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

interface DeletionPreview {
  type: 'products' | 'deals' | 'categories' | 'users' | 'orphaned';
  count: number;
  items: Array<{
    id: string;
    name: string;
    status?: string;
    createdAt?: string;
    metadata?: Record<string, any>;
  }>;
  estimatedSize: string;
  warnings?: string[];
}

interface DatabaseCleanerProps {
  onConsoleLog?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

type DeleteType = 'products' | 'deals' | 'categories' | 'users' | 'orphaned';

const DELETE_TYPE_LABELS: Record<DeleteType, string> = {
  products: '📦 Produkty',
  deals: '🎉 Okazje',
  categories: '📂 Kategorie',
  users: '👥 Użytkownicy',
  orphaned: '👻 Osierocone wpisy',
};

const DELETE_TYPE_DESCRIPTIONS: Record<DeleteType, string> = {
  products:
    'Usuń produkty z wyfiltrowanego zakresu (kategoria, status, data)',
  deals: 'Usuń okazje z wyfiltrowanego zakresu',
  categories: 'Usuń kategorie i wszystkie powiązane produkty/okazje',
  users: 'Usuń konta użytkowników (z opcją anonimizacji)',
  orphaned: 'Znajdź i usuń osierocone dokumenty (bez odniesień)',
};

export function DatabaseCleaner({ onConsoleLog }: DatabaseCleanerProps) {
  const [deleteType, setDeleteType] = useState<DeleteType>('products');
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showItems, setShowItems] = useState(false);

  // Filtry dla produktów i okazji
  const [filters, setFilters] = useState({
    id: '',
    category: '',
    status: 'inactive',
    maxAgeDays: '30',
    minPrice: '',
    maxPrice: '',
  });

  // Filtry dla kategorii
  const [categoryFilters, setCategoryFilters] = useState({
    level: 'all', // 'all', '1', '2', '3'
    hasNoProducts: false,
  });

  // Filtry dla użytkowników
  const [userFilters, setUserFilters] = useState({
    inactiveDays: '365',
    anonymize: false,
    keepPosts: false,
  });

  const previewDeletion = async () => {
    try {
      setLoading(true);
      onConsoleLog?.('🔍 Przygotowuję podgląd...', 'info');

      const response = await fetch('/api/admin/delete/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: deleteType,
          filters:
            deleteType === 'products' || deleteType === 'deals'
              ? filters
              : deleteType === 'categories'
                ? categoryFilters
                : userFilters,
        }),
      });

      if (!response.ok) throw new Error('Błąd przygotowania podglądu');

      const result = await response.json();
      setPreview(result);

      onConsoleLog?.(
        `ℹ️ Do usunięcia: ${result.count} ${deleteType}`,
        'warning'
      );
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const executeDeletion = async () => {
    if (!preview) return;
    if (confirmationCode !== 'USUŃ_WSZYSTKO') {
      toast.error('Nieprawidłowy kod potwierdzenia');
      return;
    }

    try {
      setDeleting(true);
      onConsoleLog?.(`🗑️ Usuwam ${preview.count} ${deleteType}...`, 'warning');

      const response = await fetch('/api/admin/delete/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: deleteType,
          deleteAll: true,
          filters:
            deleteType === 'products' || deleteType === 'deals'
              ? filters
              : deleteType === 'categories'
                ? categoryFilters
                : userFilters,
          options:
            deleteType === 'users'
              ? {
                  anonymize: userFilters.anonymize,
                  keepPosts: userFilters.keepPosts,
                }
              : deleteType === 'categories'
                ? {
                    cascade: true,
                  }
                : {},
        }),
      });

      if (!response.ok) throw new Error('Błąd usuwania');

      const result = await response.json();
      setPreview(null);
      setConfirmationCode('');
      setShowConfirmation(false);

      onConsoleLog?.(
        `✅ Usunięto: ${result.deleted} elementów`,
        'success'
      );
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const renderFilters = () => {
    switch (deleteType) {
      case 'products':
      case 'deals':
        return (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold text-sm">Filtry</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ID Elementu (opcjonalne)</Label>
                 <Input
                  placeholder="Wpisz ID produktu/okazji"
                  value={filters.id || ''}
                  onChange={e =>
                    setFilters({ ...filters, id: e.target.value })
                  }
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Kategoria</Label>
                <Input
                  placeholder="Opcjonalnie - wpisz ID kategorii"
                  value={filters.category}
                  onChange={e =>
                    setFilters({ ...filters, category: e.target.value })
                  }
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={status =>
                    setFilters({ ...filters, status })
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie</SelectItem>
                    <SelectItem value="approved">Zatwierdzone</SelectItem>
                    <SelectItem value="pending">Oczekujące</SelectItem>
                    <SelectItem value="inactive">Nieaktywne</SelectItem>
                    <SelectItem value="rejected">Odrzucone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Starsze niż (dni)</Label>
                <Input
                  type="number"
                  value={filters.maxAgeDays}
                  onChange={e =>
                    setFilters({ ...filters, maxAgeDays: e.target.value })
                  }
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Przedział ceny (PLN)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Od"
                    value={filters.minPrice}
                    onChange={e =>
                      setFilters({ ...filters, minPrice: e.target.value })
                    }
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Do"
                    value={filters.maxPrice}
                    onChange={e =>
                      setFilters({ ...filters, maxPrice: e.target.value })
                    }
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'categories':
        return (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold text-sm">Filtry</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Poziom kategorii</Label>
                <Select
                  value={categoryFilters.level}
                  onValueChange={level =>
                    setCategoryFilters({ ...categoryFilters, level })
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie poziomy</SelectItem>
                    <SelectItem value="1">Tylko główne (1)</SelectItem>
                    <SelectItem value="2">Tylko pod-kategorie (2)</SelectItem>
                    <SelectItem value="3">Tylko sub-sub-kategorie (3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Checkbox
                  id="has-no-products"
                  checked={categoryFilters.hasNoProducts}
                  onCheckedChange={checked =>
                    setCategoryFilters({
                      ...categoryFilters,
                      hasNoProducts: !!checked,
                    })
                  }
                />
                <Label htmlFor="has-no-products" className="text-xs">
                  Tylko puste kategorie
                </Label>
              </div>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold text-sm">Filtry i opcje</h4>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Nieaktywni przez (dni)</Label>
                <Input
                  type="number"
                  value={userFilters.inactiveDays}
                  onChange={e =>
                    setUserFilters({
                      ...userFilters,
                      inactiveDays: e.target.value,
                    })
                  }
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="anonymize"
                  checked={userFilters.anonymize}
                  onCheckedChange={checked =>
                    setUserFilters({
                      ...userFilters,
                      anonymize: !!checked,
                    })
                  }
                />
                <Label htmlFor="anonymize" className="text-xs">
                  Anonimizuj dane zamiast usuwać (GDPR)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="keep-posts"
                  checked={userFilters.keepPosts}
                  onCheckedChange={checked =>
                    setUserFilters({
                      ...userFilters,
                      keepPosts: !!checked,
                    })
                  }
                />
                <Label htmlFor="keep-posts" className="text-xs">
                  Zachowaj wpisy użytkownika (anonimowe)
                </Label>
              </div>
            </div>
          </div>
        );

      case 'orphaned':
        return (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              System automatycznie wyszuka wszystkie dokumenty bez powiązań.
              To może potrwać kilka minut.
            </AlertDescription>
          </Alert>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Usuwanie wpisów z bazy</h3>
        <p className="text-sm text-muted-foreground">
          Czyszczenie bazy danych - usuń nieaktualne i osierocone wpisy
        </p>
      </div>

      {/* WYBÓR TYPU */}
      <Tabs
        value={deleteType}
        onValueChange={type => {
          setDeleteType(type as DeleteType);
          setPreview(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-5">
          {Object.entries(DELETE_TYPE_LABELS).map(([type, label]) => (
            <TabsTrigger
              key={type}
              value={type}
              className="text-xs"
            >
              {label.split(' ')[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(DELETE_TYPE_LABELS).map(([type, label]) => (
          <TabsContent key={type} value={type} className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {DELETE_TYPE_DESCRIPTIONS[type as DeleteType]}
              </AlertDescription>
            </Alert>

            {/* FILTRY */}
            {renderFilters()}

            {/* AKCJE */}
            <div className="flex gap-2">
              <Button
                onClick={previewDeletion}
                disabled={loading || !!preview}
                className="flex-1 gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Podgląd
              </Button>
              <Button
                onClick={() => {
                  setPreview(null);
                  setConfirmationCode('');
                  setShowConfirmation(false);
                }}
                variant="outline"
                disabled={!preview}
              >
                Anuluj
              </Button>
            </div>

            {/* PODGLĄD */}
            {preview && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6 space-y-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      ⚠️ To usunięcie jest <strong>nieodwracalne</strong>! Upewnij
                      się, że rozumiesz konsekwencje.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Podsumowanie</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-2xl font-bold text-red-700">
                          {preview.count}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Do usunięcia
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">
                          {preview.estimatedSize}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Szacunkowy rozmiar
                        </div>
                      </div>
                      <div>
                        <Badge variant="destructive" className="text-xs">
                          Operacja masowa
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {preview.warnings && preview.warnings.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {preview.warnings.map((w, i) => (
                          <div key={i}>⚠️ {w}</div>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* LISTA ELEMENTÓW */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowItems(!showItems)}
                      className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                    >
                      {showItems ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                      {showItems
                        ? 'Ukryj listę'
                        : 'Pokaż listę elementów'}
                    </button>

                    {showItems && (
                      <ScrollArea className="h-[200px] border rounded p-2">
                        <div className="space-y-1 text-xs">
                          {preview.items.map(item => (
                            <div
                              key={item.id}
                              className="flex justify-between p-1 hover:bg-muted rounded"
                            >
                              <span className="truncate font-mono">
                                {item.name}
                              </span>
                              {item.status && (
                                <Badge
                                  variant="outline"
                                  className="text-xs flex-shrink-0"
                                >
                                  {item.status}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  {/* POTWIERDZENIE */}
                  {!showConfirmation ? (
                    <Button
                      variant="destructive"
                      onClick={() => setShowConfirmation(true)}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Potwierdzam usunięcie
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 bg-black/5 rounded">
                      <Label className="text-xs font-semibold">
                        Wpisz kod potwierdzenia: <code>USUŃ_WSZYSTKO</code>
                      </Label>
                      <Input
                        placeholder="Kod potwierdzenia..."
                        value={confirmationCode}
                        onChange={e => setConfirmationCode(e.target.value)}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={executeDeletion}
                          disabled={deleting}
                          className="flex-1"
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          USUŃ TERAZ
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowConfirmation(false);
                            setConfirmationCode('');
                          }}
                          disabled={deleting}
                        >
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Alert variant="default">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          💾 Wskazówka: Upewnij się, że masz aktualne backupy Firestore zanim
          wykonasz masowe usuwanie. Możesz je wyeksportować w Firebase Console.
        </AlertDescription>
      </Alert>
    </div>
  );
}
