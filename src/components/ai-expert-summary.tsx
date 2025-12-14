"use client";

/**
 * ========================================
 * AI EXPERT SUMMARY BOX — "Okiem Eksperta"
 * ========================================
 * 
 * Displays AI-curated product insights from M4 Smart Importing:
 * ✅ SEO-optimized description (LocalizedText)
 * ✅ Quality score (0-100) with visual indicator
 * ✅ Pros & Cons extraction
 * ✅ Key features highlights
 * ✅ Trust signals (AI confidence)
 * ✅ Multi-language support
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  Award, 
  CheckCircle2, 
  AlertTriangle,
  Star,
  TrendingUp,
  Info
} from 'lucide-react';
import { useContentLanguage } from '@/hooks/use-content-language';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIExpertSummaryProps {
  product: Product;
  className?: string;
}

export default function AIExpertSummary({ product, className }: AIExpertSummaryProps) {
  const { getText } = useContentLanguage();

  // Extract AI-curated content
  const seoDescription = getText(product.seoDescription);
  const qualityScore = (product as any).ai?.quality?.score || 0;
  const qualityData = (product as any).ai?.quality;
  
  // Extract pros/cons from AI quality assessment
  const pros: string[] = [];
  const cons: string[] = [];

  // Parse pros/cons from quality data or seoDescription
  if (qualityData) {
    // If we have structured quality data
    if (qualityData.readability > 80) pros.push('Czytelny i szczegółowy opis');
    if (qualityData.informationCompleteness > 75) pros.push('Kompletne informacje o produkcie');
    if (qualityData.trustworthiness > 70) pros.push('Wiarygodny sprzedawca');
    if (qualityData.valueProposition > 65) pros.push('Atrakcyjna cena w stosunku do jakości');
    
    if (qualityData.readability < 50) cons.push('Opis wymaga poprawy');
    if (qualityData.informationCompleteness < 50) cons.push('Brak niektórych specyfikacji');
    if (qualityData.trustworthiness < 50) cons.push('Weryfikuj sprzedawcę przed zakupem');
  }

  // Fallback: extract from rating/orders
  const rating = (product as any).rating ?? 0;
  const ordersCount = (product as any).ordersCount ?? 0;
  const merchantRating = (product as any).merchantRating ?? 0;

  if (rating >= 4.5 && ordersCount > 1000) {
    pros.push(`Bardzo wysoka ocena (${(rating ?? 0).toFixed(1)}★)`);
    pros.push(`Ponad ${ordersCount.toLocaleString()} zamówień`);
  }
  if (merchantRating >= 95) {
    pros.push('Zweryfikowany sprzedawca (95%+)');
  }

  if (rating < 4.0 && rating > 0) {
    cons.push(`Ocena poniżej 4.0 (${(rating ?? 0).toFixed(1)}★)`);
  }
  if (ordersCount < 100 && ordersCount > 0) {
    cons.push('Nowy produkt - mało recenzji');
  }

  // If no AI content, don't render
  if (!seoDescription && pros.length === 0) {
    return null;
  }

  // Quality score color
  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getQualityBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className={cn("border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Okiem Eksperta
            <Badge variant="secondary" className="text-xs font-normal">
              AI Analysis
            </Badge>
          </CardTitle>
          
          {qualityScore > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", getQualityColor(qualityScore))}>
                      {qualityScore}/100
                    </span>
                    <Award className={cn("w-4 h-4", getQualityColor(qualityScore))} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ocena jakości produktu przez AI</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        
        {/* Quality Score Bar */}
        {qualityScore > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Jakość produktu</span>
              <span className="font-medium">{qualityScore}%</span>
            </div>
            <Progress 
              value={qualityScore} 
              className={cn("h-2", getQualityBg(qualityScore))}
            />
          </div>
        )}

        {/* AI-Generated Description */}
        {seoDescription && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {seoDescription}
            </p>
          </div>
        )}

        {/* Pros & Cons Grid */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* Pros */}
            {pros.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400">
                  <ThumbsUp className="w-4 h-4" />
                  <span>Zalety</span>
                </div>
                <ul className="space-y-1.5">
                  {pros.slice(0, 5).map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cons */}
            {cons.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
                  <ThumbsDown className="w-4 h-4" />
                  <span>Uwagi</span>
                </div>
                <ul className="space-y-1.5">
                  {cons.slice(0, 5).map((con, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Trust Signals */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {rating >= 4.5 && (
            <Badge variant="secondary" className="text-xs">
              <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
              Wysoka ocena
            </Badge>
          )}
          {ordersCount > 1000 && (
            <Badge variant="secondary" className="text-xs">
              <TrendingUp className="w-3 h-3 mr-1" />
              Bestseller
            </Badge>
          )}
          {merchantRating >= 95 && (
            <Badge variant="secondary" className="text-xs">
              <Award className="w-3 h-3 mr-1" />
              Top Merchant
            </Badge>
          )}
          {qualityScore >= 80 && (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
              Rekomendowany
            </Badge>
          )}
        </div>

        {/* AI Disclaimer */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Analiza wygenerowana przez AI na podstawie danych produktu i recenzji użytkowników. 
            Sprawdź szczegóły przed zakupem.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
