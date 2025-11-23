'use client';

/**
 * Panel importu okazji
 * 
 * Funkcje:
 * - Import CSV z okazjami
 * - Import pojedynczej okazji z URL (scraping)
 * - Bulk creation (ręczne dodawanie wielu okazji)
 * - Auto-kategoryzacja AI (3 poziomy)
 * - Auto-linkowanie do produktów w bazie
 * - Weryfikacja jakości przez AI
 */

import { useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { auth } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Upload, 
  Link as LinkIcon, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Sparkles,
  TrendingUp,
  Package,
  Tag,
  Calendar,
  DollarSign,
  Truck,
  Gift,
  Percent
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DealInput {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  merchant?: string;
  shippingCost?: number;
  dealType?: 'sale' | 'coupon' | 'freebie' | 'pricing-error' | 'cashback' | 'bundle';
  couponCode?: string;
  freeShipping?: boolean;
  expiryDate?: string;
  minOrderValue?: number;
  tags?: string[];
  source?: string;
}

interface ImportResult {
  success: boolean;
  dealId?: string;
  title: string;
  error?: string;
  categories?: { main: string; sub: string; subSub: string };
  linkedProducts?: Array<{ id: string; name: string; score: number }>;
}

function DealsImportPage() {
  const { toast } = useToast();
  
  // Stan dla importu CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  
  // Stan dla importu URL
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  
  // Stan dla bulk creation
  const [deals, setDeals] = useState<DealInput[]>([{
    title: '',
    description: '',
    price: 0,
    link: '',
    image: '',
    dealType: 'sale',
    freeShipping: false,
  }]);
  const [bulkLoading, setBulkLoading] = useState(false);
  
  // Opcje AI
  const [autoCategorize, setAutoCategorize] = useState(true);
  const [autoLinkProducts, setAutoLinkProducts] = useState(true);
  
  // Wyniki importu
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  
  // Dodaj nową okazję do bulk creation
  const addDeal = () => {
    setDeals([...deals, {
      title: '',
      description: '',
      price: 0,
      link: '',
      image: '',
      dealType: 'sale',
      freeShipping: false,
    }]);
  };
  
  // Usuń okazję
  const removeDeal = (index: number) => {
    setDeals(deals.filter((_, i) => i !== index));
  };
  
  // Aktualizuj okazję
  const updateDeal = (index: number, field: keyof DealInput, value: any) => {
    const updated = [...deals];
    updated[index] = { ...updated[index], [field]: value };
    setDeals(updated);
  };
  
  // Import CSV
  const handleCsvImport = async () => {
    if (!csvFile) {
      toast({ title: 'Błąd', description: 'Wybierz plik CSV', variant: 'destructive' });
      return;
    }
    
    setCsvLoading(true);
    try {
      // Parsowanie CSV
      const text = await csvFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const parsedDeals: DealInput[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const deal: any = {};
        
        headers.forEach((header, idx) => {
          deal[header] = values[idx];
        });
        
        // Walidacja podstawowych pól
        if (deal.title && deal.description && deal.price && deal.link && deal.image) {
          parsedDeals.push({
            title: deal.title,
            description: deal.description,
            price: parseFloat(deal.price) || 0,
            originalPrice: deal.originalPrice ? parseFloat(deal.originalPrice) : undefined,
            link: deal.link,
            image: deal.image,
            merchant: deal.merchant,
            shippingCost: deal.shippingCost ? parseFloat(deal.shippingCost) : undefined,
            dealType: deal.dealType || 'sale',
            couponCode: deal.couponCode,
            freeShipping: deal.freeShipping === 'true' || deal.freeShipping === '1',
            expiryDate: deal.expiryDate,
            source: 'csv',
          });
        }
      }
      
      if (parsedDeals.length === 0) {
        toast({ title: 'Błąd', description: 'Brak poprawnych okazji w pliku CSV', variant: 'destructive' });
        return;
      }
      
      // Wywołanie API importu
      await importDeals(parsedDeals);
      
    } catch (err: any) {
      console.error('[CSV Import] Błąd:', err);
      toast({ title: 'Błąd importu CSV', description: err.message, variant: 'destructive' });
    } finally {
      setCsvLoading(false);
    }
  };
  
  // Import z URL (scraping)
  const handleUrlImport = async () => {
    if (!urlInput.trim()) {
      toast({ title: 'Błąd', description: 'Wpisz URL okazji', variant: 'destructive' });
      return;
    }
    
    setUrlLoading(true);
    try {
      toast({ 
        title: '🔍 Scraping...', 
        description: 'Pobieram dane z podanego URL' 
      });
      
      // TODO: Implementacja scrapingu (można użyć zewnętrznego API lub proxy)
      // Na razie placeholder
      toast({ 
        title: 'Info', 
        description: 'Funkcja scrapingu URL będzie dostępna wkrótce', 
      });
      
    } catch (err: any) {
      toast({ title: 'Błąd scrapingu', description: err.message, variant: 'destructive' });
    } finally {
      setUrlLoading(false);
    }
  };
  
  // Bulk import
  const handleBulkImport = async () => {
    // Walidacja
    const validDeals = deals.filter(d => 
      d.title && d.description && d.price > 0 && d.link && d.image
    );
    
    if (validDeals.length === 0) {
      toast({ title: 'Błąd', description: 'Uzupełnij wszystkie wymagane pola', variant: 'destructive' });
      return;
    }
    
    setBulkLoading(true);
    try {
      await importDeals(validDeals);
    } catch (err: any) {
      toast({ title: 'Błąd importu', description: err.message, variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };
  
  // Wspólna funkcja importu
  const importDeals = async (dealsToImport: DealInput[]) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Brak tokena autoryzacji');
      
      toast({
        title: '🤖 Importuję okazje...',
        description: `Przetwarzanie ${dealsToImport.length} okazji z AI`,
      });
      
      const response = await fetch('/api/admin/deals/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deals: dealsToImport,
          autoCategorize,
          autoLinkProducts,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Błąd importu');
      }
      
      const result = await response.json();
      
      setImportResults(result.results || []);
      
      toast({
        title: '✅ Import zakończony!',
        description: `${result.imported} okazji zaimportowano, ${result.failed || 0} błędów`,
      });
      
      // Reset formularzy
      if (result.imported > 0) {
        setDeals([{
          title: '',
          description: '',
          price: 0,
          link: '',
          image: '',
          dealType: 'sale',
          freeShipping: false,
        }]);
        setCsvFile(null);
        setUrlInput('');
      }
      
    } catch (err: any) {
      console.error('[Import Error]:', err);
      throw err;
    }
  };
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Import okazji</h2>
        <p className="text-muted-foreground">
          Importuj okazje z CSV, URL lub dodaj ręcznie. AI automatycznie kategoryzuje i linkuje do produktów.
        </p>
      </div>
      
      {/* Opcje AI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Opcje AI
          </CardTitle>
          <CardDescription>
            Automatyzacja kategoryzacji i linkowania produktów
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={autoCategorize} 
              onCheckedChange={(checked) => setAutoCategorize(checked as boolean)}
            />
            <Label>Auto-kategoryzacja (3 poziomy kategorii przez AI)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={autoLinkProducts} 
              onCheckedChange={(checked) => setAutoLinkProducts(checked as boolean)}
            />
            <Label>Auto-linkowanie do produktów (wyszukiwanie pasujących produktów w bazie)</Label>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs importu */}
      <Tabs defaultValue="bulk" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bulk">
            <Plus className="h-4 w-4 mr-2" />
            Bulk Creation
          </TabsTrigger>
          <TabsTrigger value="csv">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </TabsTrigger>
          <TabsTrigger value="url">
            <LinkIcon className="h-4 w-4 mr-2" />
            Import z URL
          </TabsTrigger>
        </TabsList>
        
        {/* Bulk Creation */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dodaj okazje ręcznie</CardTitle>
              <CardDescription>
                Wypełnij formularz dla każdej okazji
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {deals.map((deal, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Okazja #{index + 1}</h4>
                    {deals.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeDeal(index)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Tytuł *</Label>
                      <Input
                        value={deal.title}
                        onChange={(e) => updateDeal(index, 'title', e.target.value)}
                        placeholder="Np. Apple AirPods Pro 2 - Super okazja!"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label>Opis *</Label>
                      <Textarea
                        value={deal.description}
                        onChange={(e) => updateDeal(index, 'description', e.target.value)}
                        placeholder="Szczegółowy opis okazji..."
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <Label>Cena aktualna (PLN) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={deal.price || ''}
                        onChange={(e) => updateDeal(index, 'price', parseFloat(e.target.value))}
                      />
                    </div>
                    
                    <div>
                      <Label>Cena oryginalna (PLN)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={deal.originalPrice || ''}
                        onChange={(e) => updateDeal(index, 'originalPrice', parseFloat(e.target.value) || undefined)}
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label>Link do okazji *</Label>
                      <Input
                        value={deal.link}
                        onChange={(e) => updateDeal(index, 'link', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label>URL zdjęcia *</Label>
                      <Input
                        value={deal.image}
                        onChange={(e) => updateDeal(index, 'image', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    
                    <div>
                      <Label>Sklep/Merchant</Label>
                      <Input
                        value={deal.merchant || ''}
                        onChange={(e) => updateDeal(index, 'merchant', e.target.value)}
                        placeholder="Np. Amazon.pl"
                      />
                    </div>
                    
                    <div>
                      <Label>Typ okazji</Label>
                      <Select 
                        value={deal.dealType || 'sale'}
                        onValueChange={(value) => updateDeal(index, 'dealType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sale">Promocja cenowa</SelectItem>
                          <SelectItem value="coupon">Kod rabatowy</SelectItem>
                          <SelectItem value="freebie">Za darmo</SelectItem>
                          <SelectItem value="pricing-error">Błąd cenowy</SelectItem>
                          <SelectItem value="cashback">Cashback</SelectItem>
                          <SelectItem value="bundle">Zestaw/Bundle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {deal.dealType === 'coupon' && (
                      <div className="col-span-2">
                        <Label>Kod rabatowy</Label>
                        <Input
                          value={deal.couponCode || ''}
                          onChange={(e) => updateDeal(index, 'couponCode', e.target.value)}
                          placeholder="Np. SAVE20"
                        />
                      </div>
                    )}
                    
                    <div>
                      <Label>Koszt wysyłki (PLN)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={deal.shippingCost || ''}
                        onChange={(e) => updateDeal(index, 'shippingCost', parseFloat(e.target.value) || undefined)}
                      />
                    </div>
                    
                    <div>
                      <Label>Data wygaśnięcia</Label>
                      <Input
                        type="datetime-local"
                        value={deal.expiryDate || ''}
                        onChange={(e) => updateDeal(index, 'expiryDate', e.target.value)}
                      />
                    </div>
                    
                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox 
                        checked={deal.freeShipping || false}
                        onCheckedChange={(checked) => updateDeal(index, 'freeShipping', checked)}
                      />
                      <Label>Darmowa wysyłka</Label>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2">
                <Button onClick={addDeal} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj kolejną okazję
                </Button>
                
                <Button 
                  onClick={handleBulkImport} 
                  disabled={bulkLoading}
                  className="ml-auto"
                >
                  {bulkLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Importuj okazje ({deals.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* CSV Import */}
        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle>Import z pliku CSV</CardTitle>
              <CardDescription>
                Wymagane kolumny: title, description, price, link, image
                <br />
                Opcjonalne: originalPrice, merchant, shippingCost, dealType, couponCode, freeShipping, expiryDate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Wybierz plik CSV</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
              </div>
              
              <Button 
                onClick={handleCsvImport} 
                disabled={!csvFile || csvLoading}
              >
                {csvLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Upload className="h-4 w-4 mr-2" />
                Importuj CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* URL Import */}
        <TabsContent value="url">
          <Card>
            <CardHeader>
              <CardTitle>Import z URL</CardTitle>
              <CardDescription>
                Wklej link do okazji - automatyczne wyciąganie danych (scraping)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL okazji</Label>
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.pepper.pl/promocje/..."
                />
              </div>
              
              <Button 
                onClick={handleUrlImport} 
                disabled={!urlInput || urlLoading}
              >
                {urlLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <LinkIcon className="h-4 w-4 mr-2" />
                Pobierz dane z URL
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Wyniki importu */}
      {importResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wyniki importu</CardTitle>
            <CardDescription>
              Status zaimportowanych okazji
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {importResults.map((result, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}
                >
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    
                    <div className="flex-1 space-y-2">
                      <div className="font-medium">{result.title}</div>
                      
                      {result.success && result.dealId && (
                        <div className="text-sm text-muted-foreground">
                          ID: {result.dealId}
                        </div>
                      )}
                      
                      {result.categories && (
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {result.categories.main}
                          </Badge>
                          <Badge variant="outline">
                            {result.categories.sub}
                          </Badge>
                          {result.categories.subSub && (
                            <Badge variant="outline">
                              {result.categories.subSub}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {result.linkedProducts && result.linkedProducts.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4" />
                          <span>Połączono z produktem: {result.linkedProducts[0].name}</span>
                          <Badge variant="secondary">
                            {result.linkedProducts[0].score}% dopasowanie
                          </Badge>
                        </div>
                      )}
                      
                      {result.error && (
                        <div className="text-sm text-red-600">
                          Błąd: {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default withAuth(DealsImportPage);
