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
          <TabsTrigger value="convertiser">Convertiser</TabsTrigger>
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
                <h4 className="font-semibold text-sm mb-2">✅ Dostępne</h4>
                <p className="text-sm text-muted-foreground">
                  Wyszukuj i importuj produkty bezpośrednio z Allegro z automatycznym mapowaniem kategorii.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ Wyszukiwanie po frazie<br/>
                  ✓ Filtrowanie po cenie<br/>
                  ✓ Mapowanie kategorii 3-poziomowe<br/>
                  ✓ Deduplikacja
                </p>
              </div>
              <Button className="w-full" asChild>
                <a href="/admin/allegro-import">Import z Allegro →</a>
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
                <h4 className="font-semibold text-sm mb-2">✅ Dostępne</h4>
                <p className="text-sm text-muted-foreground">
                  Importuj międzynarodowe produkty z automatyczną konwersją cen.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ Wsparcie dla Amazon.com i Amazon.eu<br/>
                  ✓ Konwersja walut (USD/EUR → PLN)<br/>
                  ✓ Rating i opinie klientów<br/>
                  ✓ Linki afiliacyjne
                </p>
              </div>
              <Button className="w-full" asChild>
                <a href="/admin/amazon-import">Import z Amazon →</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convertiser" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚡ Convertiser
              </CardTitle>
              <CardDescription>
                Import hurtowy z platformy Convertiser - setki tysięcy produktów
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-sm mb-2">✅ Dostępne</h4>
                <p className="text-sm text-muted-foreground">
                  Importuj setki tysięcy produktów z afiliacyjnej platformy Convertiser z systemem prowizji i filtrami.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ Wyszukiwanie z filtrami<br/>
                  ✓ Tracking prowizji afiliacyjnej<br/>
                  ✓ Setki tysięcy produktów<br/>
                  ✓ Paginacja 30 produktów/strona
                </p>
              </div>
              <Button className="w-full" asChild>
                <a href="/admin/convertiser-import">Import z Convertiser →</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ebay" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔴 eBay (Legacy)
              </CardTitle>
              <CardDescription>
                Import produktów z eBay - globalnego rynku aukcyjnego (zastapiło Convertiser)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-sm mb-2">✅ Dostępne (ale użyj Convertiser)</h4>
                <p className="text-sm text-muted-foreground">
                  Importuj aukcje i oferty fixed-price. Rekomendujemy Convertiser dla lepszego wsparcia i filtrów.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ Obsługa aukcji i fixed-price<br/>
                  ✓ Filtrowanie po warunkach<br/>
                  ✓ Reputacja sprzedawców<br/>
                  ✓ Informacje o dostawie
                </p>
              </div>
              <Button className="w-full" asChild>
                <a href="/admin/ebay-import">Import z eBay →</a>
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
