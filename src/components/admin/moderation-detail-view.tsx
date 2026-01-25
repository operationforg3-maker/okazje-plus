// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useCategoryName } from '@/hooks/use-category-name';

interface ModerationDetailViewProps {
  item: any;
  itemType: 'deal' | 'product';
}

/**
 * ModerationDetailView - Wyświetla WSZYSTKIE dane z bazy dla pojedynczego deal/produktu
 * Pokazuje pełną raw data w formacie JSON z możliwością kopii
 * - Harvester fields (wszystkie pola importowane)
 * - Metadata (status, daty, Quality Score, itd)
 * - Pełna struktura JSON
 */
export function ModerationDetailView({ item, itemType }: ModerationDetailViewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    rawData: true,
    specs: true,
    descriptions: true,
    pricing: true,
    metadata: true,
  });

  // Load category names
  const { mainName, subName, subSubName } = useCategoryName(
    item.mainCategorySlug,
    item.subCategorySlug,
    item.subSubCategorySlug
  );

  const toggleSection = (section: string) => {
    setExpandedSections(p => ({ ...p, [section]: !p[section] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Skopiowano do schowka');
  };

  const Section = ({ 
    title, 
    id, 
    children, 
    count 
  }: { 
    title: string; 
    id: string; 
    children: React.ReactNode; 
    count?: number;
  }) => (
    <div className="border rounded-lg mb-3">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expandedSections[id] ? (
            <ChevronUp className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          )}
          <h3 className="font-semibold text-sm truncate">{title}</h3>
          {count !== undefined && (
            <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">
              {count}
            </Badge>
          )}
        </div>
      </button>
      
      {expandedSections[id] && (
        <div className="border-t p-3 bg-muted/30 text-sm max-h-[400px] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );

  const FieldRow = ({ label, value }: { label: string; value: any }) => {
    const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    
    return (
      <div className="py-2 border-b last:border-b-0 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
        <div className="font-medium text-xs min-w-0 sm:min-w-[150px] flex-shrink-0 break-words">{label}:</div>
        <div className="flex-1 break-words font-mono text-xs text-muted-foreground w-full sm:max-w-[calc(100%-160px)]">
          {displayValue}
        </div>
        {displayValue.length > 20 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 flex-shrink-0"
            onClick={() => copyToClipboard(displayValue)}
            title="Kopiuj wartość"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  // DEAL fields
  if (itemType === 'deal') {
    return (
      <div className="space-y-3">
        {/* Overview */}
        <Section title="📋 Przegląd" id="overview">
          <div className="space-y-1">
            <FieldRow label="ID" value={item.id} />
            <FieldRow label="Status" value={item.status} />
            <FieldRow label="Title" value={item.title} />
            <FieldRow label="Source" value={item.source} />
            <FieldRow label="URL" value={item.url} />
            <FieldRow label="Created At" value={item.createdAt} />
            <FieldRow label="Posted By" value={item.postedBy} />
          </div>
        </Section>

        {/* Pricing & Costs */}
        <Section title="💰 Ceny i koszty" id="pricing" count={Object.keys(item.price || {}).length}>
          <div className="space-y-1">
            <FieldRow label="Price (PLN)" value={item.price?.amount} />
            <FieldRow label="Currency" value={item.price?.currency} />
            <FieldRow label="Original Price" value={item.originalPrice} />
            <FieldRow label="Shipping Cost" value={item.shippingCost} />
            <FieldRow label="Price History" value={item.priceHistory} />
            {item.price && Object.entries(item.price).map(([key, value]) => (
              key !== 'amount' && key !== 'currency' && (
                <FieldRow key={key} label={`price.${key}`} value={value} />
              )
            ))}
          </div>
        </Section>

        {/* Merchant & Source Info */}
        <Section title="🏪 Merchant & Źródło" id="metadata" count={15}>
          <div className="space-y-1">
            <FieldRow label="Merchant Name" value={item.merchantName} />
            <FieldRow label="Merchant Rating" value={item.merchantRating} />
            <FieldRow label="In Stock" value={item.inStock} />
            <FieldRow label="Source ID" value={item.sourceId} />
            <FieldRow label="Source" value={item.source} />
            <FieldRow label="Category" value={mainName ? `${mainName} (${item.mainCategorySlug})` : (item.category || item.mainCategorySlug)} />
            <FieldRow label="Sub Category" value={subName ? `${subName} (${item.subCategorySlug})` : item.subCategorySlug} />
            <FieldRow label="Campaign" value={item.campaign} />
            <FieldRow label="Affiliate URL" value={item.affiliateUrl} />
          </div>
        </Section>

        {/* Engagement & Moderation */}
        <Section title="📊 Zaangażowanie" id="specs">
          <div className="space-y-1">
            <FieldRow label="Votes" value={item.votes} />
            <FieldRow label="Temperature" value={item.temperature} />
            <FieldRow label="Comments" value={item.comments} />
            <FieldRow label="Quality Score" value={item.qualityScore} />
            <FieldRow label="Expiry Date" value={item.expiryDate} />
          </div>
        </Section>

        {/* Full Raw Data JSON */}
        <Section title="📄 Pełne Raw Data (JSON)" id="rawData">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="mb-3 sticky top-0 z-10"
              onClick={() => copyToClipboard(JSON.stringify(item, null, 2))}
            >
              <Copy className="h-3 w-3 mr-1" />
              Kopiuj JSON
            </Button>
            <pre className="bg-black text-green-400 p-3 rounded text-xs overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words">
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        </Section>
      </div>
    );
  }

  // PRODUCT fields (ProductCore)
  if (itemType === 'product') {
    return (
      <div className="space-y-3">
        {/* Overview */}
        <Section title="📋 Przegląd Produktu" id="overview">
          <div className="space-y-1">
            <FieldRow label="ID" value={item.id} />
            <FieldRow label="Status" value={item.status} />
            <FieldRow label="Title (PL)" value={item.title?.pl} />
            <FieldRow label="Title (EN)" value={item.title?.en} />
            <FieldRow label="Title (DE)" value={item.title?.de} />
            <FieldRow label="Created At" value={item.createdAt} />
            <FieldRow label="Updated At" value={item.updatedAt} />
          </div>
        </Section>

        {/* Descriptions */}
        <Section title="📝 Opisy (HTML & SEO)" id="descriptions">
          <div className="space-y-1">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="border p-2 rounded bg-slate-50">
                     <p className="text-xs font-bold text-slate-500 mb-1">HTML Description (PL)</p>
                     {item.description?.pl ? (
                         <div className="prose prose-sm prose-slate max-w-none text-xs" dangerouslySetInnerHTML={{ __html: item.description.pl }} />
                     ) : <span className="text-red-400 text-xs italic">Brak HTML PL</span>}
                 </div>
                 <div className="border p-2 rounded bg-slate-50">
                     <p className="text-xs font-bold text-slate-500 mb-1">Short/SEO Description ({item.seoDescription ? 'SEO' : 'Base'})</p>
                      <p className="text-xs">{item.shortDescription?.pl || item.seoDescription || '--'}</p>
                 </div>
             </div>
             
             <div className="mt-2 border-t pt-2 space-y-1">
                <FieldRow label="Full Text (Generated PL)" value={item.fullDescription?.pl} />
                <FieldRow label="Full Text (Generated EN)" value={item.fullDescription?.en} />
             </div>
          </div>
        </Section>

        {/* Specs & Attributes */}
        <Section title="⚙️ Specyfikacja" id="specs" count={Object.keys(item.specs || {}).length}>
          <div className="space-y-1">
            {Object.entries(item.specs || {}).map(([key, value]) => (
              <FieldRow key={key} label={key} value={value} />
            ))}
            {Object.keys(item.specs || {}).length === 0 && (
              <div className="text-muted-foreground text-xs">Brak specyfikacji</div>
            )}
          </div>
        </Section>

        {/* Pricing */}
        <Section title="💰 Cena & Dostępność" id="pricing">
          <div className="space-y-1">
            <FieldRow label="Best Price (Amount)" value={item.bestPrice?.amount} />
            <FieldRow label="Best Price (Currency)" value={item.bestPrice?.currency} />
            <FieldRow label="Best Price (Date)" value={item.bestPrice?.date} />
            <FieldRow label="Lowest Price 30D" value={item.lowestPrice30Days} />
            <FieldRow label="Best Deal ID" value={item.bestDealId} />
          </div>
        </Section>

        {/* Ratings & Reviews */}
        <Section title="⭐ Oceny i Recenzje" id="metadata">
          <div className="space-y-1">
            <FieldRow label="Rating (Average)" value={item.rating?.average} />
            <FieldRow label="Rating (Count)" value={item.rating?.count} />
            <FieldRow label="Quality Score (AI)" value={item.qualityScore} />
            <FieldRow label="Review Summary (PL)" value={item.reviewsSummary?.pl} />
            <FieldRow label="Review Summary (EN)" value={item.reviewsSummary?.en} />
          </div>
        </Section>

        {/* Source Links & Categories */}
        <Section title="🔗 Źródła i Kategorie" id="specs">
          <div className="space-y-1">
            <FieldRow label="Main Category Slug" value={mainName ? `${mainName} (${item.mainCategorySlug})` : item.mainCategorySlug} />
            <FieldRow label="Sub Category Slug" value={subName ? `${subName} (${item.subCategorySlug})` : item.subCategorySlug} />
            <FieldRow label="Sub Sub Category Slug" value={subSubName ? `${subSubName} (${item.subSubCategorySlug})` : item.subSubCategorySlug} />
            <FieldRow 
              label="Source Links" 
              value={item.sourceLinks?.map((l: any) => `${l.source}: ${l.url}`).join(', ')} 
            />
          </div>
        </Section>

        {/* Images */}
        <Section title="🖼️ Obrazy" id="images" count={(item.images?.length || (item.image ? 1 : 0))}>
          <div className="space-y-2">
            {(item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : [])).map((img: string, i: number) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-2 py-2 border-b last:border-b-0">
                <div className="font-medium text-xs min-w-0 sm:min-w-[80px] flex-shrink-0">Image {i + 1}:</div>
                <div className="flex-1 flex flex-col gap-2 w-full">
                  <img src={img} alt="Preview" className="h-20 w-20 object-contain bg-white rounded border flex-shrink-0" />
                  <input 
                    type="text" 
                    value={img} 
                    readOnly 
                    className="text-xs bg-muted p-1 rounded font-mono w-full truncate" 
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-auto self-start"
                    onClick={() => copyToClipboard(img)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Kopiuj URL
                  </Button>
                </div>
              </div>
            ))}
            {!item.images?.length && !item.image && (
               <div className="text-muted-foreground text-xs italic">Brak obrazów</div>
            )}
          </div>
        </Section>

        {/* Search Tags */}
        <Section title="🏷️ Tagi Wyszukiwania" id="searchTags" count={item.searchTags?.length || 0}>
          <div className="space-y-1">
            {item.searchTags?.map((tag: string, i: number) => (
              <Badge key={i} variant="secondary" className="mr-2 mb-2">{tag}</Badge>
            ))}
            {(!item.searchTags || item.searchTags.length === 0) && (
              <div className="text-muted-foreground text-xs">Brak tagów</div>
            )}
          </div>
        </Section>

        {/* Raw Data Comparison (Added for M6 Moderation) */}
        <Section title="🔎 Porównanie: Oryginał vs AI Refined" id="comparison">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded p-2 bg-amber-50/50">
              <h4 className="font-semibold text-xs text-amber-700 mb-2 uppercase border-b border-amber-200 pb-1">
                Oryginał (Raw / Metadata)
              </h4>
              <div className="text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
                 {JSON.stringify({
                    title: item.metadata?.originalTitle || item.originalTitle || 'N/A',
                    desc: (item.metadata?.originalDescription || item.originalDescription || 'N/A')?.substring(0, 300) + '...',
                    specs: item.metadata?.originalSpecs || 'N/A',
                    source: item.metadata?.source || 'N/A'
                 }, null, 2)}
              </div>
            </div>
            
            <div className="border rounded p-2 bg-green-50/50">
              <h4 className="font-semibold text-xs text-green-700 mb-2 uppercase border-b border-green-200 pb-1">
                Wzbogacone (Refined)
              </h4>
              <div className="text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
                 {JSON.stringify({
                    title: item.title,
                    desc: item.description,
                    specs: item.specs,
                    qualityScore: item.qualityScore
                 }, null, 2)}
              </div>
            </div>
          </div>
        </Section>

        {/* Full Raw Data JSON */}
        <Section title="📄 Pełne Raw Data (JSON)" id="rawData">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="mb-3 sticky top-0 z-10"
              onClick={() => copyToClipboard(JSON.stringify(item, null, 2))}
            >
              <Copy className="h-3 w-3 mr-1" />
              Kopiuj JSON
            </Button>
            <pre className="bg-black text-green-400 p-3 rounded text-xs overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words">
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        </Section>
      </div>
    );
  }

  return <div className="text-muted-foreground">Nieznany typ elementu</div>;
}
