"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function ImportTestPage() {
  const [keyword, setKeyword] = useState("smartphone");
  const [maxProducts, setMaxProducts] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      console.log(`[UI] Testing import with keyword: "${keyword}"`);
      
      const response = await fetch("/api/admin/import/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyword, maxProducts: Number(maxProducts) }),
      });

      const data = await response.json();
      console.log(`[UI] Response:`, data);

      if (!response.ok) {
        setError(data.error || `Error: ${response.status}`);
      } else {
        setResult(data);
      }
    } catch (e: any) {
      console.error("[UI] Error:", e.message);
      setError(e.message || "Failed to run test");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🧪 Import Test</h1>
        <p className="text-gray-500 mt-1">Debug import pipeline - test fetch & save</p>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>❌ {error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Test Parameters</CardTitle>
          <CardDescription>Simple keyword test</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Keyword</label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. smartphone"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Max Products</label>
            <Input
              type="number"
              value={maxProducts}
              onChange={(e) => setMaxProducts(Number(e.target.value))}
              min={1}
              max={20}
            />
          </div>
          <Button onClick={runTest} disabled={loading} size="lg" className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Run Test
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.success ? "✅ Success" : "⚠️ Partial"}
            </CardTitle>
            <CardDescription>
              Fetched: {result.summary.fetched} | Saved: {result.summary.saved} | Errors: {result.summary.failed}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.fetched && result.fetched.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Fetched Products ({result.fetched.length})</h3>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {result.fetched.map((p: any) => (
                    <div key={p.id} className="p-2 border rounded text-sm">
                      <div className="font-medium truncate">{p.title?.slice(0, 60)}</div>
                      <div className="text-gray-500 text-xs">
                        ID: {p.id} | Price: ${p.price} | Rating: {p.rating}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.saved && result.saved.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Saved to Firestore ({result.saved.length})</h3>
                <div className="space-y-1 text-sm">
                  {result.saved.map((id: string) => (
                    <div key={id} className="text-green-600">
                      ✅ {id}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-red-600">Errors ({result.errors.length})</h3>
                <div className="space-y-1 text-sm">
                  {result.errors.map((err: string, idx: number) => (
                    <div key={idx} className="text-red-500">
                      ❌ {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
