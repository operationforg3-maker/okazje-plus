'use client';

/**
 * AliExpress Import Wizard - Admin UI (M1 Placeholder)
 * 
 * This is a skeleton implementation for M1. It shows the wizard steps
 * but does not implement full functionality yet.
 * 
 * TODO M2:
 * - Implement OAuth connection flow
 * - Add profile creation form
 * - Add live import preview
 * - Add import run history
 * - Add category mapping interface
 * - Add bulk actions for import runs
 */

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Play, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Link as LinkIcon,
  Filter,
  Database
} from 'lucide-react';

/**
 * Wizard steps for AliExpress import configuration
 */
export enum WizardStep {
  CONNECT = 'connect',
  CONFIGURE = 'configure',
  TEST = 'test',
  SCHEDULE = 'schedule',
  MONITOR = 'monitor'
}

const WIZARD_STEPS = [
  {
    id: WizardStep.CONNECT,
    title: '1. Połącz z AliExpress',
    description: 'Autoryzuj dostęp do AliExpress API',
    icon: LinkIcon,
    status: 'todo' as const
  },
  {
    id: WizardStep.CONFIGURE,
    title: '2. Skonfiguruj profil importu',
    description: 'Ustaw filtry, kategorie i zasady mapowania',
    icon: Settings,
    status: 'todo' as const
  },
  {
    id: WizardStep.TEST,
    title: '3. Testuj import',
    description: 'Wykonaj test importu (dry-run) bez zapisywania',
    icon: Play,
    status: 'todo' as const
  },
  {
    id: WizardStep.SCHEDULE,
    title: '4. Zaplanuj synchronizację',
    description: 'Ustaw harmonogram automatycznych importów',
    icon: Database,
    status: 'todo' as const
  },
  {
    id: WizardStep.MONITOR,
    title: '5. Monitoruj wyniki',
    description: 'Zobacz historię i statystyki importów',
    icon: FileText,
    status: 'todo' as const
  }
];

function AliExpressImportWizard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          🛍️ Import z AliExpress
        </h2>
        <p className="text-muted-foreground mt-2">
          Automatyczny import produktów i okazji z platformy AliExpress
        </p>
      </div>

      {/* Status Alert - M1 Implementation Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">
                Milestone 1 - Wersja podstawowa
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                To jest szkielet interfejsu importu AliExpress. Pełna funkcjonalność
                będzie dostępna w kolejnych etapach (M2, M3).
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                <li>OAuth i autoryzacja API - W przygotowaniu (M2)</li>
                <li>Testowy import (dry-run) - Zaimplementowano</li>
                <li>Harmonogram automatyczny - Funkcja utworzona</li>
                <li>Pełny interfejs konfiguracji - W przygotowaniu (M2)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wizard Steps Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {WIZARD_STEPS.map((step) => {
          const Icon = step.icon;
          const statusColors = {
            todo: 'bg-gray-100 text-gray-700',
            in_progress: 'bg-blue-100 text-blue-700',
            completed: 'bg-green-100 text-green-700',
            error: 'bg-red-100 text-red-700'
          };

          return (
            <Card key={step.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {step.title}
                      </CardTitle>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={statusColors[step.status]}
                  >
                    {step.status === 'todo' && 'Oczekuje'}
                    {step.status === 'completed' && 'Gotowe'}
                    {step.status === 'in_progress' && 'W toku'}
                    {step.status === 'error' && 'Błąd'}
                  </Badge>
                </div>
                <CardDescription className="mt-2">
                  {step.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  disabled
                >
                  Przejdź do kroku
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Szybkie akcje</CardTitle>
          <CardDescription>
            Najczęściej używane operacje importu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full justify-start" variant="outline" disabled>
            <Play className="h-4 w-4 mr-2" />
            Uruchom testowy import (dry-run)
          </Button>
          <Button className="w-full justify-start" variant="outline" disabled>
            <Database className="h-4 w-4 mr-2" />
            Utwórz nowy profil importu
          </Button>
          <Button className="w-full justify-start" variant="outline" disabled>
            <FileText className="h-4 w-4 mr-2" />
            Zobacz historię importów
          </Button>
          <Button className="w-full justify-start" variant="outline" disabled>
            <Settings className="h-4 w-4 mr-2" />
            Zarządzaj profilami
          </Button>
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Dokumentacja</CardTitle>
          <CardDescription>
            Przewodniki i informacje techniczne
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <h4 className="font-semibold mb-1">Dostępne zasoby:</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <code className="text-xs bg-muted px-1 py-0.5 rounded">docs/integration/aliexpress.md</code> - Pełna dokumentacja</li>
              <li>• <code className="text-xs bg-muted px-1 py-0.5 rounded">src/integrations/aliexpress/</code> - Kod integracji</li>
              <li>• <code className="text-xs bg-muted px-1 py-0.5 rounded">src/ai/flows/aliexpress/</code> - Przepływy AI</li>
            </ul>
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              W razie pytań lub problemów, sprawdź dokumentację lub skontaktuj się z zespołem rozwoju.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Technical Info (for developers) */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">🔧 Informacje techniczne (M1)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>• Interfejsy danych: <code>Vendor, ImportProfile, ImportRun</code> w <code>types.ts</code></p>
          <p>• RBAC: Rozszerzone role użytkowników (admin, moderator, specjalista, user)</p>
          <p>• Logging: Struktura logowania w <code>src/lib/logging.ts</code></p>
          <p>• Typesense: Stubowe funkcje kolejkowania w <code>src/search/typesenseQueue.ts</code></p>
          <p>• Firebase Function: <code>scheduleAliExpressSync</code> uruchamiana codziennie o 2:00</p>
          <p>• AI Flows (stubs): aiSuggestCategory, aiNormalizeTitlePL, aiDealQualityScore</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(AliExpressImportWizard);
