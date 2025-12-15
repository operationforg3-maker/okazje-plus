'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ConsoleLine {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ImportConsoleProps {
  lines: ConsoleLine[];
  onClear?: () => void;
}

const typeColors: Record<ConsoleLine['type'], string> = {
  info: 'text-blue-600',
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-yellow-600',
};

const typeBadges: Record<ConsoleLine['type'], string> = {
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
};

export function ImportConsole({ lines, onClear }: ImportConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleCopy = () => {
    const text = lines.map(line => `[${line.timestamp}] [${line.type.toUpperCase()}] ${line.message}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Skopiowano do schowka');
  };

  const handleDownload = () => {
    const text = lines.map(line => `[${line.timestamp}] [${line.type.toUpperCase()}] ${line.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-log-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate stats
  const successCount = lines.filter(l => l.type === 'success').length;
  const errorCount = lines.filter(l => l.type === 'error').length;
  const warningCount = lines.filter(l => l.type === 'warning').length;
  const infoCount = lines.filter(l => l.type === 'info').length;

  return (
    <Card className="card-base h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              🖥️ Konsola Importu (v2.0)
              <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                {lines.length} linii
              </span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Live tracking • {successCount > 0 && `✅ ${successCount}`} {errorCount > 0 && `❌ ${errorCount}`} {warningCount > 0 && `⚠️ ${warningCount}`}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              title="Kopiuj wszystko do schowka"
              className="h-8 px-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              title="Pobierz log jako plik"
              className="h-8 px-2"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              title="Wyczyść konsolę"
              className="h-8 px-2"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="font-mono text-xs bg-black/95 dark:bg-black text-green-400 p-3 rounded-lg overflow-y-auto h-full space-y-0 border-t border-green-900/30"
        >
          {lines.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              <div className="text-lg mb-2">⏳</div>
              <div>Czekanie na komunikaty...</div>
              <div className="text-xs text-gray-600 mt-2">Logi będą tutaj wyświetlane na bieżąco</div>
            </div>
          ) : (
            lines.map(line => (
              <div key={line.id} className="flex items-start gap-2 hover:bg-white/5 px-2 py-0.5 rounded transition-colors group">
                <Badge variant="secondary" className={`${typeBadges[line.type]} flex-shrink-0 text-xs h-5`}>
                  {line.type.toUpperCase()}
                </Badge>
                <span className="text-gray-400 text-xs flex-shrink-0 min-w-20 font-mono group-hover:text-gray-300">{line.timestamp}</span>
                <span className={`flex-grow break-words ${typeColors[line.type]}`}>
                  {line.message}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
