/**
 * Admin: Alerts Management Page
 * 
 * Admin panel for viewing and managing price alerts.
 * This is a placeholder/skeleton for M6 bootstrap.
 * 
 * @module app/admin/alerts/page
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle, Clock, AlertCircle, TrendingDown } from 'lucide-react';

export default function AdminAlertsPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold">🔔 Zarządzanie Alertami Cenowymi</h1>
        <p className="text-muted-foreground mt-2">
          Monitoruj i zarządzaj alertami cenowymi użytkowników (M6 - Bootstrap)
        </p>
      </div>

      {/* Status Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-900">Status M6: Bootstrap</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-blue-800">
            Ta strona jest w fazie prototypu. Pełna funkcjonalność zostanie dodana w kolejnych iteracjach (M7/M8).
          </p>
        </CardContent>
      </Card>

      {/* Implementation Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Postęp Implementacji</CardTitle>
          <CardDescription>
            Funkcjonalności do zaimplementowania w M6 i M7
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* M6 Tasks */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                M6 Bootstrap (Zrobione)
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>✅ Modele danych (AlertProfile, UserAlert, NotificationRecord)</li>
                <li>✅ Funkcje pomocnicze Firestore (stubs)</li>
                <li>✅ Serwis alertów (alertsService.ts)</li>
                <li>✅ Kanały notyfikacji (stubs: email, web push, in-app)</li>
                <li>✅ API endpoint: POST /api/alerts/subscribe</li>
                <li>✅ Admin UI placeholder (ta strona)</li>
              </ul>
            </div>

            {/* M7 Tasks */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                M7 Planowane Funkcje
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>⏳ Widok listy aktywnych alertów użytkowników</li>
                <li>⏳ Statystyki: ile alertów aktywnych, wyzwolonych, błędów</li>
                <li>⏳ Możliwość dezaktywacji/usunięcia alertów przez admina</li>
                <li>⏳ Historia powiadomień (kiedy wysłane, status dostarczenia)</li>
                <li>⏳ Konfiguracja kanałów notyfikacji (email provider, web push)</li>
                <li>⏳ Testowanie notyfikacji (wysyłka testowa)</li>
                <li>⏳ Panel użytkownika: zarządzanie własnymi alertami</li>
              </ul>
            </div>

            {/* M8 Advanced Features */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-purple-600" />
                M8 Zaawansowane (Przyszłość)
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>⏳ Automatyczne sugestie alertów na podstawie historii przeglądania</li>
                <li>⏳ Grupowanie alertów (daily digest)</li>
                <li>⏳ AI-powered alert optimization (najlepsze progi cenowe)</li>
                <li>⏳ Integracja z zewnętrznymi dostawcami notyfikacji</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats (Placeholder) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Aktywne Alerty
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Dane dostępne po implementacji M7
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Wyzwolone Dziś
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Dane dostępne po implementacji M7
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Wysłane Notyfikacje
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Dane dostępne po implementacji M7
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Błędy Dostarczenia
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Dane dostępne po implementacji M7
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Następne Kroki</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-1">Dla Developerów:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Zaimplementować faktyczne zapytania Firestore w alertsService.ts</li>
                <li>• Dodać prawdziwe wysyłanie emaili w notificationChannels.ts</li>
                <li>• Skonfigurować Web Push (VAPID keys)</li>
                <li>• Dodać komponenty React do wyświetlania listy alertów</li>
                <li>• Zintegrować z istniejącym systemem notyfikacji (Notification type)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Dla Adminów:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Skonfigurować zmienne środowiskowe dla notyfikacji</li>
                <li>• Włączyć feature flag: NEXT_PUBLIC_PRICE_ALERTS_ENABLED=true</li>
                <li>• Przetestować API endpoint /api/alerts/subscribe</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Action Buttons */}
      <div className="flex gap-4">
        <Button disabled variant="outline">
          Wyświetl Wszystkie Alerty (M7)
        </Button>
        <Button disabled variant="outline">
          Statystyki Notyfikacji (M7)
        </Button>
        <Button disabled variant="outline">
          Ustawienia Kanałów (M7)
        </Button>
      </div>
    </div>
  );
}
