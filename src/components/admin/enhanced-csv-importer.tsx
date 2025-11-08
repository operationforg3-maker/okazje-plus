"use client";

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useAuth, isAdmin } from '@/lib/auth';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { useCollection } from "react-firebase-hooks/firestore";
import { collection } from "firebase/firestore";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';

import { Category } from '@/lib/types';

type ParsedRow = { [key: string]: string };

type ValidationError = {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
};

type CategorySelection = {
  mainCategorySlug: string | null;
  subCategorySlug: string | null;
};

type ImportStatus = 'idle' | 'validating' | 'previewing' | 'importing' | 'completed' | 'error';

type ImportResult = {
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
};

// Funkcja do bezpiecznego parsowania ceny
const parsePrice = (priceString: string | null | undefined): number => {
  if (!priceString) return 0;
  const cleanedString = priceString.replace(/[\s|$|€|zł|USD|PLN]/gi, '').replace(',', '.');
  const price = parseFloat(cleanedString);
  return isNaN(price) ? 0 : price;
};

// Walidacja pojedynczego wiersza
const validateRow = (row: ParsedRow, index: number, columnMapping: { [key: string]: string }): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Walidacja tytułu
  const title = row[columnMapping['title']]?.trim();
  if (!title) {
    errors.push({ row: index, field: 'title', message: 'Tytuł jest wymagany', severity: 'error' });
  } else if (title.length < 10) {
    errors.push({ row: index, field: 'title', message: 'Tytuł jest za krótki (min. 10 znaków)', severity: 'warning' });
  } else if (title.length > 200) {
    errors.push({ row: index, field: 'title', message: 'Tytuł jest za długi (max. 200 znaków)', severity: 'error' });
  }

  // Walidacja opisu
  const description = row[columnMapping['description']]?.trim();
  if (!description) {
    errors.push({ row: index, field: 'description', message: 'Opis jest zalecany', severity: 'warning' });
  } else if (description.length > 5000) {
    errors.push({ row: index, field: 'description', message: 'Opis jest za długi (max. 5000 znaków)', severity: 'error' });
  }

  // Walidacja ceny
  const price = parsePrice(row[columnMapping['price']]);
  if (price <= 0) {
    errors.push({ row: index, field: 'price', message: 'Cena musi być większa od 0', severity: 'error' });
  }

  // Walidacja linku
  const link = row[columnMapping['link']]?.trim();
  if (!link) {
    errors.push({ row: index, field: 'link', message: 'Link jest wymagany', severity: 'error' });
  } else {
    try {
      new URL(link);
    } catch {
      errors.push({ row: index, field: 'link', message: 'Nieprawidłowy format URL', severity: 'error' });
    }
  }

  // Walidacja obrazka (opcjonalne, ale jeśli jest to sprawdź URL)
  const image = row[columnMapping['image']]?.trim();
  if (image) {
    try {
      new URL(image);
    } catch {
      errors.push({ row: index, field: 'image', message: 'Nieprawidłowy format URL obrazka', severity: 'warning' });
    }
  }

  return errors;
};

