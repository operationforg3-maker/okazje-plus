"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Link2, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  ExternalLink, 
  Tag, 
  DollarSign, 
  Store,
  Layers
} from "lucide-react";

interface UrlImporterProps {
  authToken: string | null;
  onImportComplete?: () => void;
}

export function UrlImporter({ authToken, onImportComplete }: UrlImporterProps) {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Scraped / Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [image, setImage] = useState("");
  const [merchant, setMerchant] = useState("");
  const [shippingCost, setShippingCost] = useState("0");
  const [promoCode, setPromoCode] = useState("");
  const [targetStatus, setTargetStatus] = useState<"approved" | "draft">("approved");
  const [autoRefine, setAutoRefine] = useState(true);
  const [hasScrapedData, setHasScrapedData] = useState(false);

  const handleFetchUrl = async () => {
    if (!url.trim()) {
      setError("Wklej adres URL oferty.");
      return;
    }

    setFetching(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/deals/scrape?url=${encodeURIComponent(url.trim())}`);
      if (!res.ok) {
        throw new Error(`Błąd pobierania danych (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.price) setPrice(String(data.price));
      if (data.originalPrice) setOriginalPrice(String(data.originalPrice));
      if (data.image) setImage(data.image);
      if (data.merchant) setMerchant(data.merchant);
      if (data.shippingCost !== undefined) setShippingCost(String(data.shippingCost));
      
      setHasScrapedData(true);
    } catch (err: any) {
      setError(err?.message || "Nie udało się automatycznie pobrać szczegółów ze wskazanego adresu URL. Możesz uzupełnić dane ręcznie.");
      setHasScrapedData(true);
    } finally {
      setFetching(false);
    }
  };

  const handleSaveDeal = async () => {
    if (!authToken) {
      setError("Brak aktywnej sesji administratora.");
      return;
    }

    if (!title.trim() || !price.trim() || parseFloat(price) <= 0) {
      setError("Tytuł oraz cena produktu (większa od zera) są wymagane.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/admin/import/url", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim(),
          description: description.trim(),
          price: parseFloat(price.replace(",", ".")),
          originalPrice: originalPrice ? parseFloat(originalPrice.replace(",", ".")) : undefined,
          image: image.trim(),
          merchant: merchant.trim(),
          shippingCost: parseFloat(shippingCost.replace(",", ".")) || 0,
          promoCode: promoCode.trim() || undefined,
          targetStatus,
          autoRefine,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Wystąpił błąd podczas zapisywania okazji.");
      }

      setSuccessMessage(data.message || "Okazja została pomyślnie zaimportowana!");
      // Reset form
      setUrl("");
      setTitle("");
      setDescription("");
      setPrice("");
      setOriginalPrice("");
      setImage("");
      setMerchant("");
      setPromoCode("");
      setHasScrapedData(false);

      if (onImportComplete) onImportComplete();
    } catch (err: any) {
      setError(err?.message || "Błąd podczas zapisu okazji.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-indigo-500/30 bg-gradient-to-br from-background via-indigo-950/10 to-background shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Szybki Import Okazji z Adresu URL
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  AliExpress, Allegro, Sklepy PL & Afiliacja
                </Badge>
              </CardTitle>
              <CardDescription>
                Wklej dowolny link do produktu (np. AliExpress, TradeTracker, Convertiser lub link partnerski), a automat pobierze tytuł, cenę, zdjęcie i wygeneruje link afiliacyjny.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* URL Input Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Input
              type="url"
              placeholder="Wklej adres URL okazji (np. https://pl.aliexpress.com/item/... lub link partnerski)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
              className="pr-10 bg-background"
            />
            {url && (
              <a
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noreferrer"
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                title="Otwórz link w nowej karcie"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <Button
            onClick={handleFetchUrl}
            disabled={fetching || !url.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
          >
            {fetching ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Pobieranie danych...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Pobierz dane z URL
              </>
            )}
          </Button>
        </div>

        {/* Errors & Alerts */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {successMessage && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Scraped Details Form & Live Preview */}
        {hasScrapedData && (
          <div className="space-y-4 pt-3 border-t border-border/60">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Image Preview & Details */}
              <div className="space-y-3">
                <div className="aspect-square rounded-xl border border-border bg-muted/40 overflow-hidden flex items-center justify-center relative group">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={title || "Podgląd"}
                      className="w-full h-full object-contain p-2"
                      onError={() => setError("Nie udało się załadować podglądu zdjęcia.")}
                    />
                  ) : (
                    <div className="text-muted-foreground text-xs text-center p-4">
                      Brak zdjęcia produktu
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">URL Zdjęcia:</label>
                  <Input
                    type="url"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://..."
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Form Fields */}
              <div className="md:col-span-2 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tytuł okazji (PL):</label>
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Wpisz tytuł okazji..."
                    className="font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-green-500" /> Cena promocyjna (PLN):
                    </label>
                    <Input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="np. 99.99"
                      className="font-semibold text-green-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Cena regularna (PLN):</label>
                    <Input
                      type="text"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      placeholder="np. 149.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Wysyłka (PLN):</label>
                    <Input
                      type="text"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="0 dla darmowej"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-orange-400" /> Kod rabatowy:
                    </label>
                    <Input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="np. RABAT10"
                      className="uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-blue-400" /> Sklep / Merchant:
                    </label>
                    <Input
                      type="text"
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      placeholder="np. AliExpress, Media Expert"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Status publikacji:</label>
                    <div className="flex items-center gap-4 h-10 px-3 border rounded-md bg-background text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="urlTargetStatus"
                          value="approved"
                          checked={targetStatus === "approved"}
                          onChange={() => setTargetStatus("approved")}
                          className="accent-indigo-500"
                        />
                        <span>Live (Approved)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="urlTargetStatus"
                          value="draft"
                          checked={targetStatus === "draft"}
                          onChange={() => setTargetStatus("draft")}
                          className="accent-indigo-500"
                        />
                        <span>Szkic (Draft)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Opis / Szczegóły:</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Opis produktu..."
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoRefine}
                      onChange={(e) => setAutoRefine(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <span>Uruchom AI Deal Refiner w tle (ulepszenie tytułu i kategoryzacja)</span>
                  </label>

                  <Button
                    onClick={handleSaveDeal}
                    disabled={saving || !title.trim() || !price.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium shadow-md"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Zapisywanie...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" /> Dodaj i opublikuj okazję
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
