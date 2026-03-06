/**
 * Link Verifier - Weryfikacja linków afiliacyjnych
 *
 * Funkcjonalność:
 * - Monitoruje zdrowie linków ze wszystkich platform (AliExpress, Allegro, Amazon, eBay, Convertiser)
 * - Weryfikuje dostępność (HTTP status code)
 * - Mierzy szybkość (response time)
 * - Umożliwia zastąpienie martwych linków
 * - Śledzi źródło linku w bazie danych
 *
 * API:
 * - GET /api/admin/links/list - Załaduj linki
 * - POST /api/admin/links/verify-all - Weryfikuj wszystkie
 * - POST /api/admin/links/replace - Zamień martwą
 *
 * Baza Danych:
 * - affiliateLinks/{linkId} - Nowa kolekcja
 *
 * Todo:
 * - HTTP health check z timeout (5s)
 * - Batch verification (10 równocześnie)
 * - Auto-replace dead links
 * - Retry logic z exponential backoff
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

interface AffiliateLink {
  id: string;
  url: string;
  productId: string;
  dealId?: string;
  platform: 'aliexpress' | 'allegro' | 'amazon' | 'ebay' | 'convertiser' | 'other';
  status: 'active' | 'dead' | 'slow' | 'checking' | 'unknown';
  httpCode?: number;
  responseTime?: number;
  lastChecked?: string;
  source: string; // "import_aliexpress", "manual", etc.
  replacedWith?: string;
  replacedAt?: string;
  metadata?: {
    title?: string;
    description?: string;
    thumbnail?: string;
    price?: string;
  };
}

interface VerificationStats {
  total: number;
  active: number;
  dead: number;
  slow: number;
  checking: number;
  unknown: number;
  lastRun?: string;
}

interface LinkVerifierProps {
  onConsoleLog?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  aliexpress: 'bg-red-100 text-red-800',
  allegro: 'bg-purple-100 text-purple-800',
  amazon: 'bg-orange-100 text-orange-800',
  ebay: 'bg-yellow-100 text-yellow-800',
  convertiser: 'bg-blue-100 text-blue-800',
  other: 'bg-gray-100 text-gray-800',
};

const STATUS_ICONS = {
  active: <CheckCircle className="h-4 w-4 text-green-600" />,
  dead: <XCircle className="h-4 w-4 text-red-600" />,
  slow: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
  checking: <Loader2 className="h-4 w-4 animate-spin text-blue-600" />,
  unknown: <Clock className="h-4 w-4 text-gray-600" />,
};

export function LinkVerifier({ onConsoleLog }: LinkVerifierProps) {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [stats, setStats] = useState<VerificationStats>({
    total: 0,
    active: 0,
    dead: 0,
    slow: 0,
    checking: 0,
    unknown: 0,
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchUrl, setSearchUrl] = useState('');
  const [showUrls, setShowUrls] = useState<Set<string>>(new Set());

  // Załaduj linki
  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      onConsoleLog?.('🔍 Ładuję linki afiliacyjne...', 'info');

      const response = await fetch('/api/admin/links/list');
      if (!response.ok) throw new Error('Błąd ładowania linków');

      const { links: loadedLinks, stats: loadedStats } = await response.json();
      setLinks(loadedLinks);
      setStats(loadedStats);

      onConsoleLog?.(
        `✅ Załadowano ${loadedLinks.length} linków (${loadedStats.active} aktywne, ${loadedStats.dead} martwych)`,
        'success'
      );
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [onConsoleLog]);

  // Weryfikuj wszystkie linki
  const verifyAllLinks = async () => {
    try {
      setChecking(true);
      onConsoleLog?.('🔄 Rozpoczynam weryfikację wszystkich linków...', 'info');

      const response = await fetch('/api/admin/links/verify-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeout: 5000,
          parallel: 10,
        }),
      });

      if (!response.ok) throw new Error('Błąd weryfikacji');

      const result = await response.json();
      await loadLinks();

      onConsoleLog?.(
        `✅ Weryfikacja ukończona: ${result.checked} linków sprawdzono`,
        'success'
      );
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setChecking(false);
    }
  };

  // Zastąp martwą link
  const replaceDeadLink = async (linkId: string, newUrl: string) => {
    try {
      const response = await fetch('/api/admin/links/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, newUrl }),
      });

      if (!response.ok) throw new Error('Błąd zamiany linku');

      await loadLinks();
      onConsoleLog?.(`✅ Link zastąpiony`, 'success');
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    }
  };

  // Filtrowanie linków
  const filteredLinks = links.filter(link => {
    const platformMatch = filterPlatform === 'all' || link.platform === filterPlatform;
    const statusMatch = filterStatus === 'all' || link.status === filterStatus;
    const searchMatch =
      searchUrl === '' ||
      link.url.toLowerCase().includes(searchUrl.toLowerCase());
    return platformMatch && statusMatch && searchMatch;
  });

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const toggleUrlVisibility = (linkId: string) => {
    setShowUrls(prev => {
      const next = new Set(prev);
      if (next.has(linkId)) {
        next.delete(linkId);
      } else {
        next.add(linkId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Weryfikacja linków afiliacyjnych</h3>
        <p className="text-sm text-muted-foreground">
          Monitoruj zdrowie i dostępność linków ze wszystkich platform
        </p>
      </div>

      {/* STATYSTYKI */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Ogółem linków</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-700">{stats.active}</div>
            <div className="text-xs text-green-600">Aktywne ✓</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-700">{stats.dead}</div>
            <div className="text-xs text-red-600">Martwe ✗</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-yellow-700">{stats.slow}</div>
            <div className="text-xs text-yellow-600">Powolne ⚠</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-700">{stats.checking}</div>
            <div className="text-xs text-blue-600">Sprawdzanie ↻</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-gray-700">{stats.unknown}</div>
            <div className="text-xs text-gray-600">Nieznane ?</div>
          </CardContent>
        </Card>
      </div>

      {/* AKCJE */}
      <div className="flex flex-col md:flex-row gap-2">
        <Button
          onClick={verifyAllLinks}
          disabled={checking}
          className="flex-1 gap-2"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {checking ? 'Weryfikuję...' : 'Weryfikuj wszystkie'}
        </Button>
        <Button
          onClick={loadLinks}
          disabled={loading}
          variant="outline"
          className="flex-1 gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Odśwież listę
        </Button>
      </div>

      {/* FILTRY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Platforma</Label>
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie platformy</SelectItem>
              <SelectItem value="aliexpress">AliExpress</SelectItem>
              <SelectItem value="allegro">Allegro</SelectItem>
              <SelectItem value="amazon">Amazon</SelectItem>
              <SelectItem value="ebay">eBay</SelectItem>
              <SelectItem value="convertiser">Convertiser</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              <SelectItem value="active">✓ Aktywne</SelectItem>
              <SelectItem value="dead">✗ Martwe</SelectItem>
              <SelectItem value="slow">⚠ Powolne</SelectItem>
              <SelectItem value="unknown">? Nieznane</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Szukaj URL</Label>
          <Input
            placeholder="Szukaj po URL..."
            value={searchUrl}
            onChange={e => setSearchUrl(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* LISTA LINKÓW */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {stats.lastRun
            ? `Ostatnia weryfikacja: ${new Date(stats.lastRun).toLocaleString('pl-PL')}`
            : 'Linki jeszcze nie były weryfikowane'}
        </AlertDescription>
      </Alert>

      <ScrollArea className="h-[500px] border rounded-lg p-4">
        <div className="space-y-2">
          {filteredLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Brak linków do wyświetlenia
            </div>
          ) : (
            filteredLinks.map(link => (
              <Card key={link.id} className="overflow-hidden">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-1">{STATUS_ICONS[link.status]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={`text-xs ${PLATFORM_COLORS[link.platform]}`}>
                            {link.platform.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {link.source}
                          </Badge>
                        </div>

                        {/* URL Z TOGGLE */}
                        <div className="flex items-center gap-1 mb-2">
                          <button
                            onClick={() => toggleUrlVisibility(link.id)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground"
                          >
                            {showUrls.has(link.id) ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                          </button>
                          {showUrls.has(link.id) ? (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate flex items-center gap-1"
                            >
                              <span className="truncate">{link.url}</span>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              [Link ukryty]
                            </span>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(link.url);
                              toast.success('Skopiowano do schowka');
                            }}
                            className="p-1 hover:bg-muted rounded text-muted-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>

                        {/* METADATA */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
                          {link.responseTime && (
                            <div>⏱ {link.responseTime}ms</div>
                          )}
                          {link.httpCode && (
                            <div>HTTP: {link.httpCode}</div>
                          )}
                          {link.lastChecked && (
                            <div>
                              Sprawdzono:{' '}
                              {new Date(link.lastChecked).toLocaleString('pl-PL')}
                            </div>
                          )}
                          {link.replacedAt && (
                            <div className="col-span-2 text-yellow-600">
                              🔄 Zastąpiono{' '}
                              {new Date(link.replacedAt).toLocaleString('pl-PL')}
                            </div>
                          )}
                        </div>

                        {link.metadata && (
                          <div className="text-xs text-muted-foreground">
                            {link.metadata.title && (
                              <div>📄 {link.metadata.title}</div>
                            )}
                            {link.metadata.price && (
                              <div>💰 {link.metadata.price}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AKCJE */}
                    {link.status === 'dead' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs flex-shrink-0"
                        onClick={() => {
                          // TODO: Modal do zamiany linku
                          const newUrl = prompt('Podaj nowy URL:');
                          if (newUrl) {
                            replaceDeadLink(link.id, newUrl);
                          }
                        }}
                      >
                        Zastąp
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          💡 Linki martwe i powolne mogą zniżać wiarygodność. Rozważ automatyczną
          wymianę na produkty ze zmienionego importu lub usunięcie.
        </AlertDescription>
      </Alert>
    </div>
  );
}
