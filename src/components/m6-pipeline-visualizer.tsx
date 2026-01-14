"use client";
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Database,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { CurrencyManager, useCurrency } from "@/lib/unified-currency";

interface PipelineStage {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  status: "idle" | "running" | "completed" | "failed";
  progress?: number;
  stats?: Record<string, number | string | undefined>;
}

interface M6PipelineVisualizerProps {
  stages: PipelineStage[];
  autoScroll?: boolean;
}

export function M6PipelineVisualizer({
  stages,
  autoScroll = true,
}: M6PipelineVisualizerProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "border-blue-400 bg-blue-50";
      case "completed":
        return "border-green-400 bg-green-50";
      case "failed":
        return "border-red-400 bg-red-50";
      default:
        return "border-slate-300 bg-slate-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return (
          <div className="relative w-6 h-6">
            <Zap className="w-6 h-6 text-blue-600 animate-pulse" />
          </div>
        );
      case "completed":
        return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case "failed":
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Clock className="w-6 h-6 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {stages.map((stage, idx) => (
        <div key={stage.id}>
          {/* Stage Card */}
          <Card
            className={`border-2 transition-all ${getStatusColor(
              stage.status
            )}`}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(stage.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-lg">
                    {stage.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {stage.description}
                  </p>

                  {/* Progress bar (if running) */}
                  {stage.status === "running" && stage.progress !== undefined && (
                    <div className="mt-3 space-y-1">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${stage.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {stage.progress}% ukończone
                      </p>
                    </div>
                  )}

                  {/* Stats grid */}
                  {stage.stats && (
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {Object.entries(stage.stats).map(([key, value]) => (
                        <div key={key} className="bg-white rounded p-2 border">
                          <p className="text-xs text-slate-600 capitalize">
                            {key}
                          </p>
                          <p className="font-semibold text-slate-900">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Arrow to next stage */}
          {idx < stages.length - 1 && (
            <div className="flex justify-center py-2">
              <ArrowRight className="w-6 h-6 text-slate-400 transform rotate-90" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ==================== IDENTITY HASH VISUALIZER ==================== */
export function IdentityHashVisualizer({
  title,
  imageUrl,
  hash,
}: {
  title: string;
  imageUrl: string;
  hash: string;
}) {
  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-0">
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold text-slate-900">
          Identyfikacja produktu (Identity Hash)
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Image */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase">
              Image Hash
            </p>
            <div className="relative h-32 bg-white rounded-lg border overflow-hidden">
              <img
                src={imageUrl}
                alt="Product"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-slate-500 font-mono truncate">
              sha256(image)
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase">
              Title Hash
            </p>
            <div className="bg-white rounded-lg border p-3 h-32 overflow-auto">
              <p className="text-sm text-slate-800 break-words">{title}</p>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate">
              normalize({title.slice(0, 10)}...)
            </p>
          </div>
        </div>

        {/* Final hash */}
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-900 uppercase">
            Final Identity Hash (SHA-256)
          </p>
          <p className="font-mono text-sm text-blue-700 break-all">{hash}</p>
          <p className="text-xs text-blue-600">
            ↳ Używane do deduplicacji: jeden produkt = jeden hash
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ==================== DEDUPLICATION RESULT ==================== */
export function DeduplicationResult({
  found: isFound,
  existingProductId,
  action,
}: {
  found: boolean;
  existingProductId?: string;
  action: "create_product_and_deal" | "create_deal_only";
}) {
  return (
    <Card
      className={`border-2 ${
        isFound
          ? "border-amber-400 bg-amber-50"
          : "border-green-400 bg-green-50"
      }`}
    >
      <CardContent className="p-6 space-y-3">
        {isFound ? (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">
                Produkt istnieje! Nowy Merchant/Deal
              </h3>
            </div>
            <p className="text-sm text-amber-800">
              Znaleziono istniejący produkt <span className="font-mono text-xs">{existingProductId}</span>
            </p>
            <div className="bg-white rounded p-3 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 uppercase">
                Co się dzieje
              </p>
              <ol className="text-sm text-amber-800 mt-2 space-y-1 ml-4 list-decimal">
                <li>Uaktualnij linked Deals w ProductCore</li>
                <li>Utwórz nowy DealM6 dla nowego sprzedawcy</li>
                <li>Zaktualizuj bestPrice jeśli nowa cena jest niższa</li>
                <li>Pomiń tworzenie duplikatu ProductCore</li>
              </ol>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-green-900">
                Nowy produkt! Utwórz ProductCore + Deal
              </h3>
            </div>
            <p className="text-sm text-green-800">
              Ten produkt nie istnieje w bazie. Tworzę od zera.
            </p>
            <div className="bg-white rounded p-3 border border-green-200">
              <p className="text-xs font-semibold text-green-700 uppercase">
                Co się dzieje
              </p>
              <ol className="text-sm text-green-800 mt-2 space-y-1 ml-4 list-decimal">
                <li>Utwórz nowy ProductCore (status: draft)</li>
                <li>Utwórz DealM6 i powiąż z ProductCore</li>
                <li>Nagraj IdentityMatch dla przyszłych duplikatów</li>
                <li>Zaplanuj AI Refiner (wzbogacanie)</li>
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ==================== DEAL COMPARISON ==================== */
export function DealComparisonGrid({
  deals,
  highlightLowest = true,
}: {
  deals: Array<{
    id: string;
    merchantName: string;
    price: number;
    shipping: number;
    currency: string;
  }>;
  highlightLowest?: boolean;
}) {
  const { formatPrice } = useCurrency();
  const lowestPrice = Math.min(...deals.map((d) => d.price + d.shipping));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {deals.map((deal) => {
        const total = deal.price + deal.shipping;
        const isLowest = highlightLowest && total === lowestPrice;

        return (
          <Card
            key={deal.id}
            className={`border-2 transition-all ${
              isLowest
                ? "border-green-400 bg-green-50 ring-2 ring-green-200"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-600 font-semibold">
                  MERCHANT
                </p>
                <p className="font-semibold text-slate-900">
                  {deal.merchantName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-600">Cena</p>
                  <p className="font-semibold text-blue-600">
                    {formatPrice(
                      deal.currency === 'PLN'
                        ? deal.price
                        : CurrencyManager.convertToPLN(
                            deal.price,
                            deal.currency as any
                          )
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Shipping</p>
                  <p className="font-semibold text-amber-600">
                    {formatPrice(
                      deal.currency === 'PLN'
                        ? deal.shipping
                        : CurrencyManager.convertToPLN(
                            deal.shipping,
                            deal.currency as any
                          )
                    )}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-slate-600">Razem</p>
                <p className={`text-lg font-bold ${isLowest ? "text-green-600" : "text-slate-900"}`}>
                  {formatPrice(
                    deal.currency === 'PLN'
                      ? total
                      : CurrencyManager.convertToPLN(
                          total,
                          deal.currency as any
                        )
                  )}
                </p>
              </div>

              {isLowest && (
                <div className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded text-center">
                  ✓ Najniższa cena
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ==================== REFINER PROGRESS ==================== */
export function RefinerProgressCard({
  productTitle,
  status,
  progress,
  improvements,
}: {
  productTitle: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  improvements: string[];
}) {
  return (
    <Card
      className={`border-2 ${
        status === "completed"
          ? "border-green-400 bg-green-50"
          : status === "processing"
            ? "border-blue-400 bg-blue-50"
            : status === "failed"
              ? "border-red-400 bg-red-50"
              : "border-slate-300 bg-slate-50"
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-semibold text-slate-900 text-sm truncate">
            {productTitle}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Status:{" "}
            <span className="font-semibold capitalize">{status}</span>
          </p>
        </div>

        {status === "processing" && (
          <>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-600">{progress}% ukończone</p>
          </>
        )}

        {improvements.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-700">
              Ulepszenia:
            </p>
            <ul className="text-xs text-slate-700 space-y-0.5 ml-2">
              {improvements.map((imp, i) => (
                <li key={i}>✓ {imp}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