export default function EnhancedCsvImporter() {
  const { user, loading: authLoading } = useAuth();
  
  // State management
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({});
  const [categorySelections, setCategorySelections] = useState<{ [rowIndex: number]: CategorySelection }>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  
  // Pobieranie kategorii z Firestore
  const [categoriesSnapshot, loadingCategories] = useCollection(collection(db, 'categories'));
  const categoriesData: Category[] = categoriesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)) || [];

  const dealFields = ['title', 'description', 'price', 'originalPrice', 'link', 'image', 'imageHint'];

  // Upload pliku CSV
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportStatus('validating');
    
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setHeaders(results.meta.fields || []);
        setParsedData(results.data);
        setImportStatus('idle');
        
        // Auto-mapowanie kolumn jeśli nazwy się zgadzają
        const autoMapping: { [key: string]: string } = {};
        dealFields.forEach(field => {
          const matchingHeader = results.meta.fields?.find(h => 
            h.toLowerCase() === field.toLowerCase() || 
            h.toLowerCase().includes(field.toLowerCase())
          );
          if (matchingHeader) {
            autoMapping[field] = matchingHeader;
          }
        });
        setColumnMapping(autoMapping);
        
        // Zaznacz wszystkie wiersze domyślnie
        setSelectedRows(new Set(results.data.map((_, i) => i)));
        
        toast.success(`Załadowano ${results.data.length} wierszy z pliku ${file.name}`);
      },
      error: (error) => {
        toast.error(`Błąd parsowania CSV: ${error.message}`);
        setImportStatus('error');
      }
    });
  };

  // Walidacja wszystkich danych
  const validateAllData = useCallback(() => {
    setImportStatus('validating');
    const allErrors: ValidationError[] = [];

    parsedData.forEach((row, index) => {
      if (!selectedRows.has(index)) return;
      
      const rowErrors = validateRow(row, index, columnMapping);
      allErrors.push(...rowErrors);

      // Sprawdź czy wybrano kategorie
      const selection = categorySelections[index];
      if (!selection?.mainCategorySlug) {
        allErrors.push({ row: index, field: 'category', message: 'Nie wybrano kategorii głównej', severity: 'error' });
      }
      if (!selection?.subCategorySlug) {
        allErrors.push({ row: index, field: 'category', message: 'Nie wybrano podkategorii', severity: 'error' });
      }
    });

    setValidationErrors(allErrors);
    setImportStatus('previewing');
    
    const errorCount = allErrors.filter(e => e.severity === 'error').length;
    const warningCount = allErrors.filter(e => e.severity === 'warning').length;
    
    if (errorCount > 0) {
      toast.error(`Znaleziono ${errorCount} błędów i ${warningCount} ostrzeżeń`);
    } else if (warningCount > 0) {
      toast.warning(`Znaleziono ${warningCount} ostrzeżeń`);
    } else {
      toast.success('Walidacja zakończona pomyślnie!');
    }
  }, [parsedData, columnMapping, categorySelections, selectedRows]);

  // Mapowanie kolumn
  const handleColumnMappingChange = (csvHeader: string, dealField: string) => {
    setColumnMapping(prev => ({ ...prev, [dealField]: csvHeader }));
  };

  // Zmiana kategorii
  const handleCategoryChange = (rowIndex: number, type: 'main' | 'sub', value: string) => {
    setCategorySelections(prev => {
      const currentSelection = prev[rowIndex] || { mainCategorySlug: null, subCategorySlug: null };
      if (type === 'main') {
        return {
          ...prev,
          [rowIndex]: { mainCategorySlug: value, subCategorySlug: null }
        };
      }
      return {
        ...prev,
        [rowIndex]: { ...currentSelection, subCategorySlug: value }
      };
    });
  };

  // Bulk operations - zastosuj kategorie do wszystkich
  const applyCategoriesToAll = (mainCategorySlug: string, subCategorySlug: string) => {
    const newSelections: { [rowIndex: number]: CategorySelection } = {};
    selectedRows.forEach(index => {
      newSelections[index] = { mainCategorySlug, subCategorySlug };
    });
    setCategorySelections(prev => ({ ...prev, ...newSelections }));
    toast.success(`Zastosowano kategorię do ${selectedRows.size} wierszy`);
  };

  // Toggle row selection
  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  // Select/Deselect all
  const toggleAllRows = () => {
    if (selectedRows.size === parsedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(parsedData.map((_, i) => i)));
    }
  };

  // Import danych
  const handleImport = async () => {
    setImportStatus('importing');
    setImportProgress(0);
    
    const createDeal = httpsCallable(functions, 'createDeal');
    const results: ImportResult = { success: 0, failed: 0, errors: [] };

    const dealsToImport = Array.from(selectedRows)
      .map(index => {
        const row = parsedData[index];
        const selection = categorySelections[index];
        
        if (!selection?.mainCategorySlug || !selection?.subCategorySlug) {
          results.errors.push({ row: index, error: 'Brak wybranej kategorii' });
          return null;
        }

        return {
          title: row[columnMapping['title']]?.trim() || '',
          description: row[columnMapping['description']]?.trim() || '',
          price: parsePrice(row[columnMapping['price']]),
          originalPrice: parsePrice(row[columnMapping['originalPrice']]),
          link: row[columnMapping['link']]?.trim() || '',
          image: row[columnMapping['image']]?.trim() || '',
          imageHint: row[columnMapping['imageHint']]?.trim() || '',
          mainCategorySlug: selection.mainCategorySlug,
          subCategorySlug: selection.subCategorySlug,
        };
      })
      .filter(deal => deal !== null);

    // Import w partiach (batches) po 10
    const batchSize = 10;
    const totalBatches = Math.ceil(dealsToImport.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const batch = dealsToImport.slice(i * batchSize, (i + 1) * batchSize);
      
      try {
        await createDeal({ deals: batch });
        results.success += batch.length;
        setImportProgress(Math.round(((i + 1) / totalBatches) * 100));
      } catch (error: any) {
        console.error('Błąd importu batcha:', error);
        batch.forEach((_, batchIndex) => {
          const originalIndex = i * batchSize + batchIndex;
          results.errors.push({ row: originalIndex, error: error.message || 'Nieznany błąd' });
          results.failed++;
        });
      }
    }

    setImportResult(results);
    setImportStatus('completed');
    
    if (results.failed === 0) {
      toast.success(`Pomyślnie zaimportowano ${results.success} okazji!`);
    } else {
      toast.error(`Zaimportowano ${results.success} okazji, ${results.failed} niepowodzeń`);
    }
  };

  // Reset
  const handleReset = () => {
    setParsedData([]);
    setHeaders([]);
    setColumnMapping({});
    setCategorySelections({});
    setValidationErrors([]);
    setImportStatus('idle');
    setImportProgress(0);
    setImportResult(null);
    setFileName('');
    setSelectedRows(new Set());
  };

  // Download template
  const downloadTemplate = () => {
    const template = [
      ['title', 'description', 'price', 'originalPrice', 'link', 'image', 'imageHint'],
      ['iPhone 15 Pro - super okazja!', 'Najnowszy iPhone w świetnej cenie', '4999', '5999', 'https://example.com/iphone', 'https://example.com/image.jpg', 'Czarny iPhone 15 Pro']
    ];
    
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'okazje-template.csv';
    link.click();
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user || !isAdmin(user)) {
    return <div className="text-center py-10">Brak uprawnień. Ta strona jest dostępna tylko dla administratorów.</div>;
  }

  const errorCount = validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = validationErrors.filter(e => e.severity === 'warning').length;
  const hasBlockingErrors = errorCount > 0;

  return (
    <div className="space-y-6">
      {/* Header & Template */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Zaawansowany Import CSV
              </CardTitle>
              <CardDescription>
                Import okazji z walidacją, preview i progress tracking
              </CardDescription>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Pobierz szablon
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 cursor-pointer">
              {fileName ? (
                <div className="space-y-2">
                  <p className="text-primary font-semibold">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{parsedData.length} wierszy załadowanych</p>
                </div>
              ) : (
                <div>
                  <p>Wybierz plik CSV lub przeciągnij go tutaj</p>
                  <p className="text-xs text-muted-foreground mt-1">Format: UTF-8, rozdzielacz: przecinek</p>
                </div>
              )}
            </label>
            <Input 
              id="file-upload" 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="sr-only" 
            />
            {fileName && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="mt-3">
                <Trash2 className="h-4 w-4 mr-2" />
                Usuń i załaduj nowy
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Tabs */}
      {parsedData.length > 0 && (
        <Tabs defaultValue="mapping" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="mapping">1. Mapowanie</TabsTrigger>
            <TabsTrigger value="preview">2. Podgląd</TabsTrigger>
            <TabsTrigger value="validation">3. Walidacja</TabsTrigger>
            <TabsTrigger value="import" disabled={hasBlockingErrors && importStatus !== 'completed'}>
              4. Import
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Column Mapping */}
          <TabsContent value="mapping" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mapowanie kolumn</CardTitle>
                <CardDescription>
                  Dopasuj pola okazji do kolumn z pliku CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pole okazji</TableHead>
                      <TableHead>Kolumna CSV</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealFields.map(field => (
                      <TableRow key={field}>
                        <TableCell className="font-semibold">{field}</TableCell>
                        <TableCell>
                          <Select 
                            onValueChange={(value) => handleColumnMappingChange(value, field)}
                            value={columnMapping[field]}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz kolumnę..." />
                            </SelectTrigger>
                            <SelectContent>
                              {headers.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {columnMapping[field] ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Zmapowane
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Brak</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end">
                  <Button onClick={validateAllData} disabled={Object.keys(columnMapping).length < 3}>
                    <Eye className="h-4 w-4 mr-2" />
                    Przejdź do podglądu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Data Preview with Categories */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Podgląd i kategoryzacja</CardTitle>
                    <CardDescription>
                      {selectedRows.size} z {parsedData.length} wierszy wybranych
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={toggleAllRows}>
                      {selectedRows.size === parsedData.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Bulk Category Assignment */}
                <Alert className="mb-4">
                  <AlertTitle>Szybkie przypisanie kategorii</AlertTitle>
                  <AlertDescription>
                    <div className="flex gap-2 mt-2">
                      <Select onValueChange={(value) => {
                        const sub = categoriesData.find(c => c.id === value)?.subcategories[0]?.slug;
                        if (sub) applyCategoriesToAll(value, sub);
                      }}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Kategoria główna" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriesData.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground self-center">
                        do zaznaczonych wierszy
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <input 
                            type="checkbox" 
                            checked={selectedRows.size === parsedData.length}
                            onChange={toggleAllRows}
                          />
                        </TableHead>
                        <TableHead>#</TableHead>
                        {headers.slice(0, 3).map(header => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                        <TableHead>Kategoria</TableHead>
                        <TableHead>Podkategoria</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((row, rowIndex) => {
                        const selection = categorySelections[rowIndex] || { mainCategorySlug: null, subCategorySlug: null };
                        const availableSubcategories = categoriesData.find(c => c.id === selection.mainCategorySlug)?.subcategories || [];
                        const isSelected = selectedRows.has(rowIndex);

                        return (
                          <TableRow key={rowIndex} className={!isSelected ? 'opacity-50' : ''}>
                            <TableCell>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => toggleRowSelection(rowIndex)}
                              />
                            </TableCell>
                            <TableCell>{rowIndex + 1}</TableCell>
                            {headers.slice(0, 3).map(header => (
                              <TableCell key={header} className="max-w-[200px] truncate">
                                {row[header]}
                              </TableCell>
                            ))}
                            <TableCell>
                              <Select 
                                onValueChange={(value) => handleCategoryChange(rowIndex, 'main', value)} 
                                value={selection.mainCategorySlug || undefined}
                                disabled={!isSelected}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue placeholder="Wybierz..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {categoriesData.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select 
                                onValueChange={(value) => handleCategoryChange(rowIndex, 'sub', value)} 
                                value={selection.subCategorySlug || undefined}
                                disabled={!isSelected || !selection.mainCategorySlug || availableSubcategories.length === 0}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue placeholder="Wybierz..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSubcategories.map(sub => (
                                    <SelectItem key={sub.slug} value={sub.slug}>{sub.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={validateAllData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Waliduj dane
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Validation Results */}
          <TabsContent value="validation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Wyniki walidacji</CardTitle>
                <CardDescription>
                  Sprawdź błędy i ostrzeżenia przed importem
                </CardDescription>
              </CardHeader>
              <CardContent>
                {validationErrors.length === 0 ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Brak błędów!</AlertTitle>
                    <AlertDescription>
                      Wszystkie dane są poprawne. Możesz przejść do importu.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Badge variant="destructive" className="text-sm">
                        <XCircle className="h-3 w-3 mr-1" />
                        {errorCount} błędów
                      </Badge>
                      <Badge variant="secondary" className="text-sm">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {warningCount} ostrzeżeń
                      </Badge>
                    </div>

                    <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Wiersz</TableHead>
                            <TableHead>Pole</TableHead>
                            <TableHead>Problem</TableHead>
                            <TableHead>Poziom</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationErrors.map((error, index) => (
                            <TableRow key={index}>
                              <TableCell>{error.row + 1}</TableCell>
                              <TableCell className="font-mono text-sm">{error.field}</TableCell>
                              <TableCell>{error.message}</TableCell>
                              <TableCell>
                                {error.severity === 'error' ? (
                                  <Badge variant="destructive">Błąd</Badge>
                                ) : (
                                  <Badge variant="secondary">Ostrzeżenie</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-between">
                  <Button variant="outline" onClick={validateAllData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Ponów walidację
                  </Button>
                  <Button disabled={hasBlockingErrors}>
                    Przejdź do importu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Import Progress */}
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import danych</CardTitle>
                <CardDescription>
                  {importStatus === 'completed' 
                    ? 'Import zakończony' 
                    : 'Gotowy do rozpoczęcia importu'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {importStatus === 'importing' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Postęp importu</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Trwa import... Proszę czekać
                    </p>
                  </div>
                )}

                {importStatus === 'completed' && importResult && (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Import zakończony!</AlertTitle>
                      <AlertDescription>
                        Pomyślnie zaimportowano <strong>{importResult.success}</strong> okazji
                        {importResult.failed > 0 && `, ${importResult.failed} niepowodzeń`}
                      </AlertDescription>
                    </Alert>

                    {importResult.errors.length > 0 && (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Błędy importu:</h4>
                        <ul className="space-y-1 text-sm">
                          {importResult.errors.map((err, i) => (
                            <li key={i} className="text-destructive">
                              Wiersz {err.row + 1}: {err.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button onClick={handleReset} className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Rozpocznij nowy import
                    </Button>
                  </div>
                )}

                {importStatus !== 'importing' && importStatus !== 'completed' && (
                  <div className="space-y-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Gotowy do importu</AlertTitle>
                      <AlertDescription>
                        Zostanie zaimportowanych <strong>{selectedRows.size}</strong> okazji.
                        Operacja może potrwać kilka minut.
                      </AlertDescription>
                    </Alert>

                    <Button 
                      onClick={handleImport} 
                      className="w-full" 
                      size="lg"
                      disabled={hasBlockingErrors}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Rozpocznij import ({selectedRows.size} okazji)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
