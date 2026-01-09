"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { auth } from "@/lib/firebase";

export default function TranslationsPage() {
  const [scope, setScope] = useState<"product"|"deal">("product");
  const [mode, setMode] = useState<"full"|"short"|"specs">("full");
  const [prompt, setPrompt] = useState("");
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    return await user.getIdToken();
  };

  const dryRun = async () => {
    try {
      const token = await getAuthToken();
      const payload = { scope, mode, prompt, dryRun: true };
      const res = await fetch("/api/admin-import/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ mode: "dry-run", payload }),
      });
      const data = await res.json();
      setDryRunResult(data);
    } catch (e: any) {
      setDryRunResult({ ok: false, error: e?.message || "Error" });
    }
  };

  const runTranslate = async () => {
    try {
      const token = await getAuthToken();
      const payload = { scope, mode, prompt, dryRun: false };
      const res = await fetch("/api/admin-import/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ mode: "run", payload }),
      });
      const data = await res.json();
      setDryRunResult(data);
    } catch (e: any) {
      setDryRunResult({ ok: false, error: e?.message || "Error" });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold">Tłumaczenia (AI)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Zakres i prompt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {/* Placeholder prosty select */}
            <button className="px-3 py-2 border rounded" onClick={()=>setScope(scope==="product"?"deal":"product")}>Zakres: {scope}</button>
            <button className="px-3 py-2 border rounded" onClick={()=>setMode(mode==="full"?"short":"specs")}>Tryb: {mode}</button>
          </div>
          <Textarea placeholder="Prompt tłumaczeń" value={prompt} onChange={e=>setPrompt(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={dryRun}>Dry-run</Button>
            <Button onClick={runTranslate}>Tłumacz</Button>
          </div>
          {dryRunResult && (
            <pre className="mt-4 text-xs bg-muted p-3 rounded">{JSON.stringify(dryRunResult,null,2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
