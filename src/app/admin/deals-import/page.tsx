"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export default function DealsImportPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [batchSize, setBatchSize] = useState(500);
  const [autoApprove, setAutoApprove] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const dryRun = async () => {
    try {
      const parsed = JSON.parse(jsonInput || "[]");
      const payload = { deals: parsed, batchSize, autoApprove, dryRun: true };
      const res = await fetch("/api/admin-import/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const parsed = JSON.parse(jsonInput || "[]");
      const payload = { deals: parsed, batchSize, autoApprove, dryRun: false };
      const res = await fetch("/api/admin-import/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "run", payload }),
      });
      const data = await res.json();
      setDryRunResult(data);
    } catch (e: any) {
      setDryRunResult({ ok: false, error: e?.message || "Parse error" });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold">Import okazji</h1>
      <Card>
        <CardHeader>
          <CardTitle>Parametry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="Wklej JSON okazji" value={jsonInput} onChange={e=>setJsonInput(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input type="number" value={batchSize} onChange={e=>setBatchSize(parseInt(e.target.value||"500"))} placeholder="Batch size" />
            <label className="flex items-center gap-2"><Checkbox checked={autoApprove} onCheckedChange={(v)=>setAutoApprove(!!v)} /> Auto-approve</label>
          </div>
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
