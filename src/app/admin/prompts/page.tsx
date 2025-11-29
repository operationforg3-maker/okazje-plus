"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PromptConfig = {
  id: string;
  target: "categories" | "products" | "deals" | "translations";
  name: string;
  prompt: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<"categories" | "products" | "deals" | "translations">("products");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const res = await fetch("/api/admin-import/prompts");
      const data = await res.json();
      if (data.ok) setPrompts(data.prompts || []);
    } catch (e) {
      console.error("Failed to load prompts", e);
    }
  };

  const savePrompt = async () => {
    if (!name || !prompt) return;
    try {
      const payload = { id: editingId, target: selectedTarget, name, prompt };
      const res = await fetch("/api/admin-import/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        loadPrompts();
        setName("");
        setPrompt("");
        setEditingId(null);
      }
    } catch (e) {
      console.error("Failed to save prompt", e);
    }
  };

  const editPrompt = (p: PromptConfig) => {
    setEditingId(p.id);
    setSelectedTarget(p.target);
    setName(p.name);
    setPrompt(p.prompt);
  };

  const deletePrompt = async (id: string) => {
    try {
      const res = await fetch(`/api/admin-import/prompts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) loadPrompts();
    } catch (e) {
      console.error("Failed to delete prompt", e);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold">Zarządzanie promptami AI</h1>
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edytuj prompt" : "Nowy prompt"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={selectedTarget} onValueChange={(v: any) => setSelectedTarget(v)}>
              <SelectTrigger><SelectValue placeholder="Target" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="categories">Kategorie</SelectItem>
                <SelectItem value="products">Produkty</SelectItem>
                <SelectItem value="deals">Okazje</SelectItem>
                <SelectItem value="translations">Tłumaczenia</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Nazwa" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <Textarea placeholder="Prompt (instrukcje dla AI)" rows={6} value={prompt} onChange={e => setPrompt(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={savePrompt}>{editingId ? "Zapisz zmiany" : "Dodaj"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setName(""); setPrompt(""); }}>Anuluj</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zapisane prompty</CardTitle>
        </CardHeader>
        <CardContent>
          {prompts.length === 0 && <p className="text-muted-foreground text-sm">Brak zapisanych promptów</p>}
          <div className="space-y-3">
            {prompts.map(p => (
              <div key={p.id} className="border rounded p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Target: {p.target}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => editPrompt(p)}>Edytuj</Button>
                    <Button size="sm" variant="destructive" onClick={() => deletePrompt(p.id)}>Usuń</Button>
                  </div>
                </div>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{p.prompt}</pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
