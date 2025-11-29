"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export default function CategoriesImportPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const dryRun = async () => {
    setDryRunResult({ added: 0, updated: 0, skipped: 0, preview: [] });
  };

  const runImport = async () => {
    // TODO: wywołać server action do importu kategorii z merge bez duplikacji
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold">Import kategorii</h1>
      <Card>
        <CardHeader>
          <CardTitle>Źródło danych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="Wklej JSON drzewa kategorii" value={jsonInput} onChange={e=>setJsonInput(e.target.value)} />
          <Input placeholder="Prompt AI (kopiowanie drzewa z innego sklepu)" value={sourcePrompt} onChange={e=>setSourcePrompt(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={dryRun}>Dry-run</Button>
            <Button onClick={runImport}>Importuj</Button>
          </div>
          {dryRunResult && (
            <pre className="mt-4 text-xs bg-muted p-3 rounded">{JSON.stringify(dryRunResult,null,2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
