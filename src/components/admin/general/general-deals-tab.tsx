'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  PlusCircle,
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
  Tag,
  DollarSign,
  Send,
  CheckCircle2,
  Filter,
  DownloadCloud,
  ShoppingBag,
} from 'lucide-react';
import type { GeneralDealItem, GeneralBotRole } from '@/lib/types';
import {
  createManualGeneralDealAndPostAction,
  harvestGeneralPartnerOffersAction,
} from '@/app/actions/general-autopilot';

interface GeneralDealsTabProps {
  deals: GeneralDealItem[];
  loading: boolean;
  onRefreshDeals: () => void;
  onSelectDealForPost: (dealId: string) => void;
}

export function GeneralDealsTab({
  deals,
  loading,
  onRefreshDeals,
  onSelectDealForPost,
}: GeneralDealsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [harvesting, setHarvesting] = useState(false);

  // Form state
  const [dealUrl, setDealUrl] = useState('');
  const [publishFbNow, setPublishFbNow] = useState(true);
  const [botRole, setBotRole] = useState<GeneralBotRole>('bargain_hunter');
  const [submitting, setSubmitting] = useState(false);

  const handleHarvest = async () => {
    try {
      setHarvesting(true);
      toast.info('Rozpoczynam pobieranie ofert z feedów Convertiser, TradeTracker i AliExpress...');
      const res = await harvestGeneralPartnerOffersAction({});
      if (res.success) {
        toast.success(`Pobrano ${res.importedCount} nowych okazji z feedów partnerskich!`);
        onRefreshDeals();
      } else {
        toast.error(res.error || 'Błąd pobierania z feedów');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd procesu pobierania z feeda');
    } finally {
      setHarvesting(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealUrl) {
      toast.error('Wklej prawidłowy URL okazji');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createManualGeneralDealAndPostAction({
        url: dealUrl,
        botRole,
        publishImmediately: publishFbNow,
      });

      if (res.success) {
        toast.success('Dodano okazję do bazy oraz wygenerowano post!');
        setDealUrl('');
        setShowAddForm(false);
        onRefreshDeals();
      } else {
        toast.error(res.error || 'Błąd dodawania okazji');
      }
    } catch (err: any) {
      toast.error(err.message || 'Wystąpił błąd');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDeals = deals.filter(deal => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        deal.title.toLowerCase().includes(q) ||
        (deal.merchant || '').toLowerCase().includes(q) ||
        (deal.description || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (partnerFilter !== 'all') {
      const src = (deal.source || '').toLowerCase();
      if (partnerFilter === 'aliexpress' && !src.includes('aliexpress')) return false;
      if (partnerFilter === 'convertiser' && !src.includes('convertiser')) return false;
      if (partnerFilter === 'tradetracker' && !src.includes('tradetracker')) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top action bar: Harvester & Manual Adder */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/30 rounded-xl border border-border/60">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            Zarządzanie Ofertami Okazje Plus
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zasilaj bazę z feedów partnerskich lub dodaj okazję ręcznie z dowolnego sklepu.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={handleHarvest}
            disabled={harvesting}
            className="text-xs gap-1.5 bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 font-semibold"
          >
            {harvesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Pobieranie z feedów...
              </>
            ) : (
              <>
                <DownloadCloud className="w-3.5 h-3.5" />
                Pobierz z feeda partnerów (Harvester)
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-primary" />
            Dodaj okazję ręcznie z URL
          </Button>
        </div>
      </div>

      {/* Manual Deal Form */}
      {showAddForm && (
        <Card className="border-primary/30 shadow-md bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Ręczny Import Okazji z Linku URL</CardTitle>
            <CardDescription className="text-xs">
              Wklej link do okazji w dowolnym sklepie (np. Media Expert, Allegro, Morele, AliExpress).
              System automatycznie pobierze tytuł, zdjęcie i wygeneruje post AI.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleManualAdd}>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Adres URL okazji</Label>
                <Input
                  placeholder="https://..."
                  value={dealUrl}
                  onChange={e => setDealUrl(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Wybierz bota do posta</Label>
                  <Select
                    value={botRole}
                    onValueChange={(val: GeneralBotRole) => setBotRole(val)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bargain_hunter">Łowca Perełek Cenowych</SelectItem>
                      <SelectItem value="tech_expert">Tester & Ekspert Jakości</SelectItem>
                      <SelectItem value="community_lead">Animator Społeczności</SelectItem>
                      <SelectItem value="smart_assistant">Smart Asystent Zakupowy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="pubImmediately"
                    checked={publishFbNow}
                    onChange={e => setPublishFbNow(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="pubImmediately" className="text-xs cursor-pointer">
                    Opublikuj od razu na Facebooku
                  </Label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-2 border-t bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="text-xs"
              >
                Anuluj
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="text-xs font-semibold">
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Zapisz i Wygeneruj Post AI
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Szukaj w bazie (smartfony, laptopy, sklep)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="w-full sm:w-[180px] text-xs">
              <SelectValue placeholder="Wszystkie źródła" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie źródła</SelectItem>
              <SelectItem value="convertiser">Convertiser</SelectItem>
              <SelectItem value="tradetracker">TradeTracker</SelectItem>
              <SelectItem value="aliexpress">AliExpress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deals Grid */}
      {filteredDeals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-sm font-semibold">Brak okazji w bazie</p>
            <p className="text-xs text-muted-foreground">
              Użyj przycisku <strong>"Pobierz z feeda partnerów (Harvester)"</strong> powyżej, aby automatycznie załadować oferty.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeals.map(deal => (
            <Card key={deal.id} className="border-border hover:border-primary/40 transition-shadow shadow-sm flex flex-col justify-between overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-3 items-start">
                  {deal.imageUrl ? (
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-16 h-16 object-cover rounded-md border shrink-0 bg-muted/20"
                      onError={(e: any) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs font-bold leading-snug line-clamp-2 text-foreground">
                      {deal.title}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-primary">{deal.price}</span>
                      {deal.oldPrice && (
                        <span className="text-[11px] text-muted-foreground line-through">
                          {deal.oldPrice}
                        </span>
                      )}
                      {deal.discount && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-red-500/10 text-red-600 border-red-500/30">
                          {deal.discount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      🏬 {deal.merchant || 'Sklep partnerski'}
                    </p>
                  </div>
                </div>

                {deal.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {deal.description}
                  </p>
                )}
              </CardContent>

              <CardFooter className="p-3 bg-muted/20 border-t flex items-center justify-between gap-2">
                <a
                  href={deal.dealUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline truncate max-w-[140px]"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  Link partnerski
                </a>

                <Button
                  size="sm"
                  onClick={() => onSelectDealForPost(deal.id)}
                  className="text-xs h-7 font-semibold gap-1 bg-primary hover:bg-primary/90"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Generuj Post AI
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
