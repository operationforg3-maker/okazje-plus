import AiCommandConsoleWrapper from './_components/console-wrapper';
import AiHistory from './_components/history';

export default function AiPanelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🤖 AI Tools - Panel Zarządzania</h1>
        <p className="text-muted-foreground mt-2">
          Automatyczne zarządzanie katalogiem, importy i narzędzia AI do optymalizacji treści
        </p>
      </div>
      
      <AiCommandConsoleWrapper />
      
      <AiHistory />
    </div>
  );
}
