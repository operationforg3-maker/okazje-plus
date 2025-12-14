import { requireAdmin } from '@/lib/auth-server';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import React from 'react';

export const dynamic = 'force-dynamic';

async function runEndpoint(path: string): Promise<{ ok: boolean; data: any; error?: string }> {
  try {
    const res = await fetch(path, { method: 'GET', cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, data, error: res.ok ? undefined : data?.error || 'Unknown error' };
  } catch (e: any) {
    return { ok: false, data: null, error: e?.message || String(e) };
  }
}

export default async function AdminTestsPage({ params }: { params: { locale: string } }) {
  await requireAdmin();
  const t = await getTranslations({ locale: params.locale, namespace: 'admin' });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Testy administracyjne</h1>
      <p className="text-sm text-muted-foreground">Uruchamiaj testy i podglądaj wynik w konsoli poniżej.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TestCard
          title="Test zapisu do Firestore"
          description="Tworzy dokument w kolekcji products i zwraca ID."
          run={async () => runEndpoint('/api/admin/test-firestore-write')}
        />
        <TestCard
          title="Auto-import AI (dry run)"
          description="Uruchamia auto-import bez zapisu, do weryfikacji pipeline'u."
          run={async () => runEndpoint('/api/admin/ai/auto-import?dryRun=true')}
        />
        <TestCard
          title="Procesuj kolejkę importów"
          description="Wymusza przetworzenie zadań importu (cron)."
          run={async () => runEndpoint('/api/cron/process-jobs')}
        />
        <TestCard
          title="Health (szczegółowy)"
          description="Szczegółowe sprawdzenie integracji i uprawnień."
          run={async () => runEndpoint('/api/health?detailed=true')}
        />
      </div>

      <div className="text-sm mt-6">
        <p>
          Więcej narzędzi: <Link href="/admin/imports/aliexpress" className="underline">Panel importu AliExpress</Link>
        </p>
      </div>
    </div>
  );
}

function TestCard({ title, description, run }: { title: string; description: string; run: () => Promise<{ ok: boolean; data: any; error?: string }> }) {
  const [ClientCard, setClientCard] = React.useState<React.ReactNode>(null);
  React.useEffect(() => {
    setClientCard(<ClientTestCard title={title} description={description} run={run} />);
  }, [title, description, run]);
  return <>{ClientCard}</>;
}

function ClientTestCard({ title, description, run }: { title: string; description: string; run: () => Promise<{ ok: boolean; data: any; error?: string }> }) {
  const [loading, setLoading] = React.useState(false);
  const [output, setOutput] = React.useState<string>('');

  async function onRun() {
    setLoading(true);
    setOutput('');
    const startedAt = new Date().toISOString();
    try {
      const result = await run();
      const finishedAt = new Date().toISOString();
      const pretty = JSON.stringify(result.data, null, 2);
      setOutput(`[${startedAt} → ${finishedAt}]\nOK=${result.ok}${result.error ? `\nERROR=${result.error}` : ''}\n\n${pretty}`);
    } catch (e: any) {
      const finishedAt = new Date().toISOString();
      setOutput(`[${startedAt} → ${finishedAt}]\nOK=false\nERROR=${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-md p-4 space-y-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onRun} disabled={loading} className="px-3 py-1 rounded bg-primary text-primary-foreground">
          {loading ? 'Uruchamianie…' : 'Uruchom test'}
        </button>
      </div>
      <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">
        {output || '— brak wyników —'}
      </pre>
    </div>
  );
}
