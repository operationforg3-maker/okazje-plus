"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { auth } from "@/lib/firebase";

export default function ProductsImportPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [batchSize, setBatchSize] = useState(500);
  const [upsert, setUpsert] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    return await user.getIdToken();
  };

  // Walidacja pól produktu – nie kasujemy obiektów LocalizedText
  function validateProducts(products: any[]): any[] {
    return products.map((p, idx) => {
      const validated: any = { ...p };
      // Jeśli description/longDescription/seoDescription to obiekt (LocalizedText), zachowaj; jeśli pusty – ustaw domyślny string
      if (validated.description === undefined || validated.description === null) validated.description = '';
      if (validated.longDescription === undefined || validated.longDescription === null) validated.longDescription = '';
      if (validated.seoDescription === undefined || validated.seoDescription === null) validated.seoDescription = '';
      return validated;
    });
  }

  const dryRun = async () => {
    try {
      const token = await getAuthToken();
      let parsed = JSON.parse(jsonInput || "[]");
      parsed = Array.isArray(parsed) ? validateProducts(parsed) : [];
      const payload = { products: parsed, upsert, dedupe, batchSize, dryRun: true };
      const res = await fetch("/api/admin-import/products", {
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
      let parsed = JSON.parse(jsonInput || "[]");
      parsed = Array.isArray(parsed) ? validateProducts(parsed) : [];
      const payload = { products: parsed, upsert, dedupe, batchSize, dryRun: false };
      const res = await fetch("/api/admin-import/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
      <h1 className="font-headline text-2xl font-bold">Import produktów</h1>
      <Card>
        <CardHeader>
          <CardTitle>Parametry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="Wklej JSON produktów" value={jsonInput} onChange={e=>setJsonInput(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input type="number" value={batchSize} onChange={e=>setBatchSize(parseInt(e.target.value||"500"))} placeholder="Batch size" />
            <label className="flex items-center gap-2"><Checkbox checked={upsert} onCheckedChange={(v)=>setUpsert(!!v)} /> Upsert</label>
            <label className="flex items-center gap-2"><Checkbox checked={dedupe} onCheckedChange={(v)=>setDedupe(!!v)} /> Deduplikacja</label>
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
