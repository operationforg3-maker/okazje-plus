"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";

export default function CategoriesImportPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    return await user.getIdToken();
  };

  const dryRun = async () => {
    try {
      const token = await getAuthToken();
      const parsed = JSON.parse(jsonInput || "[]");
      const payload = { categories: parsed, dryRun: true };
      const res = await fetch("/api/admin-import/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ mode: "dry-run", payload }),
      });
      const data = await res.json();
      setDryRunResult(data);
    } catch (e: any) {
      setDryRunResult({ ok: false, error: e?.message || "Parse error" });
    }
  };

  const runImport = async () => {
    try {
      const token = await getAuthToken();
      const parsed = JSON.parse(jsonInput || "[]");
      const payload = { categories: parsed, dryRun: false };
      const res = await fetch("/api/admin-import/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ mode: "run", payload, prompt: sourcePrompt }),
      });
      const data = await res.json();
      setDryRunResult(data);
    } catch (e: any) {
      setDryRunResult({ ok: false, error: e?.message || "Parse error" });
    }
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
