'use client';

/**
 * AI-Driven Operations Center
 * 
 * Unified dashboard for managing automated background operations.
 * Features natural language command interface powered by Vertex AI.
 * 
 * Capabilities:
 * - Product Ingestion (AliExpress → Firestore)
 * - SEO & Content Quality Audits
 * - Affiliate Link Validation
 * - System Maintenance (Typesense sync, data healing)
 * 
 * Architecture:
 * - Natural language → Vertex AI parsing → JobQueue
 * - Real-time monitoring via Firestore listeners
 * - Worker execution via /api/cron/process-jobs
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import JobMonitorWidget from '@/components/admin/job-monitor-widget';
import {
  Package,
  FileSearch,
  Link2,
  Activity,
  Sparkles,
  Terminal,
  RefreshCw,
  Database,
  Zap,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  status: 'success' | 'error';
  jobId?: string;
  result?: string;
}

export default function AIFillingDashboard() {
  const { user } = useAuth();
  const [commandInput, setCommandInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [systemStats, setSystemStats] = useState<{
    lastTypesenseSync?: number;
    lastLinkCheck?: number;
    lastContentAudit?: number;
  }>({});

  // Load command history
  useEffect(() => {
    if (!user) return;

    const historyRef = collection(db, 'aiCommandHistory');
    const q = query(
      historyRef,
      where('invokedBy', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CommandHistoryEntry[];
      setCommandHistory(entries);
    });

    return () => unsubscribe();
  }, [user]);

  const executeCommand = async () => {
    if (!commandInput.trim()) {
      toast.error('Please enter a command');
      return;
    }

    setIsExecuting(true);

    try {
      const response = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: commandInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Command execution failed');
      }

      toast.success(data.message || 'Command executed successfully', {
        description: data.jobId ? `Job ID: ${data.jobId}` : undefined,
      });

      setCommandInput('');
    } catch (error: any) {
      console.error('[AICommander] Error:', error);
      toast.error(error.message || 'Failed to execute command');
    } finally {
      setIsExecuting(false);
    }
  };

  const runManualMaintenance = async (type: 'typesense_sync' | 'link_check' | 'content_audit') => {
    const commandMap = {
      typesense_sync: 'Synchronize all deals with Typesense search index',
      link_check: 'Validate all affiliate links and mark expired deals',
      content_audit: 'Run SEO and content quality audit on all deals',
    };

    setCommandInput(commandMap[type]);
    await executeCommand();
  };

  const exampleCommands = [
    'Import 20 gaming laptops from AliExpress to Electronics > Laptops',
    'Run SEO audit on all deals posted in last 7 days',
    'Validate links for deals in Electronics category',
    'Create new subcategory "Mechanical Keyboards" under Electronics',
    'Sync all deals with Typesense search index',
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Operations Center</h1>
        </div>
        <p className="text-muted-foreground">
          Automated background operations powered by Vertex AI and real-time monitoring
        </p>
      </div>

      {/* Alert for non-admin */}
      {user && user.role !== 'admin' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this dashboard. Admin role required.
          </AlertDescription>
        </Alert>
      )}

      {/* AI Commander Section */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <CardTitle>AI Commander</CardTitle>
          </div>
          <CardDescription>
            Use natural language to control system operations. Commands are parsed by Vertex AI and executed asynchronously.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Command Input */}
          <div className="space-y-2">
            <Textarea
              placeholder="Enter your command... (e.g., 'Import 10 gaming headphones')"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              disabled={isExecuting || !user || user.role !== 'admin'}
              className="min-h-[100px] font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button
                onClick={executeCommand}
                disabled={isExecuting || !commandInput.trim() || !user || user.role !== 'admin'}
                className="flex-1"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Execute Command
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Example Commands */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Example commands:</p>
            <div className="flex flex-wrap gap-2">
              {exampleCommands.map((cmd, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant="outline"
                  onClick={() => setCommandInput(cmd)}
                  disabled={isExecuting || !user || user.role !== 'admin'}
                  className="text-xs"
                >
                  {cmd}
                </Button>
              ))}
            </div>
          </div>

          {/* Command History */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Commands</p>
            <ScrollArea className="h-[150px] border rounded-md bg-muted/30">
              <div className="p-3 space-y-2">
                {commandHistory.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">No commands yet</div>
                ) : (
                  commandHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="text-sm flex items-start gap-2 p-2 rounded hover:bg-muted/50"
                    >
                      <Badge
                        variant={entry.status === 'success' ? 'default' : 'destructive'}
                        className="mt-0.5"
                      >
                        {entry.status}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-mono text-xs">{entry.command}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                          {entry.jobId && ` • Job: ${entry.jobId.slice(0, 8)}`}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Ingestion Stream */}
        <JobMonitorWidget
          jobType="import_filling"
          title="Product Ingestion Stream"
          description="AliExpress → AI Enhancement → Firestore"
          icon={<Package className="h-5 w-5" />}
          onStart={async () => {
            await fetch('/api/admin/ai/command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: 'Resume product ingestion stream',
              }),
            });
          }}
        />

        {/* Quality & SEO Guardian */}
        <JobMonitorWidget
          jobType="audit_content"
          title="Quality & SEO Guardian"
          description="Content quality and SEO optimization audits"
          icon={<FileSearch className="h-5 w-5" />}
          onStart={async () => {
            await fetch('/api/admin/ai/command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: 'Run content quality audit on recent deals',
              }),
            });
          }}
        />

        {/* Link Doctor */}
        <JobMonitorWidget
          jobType="validate_links"
          title="Link Doctor"
          description="Affiliate link validation and healing"
          icon={<Link2 className="h-5 w-5" />}
          onStart={async () => {
            await fetch('/api/admin/ai/command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: 'Check all affiliate links for validity',
              }),
            });
          }}
        />

        {/* System Pulse */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">System Pulse</CardTitle>
            </div>
            <CardDescription>Manual maintenance operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Typesense Sync */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">Typesense Sync</p>
                  {systemStats.lastTypesenseSync && (
                    <p className="text-xs text-muted-foreground">
                      Last: {new Date(systemStats.lastTypesenseSync).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => runManualMaintenance('typesense_sync')}
                disabled={!user || user.role !== 'admin'}
              >
                Sync Now
              </Button>
            </div>

            {/* Link Check */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-sm">Link Validation</p>
                  {systemStats.lastLinkCheck && (
                    <p className="text-xs text-muted-foreground">
                      Last: {new Date(systemStats.lastLinkCheck).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => runManualMaintenance('link_check')}
                disabled={!user || user.role !== 'admin'}
              >
                Check Now
              </Button>
            </div>

            {/* Content Audit */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium text-sm">Content Audit</p>
                  {systemStats.lastContentAudit && (
                    <p className="text-xs text-muted-foreground">
                      Last: {new Date(systemStats.lastContentAudit).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => runManualMaintenance('content_audit')}
                disabled={!user || user.role !== 'admin'}
              >
                Audit Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
