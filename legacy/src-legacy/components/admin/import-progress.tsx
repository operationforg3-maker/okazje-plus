'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  Play,
  Square,
  Download,
  RefreshCw,
  Clock,
  Package,
  Sparkles,
  Database,
  Filter,
  Globe,
  BookCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImportStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface ImportStats {
  fetched?: number;
  deduped?: number;
  enriched?: number;
  translated?: number;
  saved?: number;
  errors?: number;
  total?: number;
  current?: number;
  percent?: number;
}

export interface ImportLog {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface ImportProgressProps {
  status: ImportStatus;
  progress?: {
    current: number;
    total: number;
    percent: number;
  };
  stats?: ImportStats;
  logs?: ImportLog[];
  jobId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  systemType?: 'setup' | 'bulk' | 'batch';
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRollback?: () => void;
  onExport?: () => void;
  className?: string;
}

export function ImportProgress({
  status,
  progress,
  stats,
  logs = [],
  jobId,
  startedAt,
  completedAt,
  error,
  systemType = 'bulk',
  onPause,
  onResume,
  onCancel,
  onRollback,
  onExport,
  className
}: ImportProgressProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'paused':
        return <Pause className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<ImportStatus, { label: string; className: string }> = {
      idle: { label: 'Bezczynny', className: 'bg-gray-500' },
      running: { label: 'W toku', className: 'bg-blue-600' },
      paused: { label: 'Wstrzymany', className: 'bg-yellow-600' },
      completed: { label: 'Zakończony', className: 'bg-green-600' },
      failed: { label: 'Błąd', className: 'bg-red-600' }
    };
    const { label, className: badgeClass } = variants[status];
    return <Badge className={badgeClass}>{label}</Badge>;
  };

  const getLogIcon = (level: ImportLog['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Package className="h-4 w-4 text-blue-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  const formatDuration = (start: string, end?: string) => {
    try {
      const startTime = new Date(start).getTime();
      const endTime = end ? new Date(end).getTime() : Date.now();
      const durationMs = endTime - startTime;
      const seconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    } catch {
      return 'N/A';
    }
  };

  // Pipeline stage icons based on systemType
  const pipelineStages = systemType === 'setup' 
    ? [
        { key: 'fetched', icon: Database, label: 'Fetched', color: 'text-blue-500' },
        { key: 'saved', icon: BookCheck, label: 'Saved', color: 'text-green-500' }
      ]
    : [
        { key: 'fetched', icon: Database, label: 'Fetched', color: 'text-blue-500' },
        { key: 'deduped', icon: Filter, label: 'Deduped', color: 'text-purple-500' },
        { key: 'enriched', icon: Sparkles, label: 'Enriched', color: 'text-orange-500' },
        { key: 'translated', icon: Globe, label: 'Translated', color: 'text-cyan-500' },
        { key: 'saved', icon: BookCheck, label: 'Saved', color: 'text-green-500' }
      ];

  return (
    <Card className={cn('border-2', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="flex items-center gap-2">
                Status importu
                {getStatusBadge()}
              </CardTitle>
              {jobId && (
                <CardDescription className="font-mono text-xs">
                  Job ID: {jobId}
                </CardDescription>
              )}
            </div>
          </div>
          {startedAt && (
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Czas: {formatDuration(startedAt, completedAt)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Postęp</span>
              <span className="text-muted-foreground">
                {progress.current} / {progress.total}
              </span>
            </div>
            <Progress value={progress.percent} className="h-2" />
            <div className="text-right text-xs text-muted-foreground">
              {Math.round(progress.percent)}%
            </div>
          </div>
        )}

        {/* Pipeline Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-4 border-y">
            {pipelineStages.map((stage) => {
              const StageIcon = stage.icon;
              const value = stats[stage.key as keyof ImportStats] || 0;
              return (
                <div key={stage.key} className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <StageIcon className={cn('h-5 w-5', stage.color)} />
                  </div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{stage.label}</div>
                </div>
              );
            })}
            {stats.errors !== undefined && stats.errors > 0 && (
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Błąd:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Logi operacji</h4>
              <Badge variant="outline">{logs.length} wpisów</Badge>
            </div>
            <ScrollArea className="h-64 rounded-md border p-3">
              <div className="space-y-2">
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-2 text-sm p-2 rounded',
                      log.level === 'error' && 'bg-red-50 dark:bg-red-950/20',
                      log.level === 'warning' && 'bg-yellow-50 dark:bg-yellow-950/20',
                      log.level === 'success' && 'bg-green-50 dark:bg-green-950/20'
                    )}
                  >
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className="font-medium">{log.message}</span>
                      </div>
                      {log.details && (
                        <div className="text-xs text-muted-foreground mt-1 ml-5">
                          {log.details}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {status === 'running' && onPause && (
            <Button variant="outline" size="sm" onClick={onPause}>
              <Pause className="h-4 w-4 mr-2" />
              Wstrzymaj
            </Button>
          )}
          {status === 'paused' && onResume && (
            <Button variant="outline" size="sm" onClick={onResume}>
              <Play className="h-4 w-4 mr-2" />
              Wznów
            </Button>
          )}
          {(status === 'running' || status === 'paused') && onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <Square className="h-4 w-4 mr-2" />
              Anuluj
            </Button>
          )}
          {status === 'completed' && onRollback && (
            <Button variant="outline" size="sm" onClick={onRollback}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rollback
            </Button>
          )}
          {(status === 'completed' || status === 'failed') && onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Eksportuj raport
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
