'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Database,
  Sparkles,
  Zap,
  Eye,
  Clock,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Globe
} from 'lucide-react';

type ImportSystem = 'setup' | 'bulk' | 'batch';

interface ImportSystemsComparisonProps {
  currentSystem: ImportSystem;
  variant?: 'compact' | 'full';
}

export function ImportSystemsComparison({ currentSystem, variant = 'full' }: ImportSystemsComparisonProps) {
  const systems = {
    setup: {
      name: 'Setup & Seeding',
      icon: Database,
      color: 'blue',
      route: '/admin/setup',
      description: 'Szybkie seedowanie testowych danych dla development',
      features: [
        { icon: CheckCircle, text: 'Małe ilości (5-100 items)', color: 'text-green-600' },
        { icon: CheckCircle, text: 'Synchroniczne (instant result)', color: 'text-green-600' },
        { icon: CheckCircle, text: 'AliExpress API + manual data', color: 'text-green-600' },
        { icon: XCircle, text: 'Brak AI enrichment', color: 'text-red-600' },
        { icon: XCircle, text: 'Brak preview', color: 'text-red-600' },
      ],
      useCases: ['Development & Testing', 'Quick database reset', 'Demo data generation'],
      badge: 'Dev/Testing',
      badgeColor: 'bg-blue-600'
    },
    bulk: {
      name: 'Bulk Import (AI Preview)',
      icon: Sparkles,
      color: 'purple',
      // route: '/admin/bulk-import',
      description: 'AI-powered import z podglądem przed zatwierdzeniem',
      features: [
        { icon: CheckCircle, text: 'Średnie ilości (50-200 items)', color: 'text-green-600' },
        { icon: CheckCircle, text: '5-stage AI Pipeline', color: 'text-green-600' },
        { icon: CheckCircle, text: 'Preview → Review → Commit', color: 'text-green-600' },
        { icon: CheckCircle, text: 'Multi-language (PL, EN, DE)', color: 'text-green-600' },
        { icon: AlertCircle, text: 'Manual review required', color: 'text-amber-600' },
      ],
      useCases: ['Quality-controlled import', 'New category seeding', 'Testing AI translations'],
      badge: 'Quality Control',
      badgeColor: 'bg-purple-600'
    },
    batch: {
      name: 'Batch Import (Background)',
      icon: Zap,
      color: 'orange',
      route: '/admin/batch-import',
      description: 'Masowy import całego katalogu w tle z kontrolą',
      features: [
        { icon: CheckCircle, text: 'Duże ilości (1000+ items)', color: 'text-green-600' },
        { icon: CheckCircle, text: 'Background Job System', color: 'text-green-600' },
        { icon: CheckCircle, text: 'Pause/Resume/Cancel', color: 'text-green-600' },
        { icon: CheckCircle, text: 'Real-time progress tracking', color: 'text-green-600' },
        { icon: CheckCircle, text: 'Rollback support', color: 'text-green-600' },
      ],
      useCases: ['Production catalog import', 'Overnight data refresh', 'Full category population'],
      badge: 'Production',
      badgeColor: 'bg-orange-600'
    }
  };

  const current = systems[currentSystem];
  // Filter out systems without a route (bulk-import not yet implemented)
  const others = Object.entries(systems).filter(
    ([key]) => key !== currentSystem && systems[key as keyof typeof systems].route
  );

  if (variant === 'compact') {
    return (
      <Alert className="border-2">
        <current.icon className="h-5 w-5" />
        <AlertTitle className="flex items-center gap-2">
          {current.name}
          <Badge className={current.badgeColor}>{current.badge}</Badge>
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm">{current.description}</p>
          <div className="flex flex-wrap gap-2">
            {others.map(([key, sys]) => (
              <a
                key={key}
                href={sys.route}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <sys.icon className="h-3 w-3" />
                {sys.name}
              </a>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current System Highlight */}
      <Card className={`border-2 border-${current.color}-500 bg-${current.color}-50 dark:bg-${current.color}-950/20`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg bg-gradient-to-br from-${current.color}-500 to-${current.color}-600 flex items-center justify-center`}>
              <current.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {current.name}
                <Badge className={current.badgeColor}>{current.badge}</Badge>
              </div>
              <p className="text-sm font-normal text-muted-foreground">{current.description}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid gap-2">
              {current.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <feature.icon className={`h-4 w-4 mt-0.5 ${feature.color}`} />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Kiedy używać:</p>
              <ul className="space-y-1">
                {current.useCases.map((useCase, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground">• {useCase}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 Porównanie systemów importu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">Feature</th>
                  <th className="text-center p-2">
                    <Database className="h-4 w-4 inline mr-1" />
                    Setup
                  </th>
                  <th className="text-center p-2">
                    <Sparkles className="h-4 w-4 inline mr-1" />
                    Bulk
                  </th>
                  <th className="text-center p-2">
                    <Zap className="h-4 w-4 inline mr-1" />
                    Batch
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 font-medium">Rozmiar</td>
                  <td className="text-center p-2">5-100</td>
                  <td className="text-center p-2">50-200</td>
                  <td className="text-center p-2">1000+</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">AI Pipeline</td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><CheckCircle className="h-4 w-4 text-green-600 inline" /> 5-stage</td>
                  <td className="text-center p-2"><CheckCircle className="h-4 w-4 text-green-600 inline" /> 5-stage</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Preview</td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><Eye className="h-4 w-4 text-green-600 inline" /> Tak</td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Background Job</td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><CheckCircle className="h-4 w-4 text-green-600 inline" /> Async</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Pause/Resume</td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><Clock className="h-4 w-4 text-green-600 inline" /> Tak</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Rollback</td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><RotateCcw className="h-4 w-4 text-green-600 inline" /> Tak</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Translation</td>
                  <td className="text-center p-2"><XCircle className="h-4 w-4 text-red-600 inline" /></td>
                  <td className="text-center p-2"><Globe className="h-4 w-4 text-green-600 inline" /> PL, EN, DE</td>
                  <td className="text-center p-2"><Globe className="h-4 w-4 text-green-600 inline" /> PL, EN, DE</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Alternative Systems */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {others.map(([key, sys]) => {
          const System = sys as typeof current;
          return (
            <a key={key} href={System.route} className="block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <System.icon className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-base">{System.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">{System.badge}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{System.description}</p>
                  <div className="space-y-1">
                    {System.useCases.slice(0, 2).map((useCase, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">• {useCase}</div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
