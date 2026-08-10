"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Upload, FileSpreadsheet, Sparkles, Tag, Percent, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AliExpressCsvImporterProps {
  authToken: string | null;
  onImportComplete?: () => void;
}

export function AliExpressCsvImporter({ authToken, onImportComplete }: AliExpressCsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    totalRows: number;
    promoCodesCount: number;
    avgDiscount: number;
    maxCommission: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    createdCount: number;
    promoCodesCount: number;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      parsePreview(text);
    };
    reader.readAsText(selectedFile);
  };

  const parsePreview = (text: string) => {
    try {
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setError("Plik CSV jest pusty lub nie posiada nagłówków.");
        setPreview(null);
        return;
      }

      const headers = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
      const hasTitle = headers.some(h => h.includes("product name") || h.includes("title"));
      const hasPrice = headers.some(h => h.includes("saleprice") || h.includes("price"));

      if (!hasTitle || !hasPrice) {
        setError("Wykryty plik CSV nie zawiera wymaganych kolumn 'Product Name' oraz 'SalePrice'.");
        setPreview(null);
        return;
      }

      let promoCount = 0;
      let totalDiscount = 0;
      let validDiscountRows = 0;
      let maxComm = 0;

      const idxPromo = headers.findIndex(h => h.includes("promocode") || h.includes("code"));
      const idxDiscount = headers.findIndex(h => h.includes("discount"));
      const idxComm1 = headers.findIndex(h => h.includes("direct linking commission"));
      const idxComm2 = headers.findIndex(h => h.includes("incentive commission"));

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (idxPromo !== -1 && line.toLowerCase().includes("code")) {
          promoCount++;
        }
        if (idxDiscount !== -1) {
          const match = line.split(",")[idxDiscount]?.match(/[\d.]+/);
          if (match) {
            totalDiscount += parseFloat(match[0]);
            validDiscountRows++;
          }
        }
        if (idxComm1 !== -1 || idxComm2 !== -1) {
          const match1 = idxComm1 !== -1 ? parseFloat(line.split(",")[idxComm1] || "0") : 0;
          const match2 = idxComm2 !== -1 ? parseFloat(line.split(",")[idxComm2] || "0") : 0;
          const comm = (isNaN(match1) ? 0 : match1) + (isNaN(match2) ? 0 : match2);
          if (comm > maxComm) maxComm = comm;
        }
      }

      setPreview({
        totalRows: lines.length - 1,
        promoCodesCount: promoCount,
        avgDiscount: validDiscountRows > 0 ? Math.round(totalDiscount / validDiscountRows) : 0,
        maxCommission: Math.round(maxComm * 10) / 10,
      });
    } catch (err: any) {
      setError(`Błąd odczytu nagłówków CSV: ${err.message}`);
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!csvContent || !authToken) {
      setError("Brak tokena autoryzacji lub nie wybrano pliku CSV.");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/import/aliexpress-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvText: csvContent,
          autoRefine: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          createdCount: data.createdCount,
          promoCodesCount: data.promoCodesCount,
          message: data.message,
        });
        if (onImportComplete) onImportComplete();
      } else {
        setError(data.error || "Wystąpił błąd podczas importu.");
      }
    } catch (err: any) {
      setError(err?.message || "Błąd połączenia z serwerem.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="border-orange-500/30 bg-gradient-to-br from-background via-orange-950/10 to-background shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Importer Okazji i Kodów Rabatowych z Pliku CSV AliExpress
                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                  Dedykowany dla AliExpress Portals
                </Badge>
              </CardTitle>
              <CardDescription>
                Wgraj wygenerowany z Portalu Afiliacyjnego AliExpress plik CSV z promocjami, kodami rabatowymi i wyższą prowizją.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload Zone */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-orange-500/30 hover:border-orange-500/60 transition-colors rounded-xl p-6 text-center cursor-pointer bg-orange-500/5 hover:bg-orange-500/10 flex flex-col items-center justify-center gap-2"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".csv" 
            className="hidden" 
          />
          <Upload className="w-8 h-8 text-orange-400 animate-bounce" />
          <p className="font-medium text-sm text-foreground">
            {file ? `Wybrano plik: ${file.name}` : "Kliknij lub przeciągnij plik CSV z promocjami AliExpress"}
          </p>
          <p className="text-xs text-muted-foreground">
            Obsługuje standardowe pliki CSV z Portalu Afiliacyjnego AliExpress (Promotions, Special Offers)
          </p>
        </div>

        {/* Errors */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Summary */}
        {preview && (
          <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-500/20 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Analiza podglądu pliku CSV:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/50">
                <span className="text-xs text-muted-foreground block">Wykryte oferty</span>
                <span className="text-lg font-bold text-foreground">{preview.totalRows}</span>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/50">
                <span className="text-xs text-muted-foreground block">Kody rabatowe (PromoCode)</span>
                <span className="text-lg font-bold text-orange-400 flex items-center gap-1">
                  <Tag className="w-4 h-4 inline" /> {preview.promoCodesCount}
                </span>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/50">
                <span className="text-xs text-muted-foreground block">Średni rabat</span>
                <span className="text-lg font-bold text-green-400 flex items-center gap-1">
                  <Percent className="w-4 h-4 inline" /> {preview.avgDiscount}%
                </span>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/50">
                <span className="text-xs text-muted-foreground block">Maks. Prowizja</span>
                <span className="text-lg font-bold text-emerald-400">{preview.maxCommission}%</span>
              </div>
            </div>

            <Button 
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium shadow-md transition-all mt-2"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Importowanie i wyciąganie kodów rabatowych...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Zaimportuj {preview.totalRows} okazji do bazy (Draft)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>{result.message}</span>
            </div>
            <p className="text-xs text-green-300/80">
              Okazje zostały zapisane w stanie <strong>Draft</strong> z przypisanymi kodami rabatowymi. Możesz je teraz zweryfikować lub uruchomić AI Refiner.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
