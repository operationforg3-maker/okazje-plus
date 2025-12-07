'use client';

/**
 * Job Monitor Widget - Reusable Component
 * 
 * Real-time monitoring of background jobs with live console logs.
 * Uses Firebase onSnapshot for instant updates without polling.
 * 
 * Features:
 * - Live job status tracking
 * - Scrollable console log viewer
 * - Start/Stop controls
 * - Progress indicators
 * - Statistics display
 */

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, StopCircle, Loader2, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface JobMonitorWidgetProps {
  jobType: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  onStart?: () => Promise<void>;
  onStop?: (jobId: string) => Promise<void>;
  maxLogs?: number;
}

interface Job {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  payload: any;
  result?: any;
  error?: {
    message: string;
    code?: string;
  };
  attempts: number;
  maxAttempts: number;
  createdAt: number | Timestamp;
  startedAt?: number | Timestamp;
  completedAt?: number | Timestamp;
  invokedBy: string;
  metadata?: {
    logs?: Array<{
      timestamp: number;
      level: 'info' | 'warn' | 'error' | 'success';
      message: string;
    }>;
    progress?: {
      current: number;
      total: number;
      percentage: number;
    };
    stats?: Record<string, number>;
  };
}

export default function JobMonitorWidget({
  jobType,
  title,
  description,
  icon,
  onStart,
  onStop,
  maxLogs = 50,
}: JobMonitorWidgetProps) {
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeJob?.metadata?.logs, autoScroll]);

  // Real-time listener for active jobs of this type
  useEffect(() => {
    const jobsRef = collection(db, 'jobs');
    const q = query(
      jobsRef,
      where('type', '==', jobType),
      where('status', 'in', ['pending', 'processing']),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const jobDoc = snapshot.docs[0];
          const jobData = jobDoc.data() as Omit<Job, 'id'>;
          setActiveJob({
            id: jobDoc.id,
            ...jobData,
          });
        } else {
          // No active job - check if we should clear UI
          setActiveJob((prev) => {
            if (prev && (prev.status === 'processing' || prev.status === 'pending')) {
              // Job might have completed - keep it visible for a moment
              setTimeout(() => setActiveJob(null), 3000);
              return prev;
            }
            return null;
          });
        }
      },
      (error) => {
        console.error('[JobMonitor] Firestore listener error:', error);
        toast.error('Connection error - refreshing...');
      }
    );

    return () => unsubscribe();
  }, [jobType]); // Only depend on jobType, not activeJob

  const handleStart = async () => {
    if (!onStart) {
      toast.error('Start action not configured');
      return;
    }

    setIsLoading(true);
    try {
      await onStart();
      toast.success(`${title} started`);
    } catch (error: any) {
      console.error('[JobMonitor] Start error:', error);
      toast.error(error.message || 'Failed to start job');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!onStop || !activeJob) {
      toast.error('Stop action not available');
      return;
    }

    setIsLoading(true);
    try {
      await onStop(activeJob.id);
      toast.success(`${title} stopped`);
    } catch (error: any) {
      console.error('[JobMonitor] Stop error:', error);
      toast.error(error.message || 'Failed to stop job');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'processing':
        return 'bg-blue-500 animate-pulse';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'paused':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const logs = activeJob?.metadata?.logs?.slice(-maxLogs) || [];
  const progress = activeJob?.metadata?.progress;
  const stats = activeJob?.metadata?.stats;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="text-primary">{icon}</div>}
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="text-xs mt-1">{description}</CardDescription>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeJob && (
              <Badge variant="outline" className={cn('gap-1', getStatusColor(activeJob.status))}>
                {getStatusIcon(activeJob.status)}
                {activeJob.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {progress && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress.current} / {progress.total} ({progress.percentage}%)</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            onClick={handleStart}
            disabled={isLoading || (activeJob?.status === 'processing')}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start
          </Button>

          {activeJob && activeJob.status === 'processing' && onStop && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
              disabled={isLoading}
              className="flex-1"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        {/* Stats Grid */}
        {stats && Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="bg-muted rounded p-2">
                <div className="text-xs text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}
                </div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Console Logs */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Console</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAutoScroll(!autoScroll)}
              className="h-6 text-xs"
            >
              {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
            </Button>
          </div>

          <ScrollArea className="flex-1 border rounded-md bg-black/5 dark:bg-black/20">
            <div className="p-3 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-muted-foreground italic">Waiting for logs...</div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex gap-2 items-start',
                      log.level === 'error' && 'text-red-500',
                      log.level === 'warn' && 'text-yellow-500',
                      log.level === 'success' && 'text-green-500',
                      log.level === 'info' && 'text-muted-foreground'
                    )}
                  >
                    <span className="text-muted-foreground/50 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="flex-1 break-all">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Job Info Footer */}
        {activeJob && (
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <div>Job ID: {activeJob.id}</div>
            {activeJob.startedAt && (
              <div>
                Started: {new Date(
                  typeof activeJob.startedAt === 'number'
                    ? activeJob.startedAt
                    : activeJob.startedAt.toMillis()
                ).toLocaleTimeString()}
              </div>
            )}
            {activeJob.error && (
              <div className="text-red-500">Error: {activeJob.error.message}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
