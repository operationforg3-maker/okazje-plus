'use client';

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Activity,
  Database,
  Zap,
  Vote,
  Server
} from 'lucide-react';

interface HealthCheck {
  status: 'ok' | 'warning' | 'error' | 'degraded' | 'info';
  message?: string;
  [key: string]: any;
}

interface HealthResult {
  status: string;
  timestamp: string;
  checks: Record<string, HealthCheck>;
  performance?: {
    responseTime: string;
    status: string;
  };
  error?: string;
}

function SystemHealthPage() {
  const [generalHealth, setGeneralHealth] = useState<HealthResult | null>(null);
  const [voteHealth, setVoteHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const runHealthChecks = async () => {
    setLoading(true);
    try {
      // 1. General health
      const generalRes = await fetch('/api/health?detailed=true');
      const generalData = await generalRes.json();
      setGeneralHealth(generalData);

      // 2. Vote system health
      const voteRes = await fetch('/api/health/vote');
      const voteData = await voteRes.json();
      setVoteHealth(voteData);

      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthChecks();
    
    // Auto-refresh co 30 sekund
    const interval = setInterval(runHealthChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
      case 'degraded':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      ok: 'default',
      warning: 'secondary',
      error: 'destructive',
      degraded: 'destructive',
      info: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const renderCheckCard = (title: string, icon: any, data: HealthResult | null) => {
    if (!data) return null;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle>{title}</CardTitle>
            </div>
            {getStatusBadge(data.status)}
          </div>
          <CardDescription>
            Ostatnie sprawdzenie: {new Date(data.timestamp).toLocaleString('pl-PL')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.error && (
            <Alert variant="destructive">
              <AlertDescription>{data.error}</AlertDescription>
            </Alert>
          )}

          {Object.entries(data.checks).map(([key, check]) => (
            <div key={key} className="flex items-start justify-between p-3 border rounded-lg">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <div className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  {check.message && (
                    <div className="text-sm text-muted-foreground mt-1">{check.message}</div>
                  )}
                  {check.count !== undefined && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Count: {check.count}
                    </div>
                  )}
                  {check.details && (
                    <pre className="text-xs mt-2 p-2 bg-muted rounded">
                      {JSON.stringify(check.details, null, 2)}
                    </pre>
                  )}
                  {check.impact && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-xs">{check.impact}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
              {getStatusBadge(check.status)}
            </div>
          ))}

          {data.performance && (
            <div className="p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Response Time</span>
                <Badge variant={data.performance.status === 'ok' ? 'default' : 'secondary'}>
                  {data.performance.responseTime}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Monitor</h1>
          <p className="text-muted-foreground">
            Status wszystkich kluczowych systemów w czasie rzeczywistym
          </p>
        </div>
        <Button onClick={runHealthChecks} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </Button>
      </div>

      {lastCheck && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            Ostatnie sprawdzenie: {lastCheck.toLocaleString('pl-PL')} · Auto-refresh co 30s
          </AlertDescription>
        </Alert>
      )}

      {/* Overall Status */}
      {(generalHealth || voteHealth) && (
        <Card>
          <CardHeader>
            <CardTitle>Status Ogólny</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generalHealth && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    <span className="font-medium">Systemy Ogólne</span>
                  </div>
                  {getStatusBadge(generalHealth.status)}
                </div>
              )}
              {voteHealth && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Vote className="h-5 w-5" />
                    <span className="font-medium">System Głosowania</span>
                  </div>
                  {getStatusBadge(voteHealth.status)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Checks */}
      <div className="grid grid-cols-1 gap-6">
        {renderCheckCard(
          'Systemy Ogólne',
          <Database className="h-5 w-5" />,
          generalHealth
        )}
        {renderCheckCard(
          'System Głosowania',
          <Vote className="h-5 w-5" />,
          voteHealth
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Szybkie Akcje</CardTitle>
          <CardDescription>Testy i diagnostyka</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => window.open('/api/health', '_blank')}
          >
            <Zap className="mr-2 h-4 w-4" />
            Zobacz surowe dane - /api/health
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => window.open('/api/health?detailed=true', '_blank')}
          >
            <Activity className="mr-2 h-4 w-4" />
            Zobacz szczegółowe dane - /api/health?detailed=true
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => window.open('/api/health/vote', '_blank')}
          >
            <Vote className="mr-2 h-4 w-4" />
            Test systemu głosowania - /api/health/vote
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(SystemHealthPage, { requireAdmin: true });
