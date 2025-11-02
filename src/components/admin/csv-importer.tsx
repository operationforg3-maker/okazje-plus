"use client";

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/context/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';

import { useCollection } from "react-firebase-hooks/firestore";
import { collection } from "firebase/firestore";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, FileText, CheckCircle, XCircle } from 'lucide-react';

import { Category } from '@/lib/types';

type ParsedRow = { [key: string]: string };

// Typ dla mapowania wyboru kategorii dla każdego wiersza
type CategorySelection = {
  mainCategorySlug: string | null;
  subCategorySlug: string | null;
};

// Funkcja do bezpiecznego parsowania ceny
const parsePrice = (priceString: string | null | undefined): number => {
  if (!priceString) return 0;
  // Usuwa symbole walut (np. $, €, PLN), spacje, a przecinek zamienia na kropkę
  const cleanedString = priceString.replace(/[\s|$|€|zł|USD]/gi, '').replace(',', '.');
  const price = parseFloat(cleanedString);
  return isNaN(price) ? 0 : price;
};

export default function CsvImporter() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({});
  const [categorySelections, setCategorySelections] = useState<{ [rowIndex: number]: CategorySelection }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  
  // 1. Pobieranie kategorii z Firestore
  const [categoriesSnapshot, loadingCategories] = useCollection(collection(db, 'categories'));
  const categoriesData: Category[] = categoriesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)) || [];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setHeaders(results.meta.fields || []);
          setParsedData(results.data);
        },
      });
    }
  };

  const handleColumnMappingChange = (csvHeader: string, dealField: string) => {
    setColumnMapping(prev => ({ ...prev, [dealField]: csvHeader }));
  };
  
  const handleCategoryChange = (rowIndex: number, type: 'main' | 'sub', value: string) => {
    setCategorySelections(prev => {
      const currentSelection = prev[rowIndex] || { mainCategorySlug: null, subCategorySlug: null };
      if (type === 'main') {
        // Reset subcategory if main category changes
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

  const handleProcessAndSend = async () => {
    setIsProcessing(true);
    const createDeal = httpsCallable(functions, 'createDeal');

    const dealsToSend = parsedData.map((row, index) => {
      const selection = categorySelections[index];
      if (!selection || !selection.mainCategorySlug || !selection.subCategorySlug) {
        // Zwróć null jeśli kategorie nie są wybrane dla danego wiersza
        return null;
      }
      
      // 2. Zaktualizowana logika mapowania z nowym parsowaniem ceny
      return {
        title: row[columnMapping['title']] || '',
        description: row[columnMapping['description']] || '',
        price: parsePrice(row[columnMapping['price']]),
        originalPrice: parsePrice(row[columnMapping['originalPrice']]),
        link: row[columnMapping['link']] || '',
        image: row[columnMapping['image']] || '',
        imageHint: row[columnMapping['imageHint']] || '',
        // 3. Dodanie slugów kategorii z formularza
        mainCategorySlug: selection.mainCategorySlug,
        subCategorySlug: selection.subCategorySlug,
      };
    }).filter(deal => deal !== null); // odfiltruj wiersze bez wybranych kategorii
    
    if (dealsToSend.length !== parsedData.length) {
        toast.error('Nie wszystkie okazje zostały wysłane. Upewnij się, że dla każdej wybrano kategorię i podkategorię.');
    }

    if (dealsToSend.length === 0) {
        toast.warning('Brak okazji do wysłania. Sprawdź mapowanie i wybór kategorii.');
        setIsProcessing(false);
        return;
    }

    try {
      const result = await createDeal({ deals: dealsToSend });
      console.log(result.data);
      toast.success(`${dealsToSend.length} okazji zostało pomyślnie przetworzonych i wysłanych!`);
      // Reset state after success
      setParsedData([]);
      setHeaders([]);
      setColumnMapping({});
      setCategorySelections({});
      setFileName('');

    } catch (error) {
      console.error("Błąd podczas wywoływania funkcji createDeal:", error);
      toast.error("Wystąpił błąd podczas wysyłania okazji.");
    } finally {
      setIsProcessing(false);
    }
  };

  const dealFields = ['title', 'description', 'price', 'originalPrice', 'link', 'image', 'imageHint'];

  if (authLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user || !isAdmin) {
    return <div className="text-center py-10">Brak uprawnień. Ta strona jest dostępna tylko dla administratorów.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-2"/> Importer Okazji z CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <label htmlFor="file-upload" className="mt-2 block text-sm font-medium text-gray-700 cursor-pointer">
            {fileName ? `Wybrano plik: ${fileName}` : "Wybierz plik CSV lub przeciągnij go tutaj"}
          </label>
          <Input id="file-upload" type="file" accept=".csv" onChange={handleFileUpload} className="sr-only" />
        </div>

        {parsedData.length > 0 && (
          <div className="space-y-6">
            <Alert>
              <AlertTitle>Mapowanie Kolumn</AlertTitle>
              <AlertDescription>
                Dopasuj pola okazji do kolumn z Twojego pliku CSV. Następnie wybierz dla każdej okazji odpowiednią kategorię i podkategorię.
              </AlertDescription>
            </Alert>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pole Okazji</TableHead>
                    <TableHead>Kolumna z pliku CSV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealFields.map(field => (
                    <TableRow key={field}>
                      <TableCell className="font-semibold">{field}</TableCell>
                      <TableCell>
                        <Select onValueChange={(value) => handleColumnMappingChange(value, field)}>
                          <SelectTrigger><SelectValue placeholder="Wybierz kolumnę..." /></SelectTrigger>
                          <SelectContent>
                            {headers.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <h3 className="text-lg font-semibold">Podgląd i kategoryzacja danych</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow>
                        {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                        <TableHead className="font-bold text-primary">Kategoria Główna</TableHead>
                        <TableHead className="font-bold text-primary">Podkategoria</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, rowIndex) => {
                    const selection = categorySelections[rowIndex] || { mainCategorySlug: null, subCategorySlug: null };
                    const availableSubcategories = categoriesData.find(c => c.id === selection.mainCategorySlug)?.subcategories || [];
                    return (
                      <TableRow key={rowIndex}>
                        {headers.map(header => <TableCell key={header}>{row[header]}</TableCell>)}
                        {/* 4. Dwa nowe, zależne od siebie Selecty */}
                        <TableCell>
                            <Select onValueChange={(value) => handleCategoryChange(rowIndex, 'main', value)} value={selection.mainCategorySlug || undefined}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder={loadingCategories ? 'Ładuję...' : 'Wybierz...'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {categoriesData.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell>
                            <Select 
                                onValueChange={(value) => handleCategoryChange(rowIndex, 'sub', value)} 
                                value={selection.subCategorySlug || undefined}
                                disabled={!selection.mainCategorySlug || availableSubcategories.length === 0}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder={!selection.mainCategorySlug ? 'Wybierz główną' : (availableSubcategories.length === 0 ? 'Brak opcji' : 'Wybierz...')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSubcategories.map(sub => <SelectItem key={sub.slug} value={sub.slug}>{sub.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end space-x-4">
                <Button variant="outline" onClick={() => setParsedData([])}>Anuluj</Button>
                <Button onClick={handleProcessAndSend} disabled={isProcessing || Object.keys(columnMapping).length === 0}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4"/>}
                    Przetwórz i wyślij {parsedData.length} okazji
                </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
