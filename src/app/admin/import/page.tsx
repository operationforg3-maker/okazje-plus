'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, Package, Link2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                Import z pliku CSV
              </CardTitle>
              <CardDescription>
                Importuj produkty lub okazje z pliku CSV. Pobierz szablon, aby poznać wymagany format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Downloads */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Szablon dla produktów</CardTitle>
                    <CardDescription>
                      Plik CSV z wymaganymi kolumnami dla produktów
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Pobierz szablon produktów.csv
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Szablon dla okazji</CardTitle>
                    <CardDescription>
                      Plik CSV z wymaganymi kolumnami dla okazji
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Pobierz szablon okazji.csv
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Przeciągnij i upuść plik CSV</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  lub kliknij, aby wybrać plik
                </p>
                <Button>Wybierz plik</Button>
              </div>

              {/* Instructions */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Wymagania dla pliku CSV:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Plik musi być w formacie CSV (UTF-8)</li>
                  <li>Pierwsza linia musi zawierać nazwy kolumn</li>
                  <li>Wymagane kolumny: name/title, description, price, mainCategorySlug, subCategorySlug</li>
                  <li>Opcjonalne kolumny: image, imageHint, originalPrice, affiliateUrl</li>
                  <li>Maksymalny rozmiar pliku: 10 MB</li>
                </ul>
              </div>

              {/* Recent Imports */}
              <div>
                <h3 className="font-semibold mb-3">Historia importów</h3>
                <div className="space-y-2">
                  {[
                    { file: 'produkty_elektronika_2024.csv', date: '2024-11-09', status: 'success', count: 156 },
                    { file: 'okazje_listopad.csv', date: '2024-11-08', status: 'success', count: 89 },
                    { file: 'produkty_dom_ogrod.csv', date: '2024-11-07', status: 'partial', count: 234 },
                  ].map((imp, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileUp className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{imp.file}</div>
                          <div className="text-xs text-muted-foreground">{imp.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={imp.status === 'success' ? 'default' : 'secondary'}>
                          {imp.count} pozycji
                        </Badge>
                        <Badge variant={imp.status === 'success' ? 'default' : 'secondary'}>
                          {imp.status === 'success' ? 'Sukces' : 'Częściowy'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
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
