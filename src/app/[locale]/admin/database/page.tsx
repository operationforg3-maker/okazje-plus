'use client';

import { useState } from 'react';
import { DatabaseCleaner } from '@/components/admin/database-cleaner';
import { FirebaseIndexManager } from '@/components/admin/firebase-index-manager';
import { LinkVerifier } from '@/components/admin/link-verifier';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Simple console for the cleaner
const ConsoleLog = ({ logs }: { logs: Array<{ msg: string, type: 'info' | 'success' | 'error' | 'warning' }> }) => (
  <div className="bg-black/90 p-4 rounded-lg font-mono text-xs text-green-400 mt-4 max-h-60 overflow-y-auto">
    {logs.length === 0 && <span className="text-gray-500">// Oczekiwanie na akcje...</span>}
    {logs.map((log, i) => (
      <div key={i} className={
        log.type === 'error' ? 'text-red-400' : 
        log.type === 'warning' ? 'text-yellow-400' : 
        log.type === 'success' ? 'text-green-400 font-bold' : 
        'text-gray-300'
      }>
        <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
        {log.msg}
      </div>
    ))}
  </div>
);

export default function DatabasePage() {
  const [logs, setLogs] = useState<Array<{ msg: string, type: 'info' | 'success' | 'error' | 'warning' }>>([]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Zarządzanie Bazą Danych</h1>
        <p className="text-muted-foreground">
          Narzędzia do czyszczenia, naprawy i konserwacji bazy danych.
        </p>
      </div>

      <Tabs defaultValue="cleaner" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cleaner">Czyszczenie (Cleaner)</TabsTrigger>
          <TabsTrigger value="indexes">Indeksy Firestore</TabsTrigger>
          <TabsTrigger value="links">Weryfikacja Linków</TabsTrigger>
        </TabsList>

        <TabsContent value="cleaner" className="space-y-4">
           <DatabaseCleaner onConsoleLog={addLog} />
           
           <Card>
             <CardHeader>
               <CardTitle>Log Operacji</CardTitle>
               <CardDescription>Historia wykonywanych działań w tej sesji</CardDescription>
             </CardHeader>
             <CardContent>
               <ConsoleLog logs={logs} />
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="indexes" className="space-y-4">
          <FirebaseIndexManager onConsoleLog={addLog} />
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <LinkVerifier onConsoleLog={addLog} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

