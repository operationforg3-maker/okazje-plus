'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, Package, Link2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EnhancedCsvImporter from '@/components/admin/enhanced-csv-importer';

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="csv">Import CSV</TabsTrigger>
          <TabsTrigger value="aliexpress">AliExpress API</TabsTrigger>
          <TabsTrigger value="url">Import z URL</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <EnhancedCsvImporter />
        </TabsContent>

        <TabsContent value="aliexpress" className="space-y-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Import z AliExpress API
              </CardTitle>
              <CardDescription>
                Automatycznie importuj produkty z AliExpress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Integracja z AliExpress API</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ta funkcja będzie dostępna w następnej wersji. Pozwoli na automatyczny import
                  produktów bezpośrednio z AliExpress z wykorzystaniem API Dropshipper.
                </p>
                <Badge variant="secondary">W przygotowaniu</Badge>
                
                <div className="mt-6 text-left bg-background rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Planowane funkcje:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Wyszukiwanie produktów po kategoriach</li>
                    <li>Automatyczne pobieranie zdjęć i opisów</li>
                    <li>Generowanie linków afiliacyjnych</li>
                    <li>Automatyczna konwersja cen (USD → PLN)</li>
                    <li>Masowy import wybranych produktów</li>
                    <li>Synchronizacja cen i dostępności</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Konfiguracja API</CardTitle>
              <CardDescription>
                Skonfiguruj klucze dostępu do AliExpress API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">App Key</label>
                  <input 
                    type="text" 
                    className="w-full mt-1 px-3 py-2 border rounded-md" 
                    placeholder="Wprowadź App Key"
                    disabled
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">App Secret</label>
                  <input 
                    type="password" 
                    className="w-full mt-1 px-3 py-2 border rounded-md" 
                    placeholder="Wprowadź App Secret"
                    disabled
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tracking ID</label>
                  <input 
                    type="text" 
                    className="w-full mt-1 px-3 py-2 border rounded-md" 
                    placeholder="Wprowadź Tracking ID dla programu afiliacyjnego"
                    disabled
                  />
                </div>
                <Button disabled className="w-full">
                  Zapisz konfigurację (wkrótce)
                </Button>
              </div>
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
