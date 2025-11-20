'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Save,
  Globe,
  Bell,
  Shield,
  Database
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ustawienia</h2>
        <p className="text-muted-foreground">
          Konfiguracja platformy i integracji
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Ogólne</TabsTrigger>
          <TabsTrigger value="navigation">Nawigacja</TabsTrigger>
          <TabsTrigger value="integrations">Integracje</TabsTrigger>
          <TabsTrigger value="notifications">Powiadomienia</TabsTrigger>
          <TabsTrigger value="security">Bezpieczeństwo</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Ustawienia ogólne
              </CardTitle>
              <CardDescription>
                Podstawowe ustawienia platformy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">Nazwa strony</Label>
                <Input id="siteName" defaultValue="Okazje Plus" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteDescription">Opis strony</Label>
                <Textarea 
                  id="siteDescription" 
                  defaultValue="Najlepsza platforma do odkrywania okazji i produktów w Polsce"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email kontaktowy</Label>
                <Input id="contactEmail" type="email" defaultValue="kontakt@okazjeplus.pl" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="maintenance" />
                <Label htmlFor="maintenance">Tryb konserwacji</Label>
              </div>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Zapisz zmiany
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navigation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Konfiguracja nawigacji</CardTitle>
              <CardDescription>
                Zarządzaj treściami wyświetlanymi w nawigacji
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Deal of the Day</h3>
                <div className="space-y-2">
                  <Label htmlFor="dealOfDay">ID okazji dnia</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="dealOfDay" 
                      placeholder="Wprowadź ID okazji"
                    />
                    <Button variant="outline">Wybierz</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zostanie wyświetlona w widocznym miejscu na stronie głównej
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Product of the Day</h3>
                <div className="space-y-2">
                  <Label htmlFor="productOfDay">ID produktu dnia</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="productOfDay" 
                      placeholder="Wprowadź ID produktu"
                    />
                    <Button variant="outline">Wybierz</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zostanie wyświetlony w bocznym panelu na stronach kategorii
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Promowane pozycje</h3>
                <div className="space-y-2">
                  <Label>Typ promowanych treści</Label>
                  <select className="w-full px-3 py-2 border rounded-md">
                    <option value="deals">Okazje</option>
                    <option value="products">Produkty</option>
                  </select>
                </div>
                <div className="space-y-2 mt-3">
                  <Label>Lista ID promowanych pozycji (po przecinku)</Label>
                  <Textarea 
                    placeholder="deal1, deal2, deal3"
                    rows={3}
                  />
                </div>
              </div>

              <Button>
                <Save className="h-4 w-4 mr-2" />
                Zapisz konfigurację nawigacji
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integracje zewnętrzne</CardTitle>
              <CardDescription>
                Konfiguracja połączeń z usługami zewnętrznymi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Google Analytics 4
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="ga4">Measurement ID</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="ga4" 
                      placeholder="G-XXXXXXXXXX"
                      defaultValue="G-4M4NQB0PQD"
                      readOnly
                      className="bg-muted"
                    />
                    <Badge variant="default" className="bg-green-600 self-center">Aktywne</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    GA4 jest już skonfigurowane w aplikacji. Zobacz dane w{' '}
                    <a 
                      href="https://analytics.google.com/analytics/web/#/p491578768/reports/intelligenthome" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      konsoli Google Analytics
                    </a>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Typesense</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="typesenseHost">Host</Label>
                    <Input id="typesenseHost" placeholder="https://xxx.typesense.net" />
                  </div>
                  <div>
                    <Label htmlFor="typesenseKey">API Key</Label>
                    <Input id="typesenseKey" type="password" placeholder="••••••••" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usługa wyszukiwania pełnotekstowego
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">AliExpress API</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="aliAppKey">App Key</Label>
                    <Input id="aliAppKey" placeholder="Wprowadź App Key" />
                  </div>
                  <div>
                    <Label htmlFor="aliAppSecret">App Secret</Label>
                    <Input id="aliAppSecret" type="password" placeholder="••••••••" />
                  </div>
                  <div>
                    <Label htmlFor="aliTrackingId">Tracking ID (affiliate)</Label>
                    <Input id="aliTrackingId" placeholder="Wprowadź Tracking ID" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Do automatycznego importu produktów z AliExpress
                  </p>
                </div>
              </div>

              <Button>
                <Save className="h-4 w-4 mr-2" />
                Zapisz integracje
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Powiadomienia
              </CardTitle>
              <CardDescription>
                Konfiguracja powiadomień i alertów
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Nowe okazje do moderacji</div>
                  <p className="text-sm text-muted-foreground">
                    Otrzymuj email gdy użytkownik doda nową okazję
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Nowe produkty do moderacji</div>
                  <p className="text-sm text-muted-foreground">
                    Otrzymuj email gdy zostanie dodany nowy produkt
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Nowi użytkownicy</div>
                  <p className="text-sm text-muted-foreground">
                    Powiadomienie o nowych rejestracjach
                  </p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Raport dzienny</div>
                  <p className="text-sm text-muted-foreground">
                    Codzienne podsumowanie aktywności
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Zapisz ustawienia powiadomień
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Bezpieczeństwo
              </CardTitle>
              <CardDescription>
                Ustawienia bezpieczeństwa i uprawnień
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Automatyczna moderacja</div>
                  <p className="text-sm text-muted-foreground">
                    Wymaga zatwierdzenia przed publikacją
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Rejestracja użytkowników</div>
                  <p className="text-sm text-muted-foreground">
                    Zezwól na rejestrację nowych użytkowników
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Recaptcha</div>
                  <p className="text-sm text-muted-foreground">
                    Ochrona przed botami w formularzach
                  </p>
                </div>
                <Switch />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxFileSize">Maksymalny rozmiar pliku (MB)</Label>
                <Input 
                  id="maxFileSize" 
                  type="number" 
                  defaultValue="10"
                  min="1"
                  max="50"
                />
              </div>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Zapisz ustawienia bezpieczeństwa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(SettingsPage);
