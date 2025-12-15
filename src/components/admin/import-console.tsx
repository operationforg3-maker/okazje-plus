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

  return (
    <Card className="card-base">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Konsola importu</CardTitle>
            <CardDescription>Śledzenie procesu importu w czasie rzeczywistym</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="gap-1"
            >
              <Copy className="h-4 w-4" />
              Kopiuj
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Pobierz
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Wyczyść
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="font-mono text-xs bg-black/90 dark:bg-black text-green-400 p-4 rounded-lg overflow-y-auto max-h-96 space-y-0.5"
        >
          {lines.length === 0 ? (
            <div className="text-gray-500">Czekanie na komunikaty...</div>
          ) : (
            lines.map(line => (
              <div key={line.id} className="flex items-start gap-3 hover:bg-white/5 px-2 py-0.5 rounded transition-colors">
                <Badge variant="secondary" className={`${typeBadges[line.type]} flex-shrink-0 text-xs`}>
                  {line.type.toUpperCase()}
                </Badge>
                <span className="text-gray-400 text-xs flex-shrink-0 min-w-24">{line.timestamp}</span>
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
