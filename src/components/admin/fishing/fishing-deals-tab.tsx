'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Fish,
  PlusCircle,
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
  Flame,
  Tag,
  DollarSign,
  Send,
  CheckCircle2,
  DownloadCloud,
  Layers,
  Filter
} from 'lucide-react';
import type { FishingDealItem, FishingBotRole } from '@/lib/types';
import { 
  createManualFishingDealAndPostAction,
  harvestFishingPartnerOffersAction 
} from '@/app/actions/fishing-autopilot';

interface FishingDealsTabProps {
  deals: FishingDealItem[];
  loading: boolean;
  onRefreshDeals: () => void;
  onSelectDealForPost: (dealId: string) => void;
}

export function FishingDealsTab({
  deals,
  loading,
  onRefreshDeals,
  onSelectDealForPost,
}: FishingDealsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [harvesting, setHarvesting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [dealUrl, setDealUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [merchant, setMerchant] = useState('Sklep Wędkarski');
  const [description, setDescription] = useState('');
  const [subCategory, setSubCategory] = useState('kolowrotki-wedki');
  const [publishFbNow, setPublishFbNow] = useState(true);
  const [botRole, setBotRole] = useState<FishingBotRole>('wife_secret');
  const [submitting, setSubmitting] = useState(false);

  const filteredDeals = deals.filter(d => {
    // Partner filter
    if (partnerFilter !== 'all') {
      const src = (d.source || 'manual').toLowerCase();
      if (partnerFilter === 'aliexpress' && !src.includes('aliexpress')) return false;
      if (partnerFilter === 'convertiser' && !src.includes('convertiser')) return false;
      if (partnerFilter === 'tradetracker' && !src.includes('tradetracker')) return false;
      if (partnerFilter === 'manual' && src !== 'manual') return false;
    }

    // Text search
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) || (d.merchant && d.merchant.toLowerCase().includes(q));
  });

  const handleHarvestPartners = async () => {
    try {
      setHarvesting(true);
      const res = await harvestFishingPartnerOffersAction();
      if (res.success) {
        toast.success(res.message);
        onRefreshDeals();
      } else {
        toast.error(res.error || res.message || 'Błąd pobierania ofert z sieci partnerskich');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd pobierania ofert');
    } finally {
      setHarvesting(false);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !dealUrl) {
      toast.error('Wypełnij wymagane pola: tytuł, cenę i link');
      return;
    }

    try {
      setSubmitting(true);
      const numPrice = parseFloat(price.replace(',', '.'));
      const numOrigPrice = originalPrice ? parseFloat(originalPrice.replace(',', '.')) : undefined;

      const res = await createManualFishingDealAndPostAction({
        title,
        price: numPrice,
        originalPrice: numOrigPrice,
        dealUrl,
        imageUrl: imageUrl || undefined,
        merchant,
        description: description || undefined,
        subCategory,
        publishFbNow,
        botRole,
      });

      if (res.success) {
        toast.success(
          publishFbNow && res.fbPostUrl
            ? '🚀 Dodano okazję do portalu ORAZ opublikowano na Facebooku!'
            : '✅ Dodano okazję wędkarską do portalu Okazje Plus!'
        );
        // Reset form
        setTitle('');
        setPrice('');
        setOriginalPrice('');
        setDealUrl('');
        setImageUrl('');
        setDescription('');
        setShowAddForm(false);
        onRefreshDeals();
      } else {
        toast.error(res.error || 'Nie udało się dodać okazji');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd zapisu okazji');
    } finally {
      setSubmitting(false);
    }
  };

  const getSourceBadge = (source?: string) => {
    const s = (source || 'manual').toLowerCase();
    if (s.includes('convertiser')) {
      return (
        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
          Convertiser
        </Badge>
      );
    }
    if (s.includes('tradetracker')) {
      return (
        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
          TradeTracker
        </Badge>
      );
    }
    if (s.includes('aliexpress')) {
      return (
        <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30">
          AliExpress
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Ręczne
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Search, Partner Filter & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-xl border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj kołowrotków, wędzisk, plecionek w bazie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="w-full sm:w-48 shrink-0">
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Wszyscy partnerzy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy partnerzy</SelectItem>
                <SelectItem value="convertiser">🟣 Convertiser</SelectItem>
                <SelectItem value="tradetracker">🔵 TradeTracker</SelectItem>
                <SelectItem value="aliexpress">🟠 AliExpress</SelectItem>
                <SelectItem value="manual">⚪ Dodane ręcznie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleHarvestPartners}
            disabled={harvesting}
            className="text-xs gap-1.5 border-purple-500/40 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
          >
            {harvesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <DownloadCloud className="w-3.5 h-3.5" />
            )}
            Pobierz z sieci (Convertiser, TradeTracker, AliExpress)
          </Button>

          <Button
            variant={showAddForm ? 'secondary' : 'default'}
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {showAddForm ? 'Zamknij formularz' : 'Dodaj Nową Okazję Wędkarską'}
          </Button>
        </div>
      </div>

      {/* Manual Deal Addition Form */}
      {showAddForm && (
        <Card className="border-primary/40 shadow-sm animate-in fade-in duration-200">
          <form onSubmit={handleCreateDeal}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Fish className="w-4 h-4 text-primary" />
                Szybkie Dodawanie Okazji Wędkarskiej
              </CardTitle>
              <CardDescription className="text-xs">
                Wprowadź dane sprzętu wędkarskiego. Zostanie on dodany do portalu Okazje Plus w kategorii Wędkarstwo oraz może zostać od razu opublikowany na Facebooku przez bota AI.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tytuł oferty / Sprzęt *</Label>
                  <Input
                    placeholder="np. Kołowrotek Shimano Sedona FJ 2500"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Kategoria sprzętu</Label>
                  <Select value={subCategory} onValueChange={setSubCategory}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kolowrotki-wedki">Kołowrotki i wędki</SelectItem>
                      <SelectItem value="przynety-zanety">Przynęty i zanęty</SelectItem>
                      <SelectItem value="zylki-plecionki">Żyłki i plecionki</SelectItem>
                      <SelectItem value="akcesoria-wedkarskie">Akcesoria i sygnalizatory</SelectItem>
                      <SelectItem value="biwak-wedkarski">Biwak i odzież wędkarska</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cena promocyjna (zł) *</Label>
                  <Input
                    placeholder="np. 189.99"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Cena regularna / przed obniżką (zł)</Label>
                  <Input
                    placeholder="np. 329.00"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Sklep / Sprzedawca</Label>
                  <Input
                    placeholder="np. Drapieżnik, Decathlon, Fishing-Mart, AliExpress, Allegro"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bezpośredni link do zakupu (URL) *</Label>
                  <Input
                    placeholder="https://..."
                    value={dealUrl}
                    onChange={(e) => setDealUrl(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Link do zdjęcia produktu (URL)</Label>
                  <Input
                    placeholder="https://.../zdjecie.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Krótki opis / parametry techniczne</Label>
                <Textarea
                  placeholder="np. 6 łożysk, przełożenie 5.0:1, waga 245g, świetny hamulec przedni..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs min-h-[70px]"
                />
              </div>

              {/* Bot selection & FB publish switch */}
              <div className="p-3 bg-muted/40 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={publishFbNow}
                    onCheckedChange={setPublishFbNow}
                    id="publish-fb-switch"
                  />
                  <div>
                    <Label htmlFor="publish-fb-switch" className="text-xs font-semibold cursor-pointer">
                      Automatycznie wygeneruj post AI i opublikuj od razu na Facebooku
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Wybrany bot przygotuje angażujący post i wyśle go na fanpage "Wędkarskie Promocje Żona nie widzi".
                    </p>
                  </div>
                </div>

                {publishFbNow && (
                  <div className="w-full sm:w-56 shrink-0">
                    <Label className="text-[11px] text-muted-foreground mb-1 block">Wybierz bota:</Label>
                    <Select value={botRole} onValueChange={(val: any) => setBotRole(val)}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wife_secret">🤫 Żona Nie Widzi (Alibi)</SelectItem>
                        <SelectItem value="deal_hunter">🎣 Łowca Okazji</SelectItem>
                        <SelectItem value="gear_expert">🧭 Ekspert & Tester</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-2 border-t flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                disabled={submitting}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Zapisz i Opublikuj
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Deals Grid */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Wyszukiwanie ofert wędkarskich w bazie...</p>
        </div>
      ) : filteredDeals.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="space-y-2">
            <span className="text-4xl">🐟</span>
            <h4 className="font-semibold text-base">Brak ofert pasujących do zapytania i filtrów</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Kliknij przycisk <strong>„Pobierz z sieci (Convertiser, TradeTracker, AliExpress)”</strong> powyżej, aby automatycznie pobrać świeże okazje wędkarskie od partnerów.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDeals.map((deal) => (
            <Card key={deal.id} className="overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="aspect-video bg-muted/40 relative overflow-hidden">
                  {deal.imageUrl ? (
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      🎣
                    </div>
                  )}

                  {deal.discount && (
                    <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground font-bold text-xs">
                      {deal.discount}
                    </Badge>
                  )}

                  <div className="absolute top-2 right-2">
                    {getSourceBadge(deal.source)}
                  </div>

                  <Badge variant="secondary" className="absolute bottom-2 right-2 text-[10px] bg-background/90 backdrop-blur-sm">
                    {deal.merchant}
                  </Badge>
                </div>

                <CardContent className="p-3 space-y-2">
                  <h4 className="font-semibold text-xs leading-snug line-clamp-2" title={deal.title}>
                    {deal.title}
                  </h4>

                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {deal.price}
                    </span>
                    {deal.oldPrice && (
                      <span className="text-xs text-muted-foreground line-through font-mono">
                        {deal.oldPrice}
                      </span>
                    )}
                  </div>
                </CardContent>
              </div>

              <CardFooter className="p-3 pt-0 border-t bg-muted/10 flex items-center justify-between gap-2 mt-2">
                <a
                  href={deal.dealUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Link
                </a>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectDealForPost(deal.id)}
                  className="text-xs h-7 px-2.5 gap-1 border-primary/40 hover:bg-primary/10 text-primary"
                >
                  <Sparkles className="w-3 h-3" />
                  Utwórz post FB
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
