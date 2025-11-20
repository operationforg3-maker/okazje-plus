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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="csv">Import CSV</TabsTrigger>
          <TabsTrigger value="aliexpress">AliExpress API</TabsTrigger>
          <TabsTrigger value="url">Import z URL</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <EnhancedCsvImporter />
        </TabsContent>

        <TabsContent value="aliexpress" className="space-y-4">
          <AliExpressImporter />
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
