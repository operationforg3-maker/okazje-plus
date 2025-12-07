'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EnhancedCsvImporter from '@/components/admin/enhanced-csv-importer';
import AliExpressImporter from '@/components/admin/aliexpress-importer';

function ImportPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Import danych</h2>
        <p className="text-muted-foreground">
          Zaimportuj produkty i okazje z różnych źródeł
        </p>
      </div>

      {/* Import Methods */}
      <Tabs defaultValue="csv" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 auto-cols-max">
          <TabsTrigger value="csv">CSV</TabsTrigger>
          <TabsTrigger value="aliexpress">AliExpress</TabsTrigger>
          <TabsTrigger value="allegro">Allegro</TabsTrigger>
          <TabsTrigger value="amazon">Amazon</TabsTrigger>
          <TabsTrigger value="ebay">eBay</TabsTrigger>
          <TabsTrigger value="url">Z URL</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <EnhancedCsvImporter />
        </TabsContent>

        <TabsContent value="aliexpress" className="space-y-4">
          <AliExpressImporter />
        </TabsContent>

        <TabsContent value="allegro" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔶 Allegro
              </CardTitle>
              <CardDescription>
                Import produktów z Allegro - największego polskiego portalu aukcyjnego
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-sm mb-2">🚀 Wkrótce dostępne</h4>
                <p className="text-sm text-muted-foreground">
                  Integracja z Allegro API jest w trakcie konfiguracji. Będzie możliwe wyszukiwanie i import produktów bezpośrednio z platformy Allegro.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ Pobieranie cennika z Allegro<br/>
                  ✓ Automatyczna kategoryzacja AI<br/>
                  ✓ Tracking zmian cen<br/>
                  ✓ Synchronizacja statusu produktów
                </p>
              </div>
              <Button disabled className="w-full">
                Import z Allegro (wkrótce)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amazon" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🟠 Amazon
              </CardTitle>
              <CardDescription>
                Import produktów z Amazon.com - światowego lidera e-commerce
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <h4 className="font-semibold text-sm mb-2">🚀 Wkrótce dostępne</h4>
                <p className="text-sm text-muted-foreground">
                  Integracja z Amazon Product Advertising API umożliwi import międzynarodowych produktów z pełnym wskaźnikiem cen.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ Wsparcie dla Amazon.com i Amazon.eu<br/>
                  ✓ Konwersja walut (USD/EUR → PLN)<br/>
                  ✓ Linki afiliacyjne<br/>
                  ✓ Rating i opinie klientów
                </p>
              </div>
              <Button disabled className="w-full">
                Import z Amazon (wkrótce)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ebay" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔴 eBay
              </CardTitle>
              <CardDescription>
                Import produktów z eBay - globalnego rynku aukcyjnego
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-sm mb-2">🚀 Wkrótce dostępne</h4>
                <p className="text-sm text-muted-foreground">
                  eBay REST API pozwoli importować artykuły na sprzedaż, aukcje i oferty fixed-price z całej platformy.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ Obsługa aukcji i fixed-price<br/>
                  ✓ Filtrowanie po warunkach (nowy/używany)<br/>
                  ✓ Historia cen i trendy<br/>
                  ✓ Reputacja sprzedawców
                </p>
              </div>
              <Button disabled className="w-full">
                Import z eBay (wkrótce)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Import z URL
              </CardTitle>
              <CardDescription>
                Zaimportuj pojedynczy produkt lub okazję podając URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL produktu lub okazji</label>
                <input 
                  type="url" 
                  className="w-full px-3 py-2 border rounded-md" 
                  placeholder="https://example.com/product/..."
                />
                <p className="text-xs text-muted-foreground">
                  Wspierane strony: Allegro, OLX, Amazon (wkrótce więcej)
                </p>
              </div>

              <Button className="w-full">
                Pobierz dane z URL
              </Button>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Jak to działa?</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Wklej URL do produktu ze wspieranej strony</li>
                  <li>System automatycznie pobierze tytuł, opis, cenę i zdjęcia</li>
                  <li>Sprawdź i uzupełnij brakujące dane</li>
                  <li>Wybierz kategorię i zapisz produkt</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(ImportPage);
