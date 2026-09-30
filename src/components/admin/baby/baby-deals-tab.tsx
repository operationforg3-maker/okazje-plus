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
  Baby,
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
} from 'lucide-react';
import type { BabyDealItem, BabyBotRole } from '@/lib/types';
import { createManualBabyDealAndPostAction } from '@/app/actions/baby-autopilot';

interface BabyDealsTabProps {
  deals: BabyDealItem[];
  loading: boolean;
  onRefreshDeals: () => void;
  onSelectDealForPost: (dealId: string) => void;
}

export function BabyDealsTab({
  deals,
  loading,
  onRefreshDeals,
  onSelectDealForPost,
}: BabyDealsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [dealUrl, setDealUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [merchant, setMerchant] = useState('Sklep dla Dzieci');
  const [description, setDescription] = useState('');
  const [publishFbNow, setPublishFbNow] = useState(true);
  const [botRole, setBotRole] = useState<BabyBotRole>('bargain_mom');
  const [submitting, setSubmitting] = useState(false);

  const filteredDeals = deals.filter(d => {
    // Partner filter
    if (partnerFilter !== 'all') {
      const src = (d.source || 'manual').toLowerCase();
      if (partnerFilter === 'aliexpress' && !src.includes('aliexpress') && !d.merchant?.toLowerCase().includes('aliexpress')) return false;
      if (partnerFilter === 'convertiser' && !src.includes('convertiser')) return false;
      if (partnerFilter === 'tradetracker' && !src.includes('tradetracker')) return false;
    }

    // Text search
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) || (d.merchant && d.merchant.toLowerCase().includes(q));
  });

  const handleCreateManualDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !dealUrl) {
      toast.error('Uzupełnij tytuł, cenę i link do oferty');
      return;
    }

    try {
      setSubmitting(true);
      const parsedPrice = parseFloat(price.replace(',', '.'));
      const parsedOrigPrice = originalPrice ? parseFloat(originalPrice.replace(',', '.')) : undefined;

      const res = await createManualBabyDealAndPostAction({
        title,
        price: parsedPrice,
        originalPrice: parsedOrigPrice,
        dealUrl,
        imageUrl,
        merchant,
        description,
        publishFbNow,
        botRole,
      });

      if (res.success) {
        toast.success(
          res.fbPostUrl
            ? '🚀 Dodano okazję i opublikowano na Facebooku!'
            : '✅ Dodano okazję i utworzono szkic posta w kolejce!'
        );
        setShowAddForm(false);
        setTitle('');
        setPrice('');
        setOriginalPrice('');
        setDealUrl('');
        setImageUrl('');
        setDescription('');
        onRefreshDeals();
      } else {
        toast.error(res.error || 'Błąd dodawania okazji');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd procesu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pasek akcji i wyszukiwania */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Szukaj wózków, pampersów, zabawek, klocków..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy partnerzy</SelectItem>
              <SelectItem value="aliexpress">AliExpress</SelectItem>
              <SelectItem value="convertiser">Convertiser (PL sklepy)</SelectItem>
              <SelectItem value="tradetracker">TradeTracker</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-9 text-xs bg-pink-600 hover:bg-pink-700 text-white gap-1.5"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {showAddForm ? 'Zamknij formularz' : 'Dodaj ofertę z linku'}
          </Button>
        </div>
      </div>

      {/* Formularz ręcznego dodawania okazji */}
      {showAddForm && (
        <Card className="border-pink-300 dark:border-pink-900 bg-pink-50/20 dark:bg-pink-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-pink-700 dark:text-pink-300">
              <PlusCircle className="w-4 h-4" />
              Szybkie dodanie okazji dla dzieci z linku partnerskiego
            </CardTitle>
            <CardDescription className="text-xs">
              Wklej ofertę z dowolnego sklepu (np. Allegro, Smyk, 5.10.15, AliExpress itp.). AI przygotuje post, doklei tracking i opublikuje na FB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateManualDeal} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tytuł produktu / okazji *</Label>
                  <Input
                    placeholder="np. Wózek spacerowy Kinderkraft Nubi 2 z moskitierą"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    className="text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Link do oferty (sklep / afiliacja) *</Label>
                  <Input
                    placeholder="https://..."
                    value={dealUrl}
                    onChange={e => setDealUrl(e.target.value)}
                    required
                    className="text-xs h-8"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Cena promocyjna (zł) *</Label>
                    <Input
                      placeholder="149.99"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      required
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Stara cena (zł)</Label>
                    <Input
                      placeholder="219.00"
                      value={originalPrice}
                      onChange={e => setOriginalPrice(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Sklep / Sprzedawca</Label>
                    <Input
                      placeholder="np. Smyk, Allegro, AliExpress"
                      value={merchant}
                      onChange={e => setMerchant(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">URL Zdjęcia (opcjonalnie)</Label>
                    <Input
                      placeholder="https://...jpg"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Opis / atesty / kluczowe parametry (dla AI)</Label>
                  <Textarea
                    placeholder="np. Certyfikat Oeko-Tex, norma EN-71, dla dzieci od urodzenia do 22 kg, waga wózka tylko 7 kg..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Autor / Bot:</Label>
                    <Select value={botRole} onValueChange={(val: any) => setBotRole(val)}>
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bargain_mom">🛍️ Mama Łowczyni Okazji</SelectItem>
                        <SelectItem value="safety_expert">🩺 Mama Pediatra & Atesty</SelectItem>
                        <SelectItem value="mom_community">☕ Kawiarenka Mamusiek</SelectItem>
                        <SelectItem value="montessori_play">🎨 Kreatywna Mama & Montessori</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="publish-fb"
                      checked={publishFbNow}
                      onCheckedChange={setPublishFbNow}
                    />
                    <Label htmlFor="publish-fb" className="text-xs cursor-pointer">
                      Opublikuj natychmiast na FB (wraz z linkiem w 1. komentarzu)
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-pink-600 hover:bg-pink-700 text-white text-xs h-8"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Generowanie i publikacja...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Zapisz i wygeneruj post AI
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabela okazji */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Baby className="w-4 h-4 text-pink-500" />
              Znalezione okazje dla malucha i mamy ({filteredDeals.length})
            </CardTitle>
            <Badge variant="outline" className="text-[11px]">
              SubID: Maluch_1
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Wybierz okazję z listy, aby wygenerować dedykowany post na Facebooka jednym kliknięciem.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {filteredDeals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              Nie znaleziono okazji spełniających kryteria. Użyj przycisku "Dodaj ofertę z linku" lub zmień filtry.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredDeals.map(deal => (
                <div
                  key={deal.id}
                  className="p-3 hover:bg-muted/20 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {deal.imageUrl ? (
                      <img
                        src={deal.imageUrl}
                        alt={deal.title}
                        className="w-12 h-12 object-cover rounded-md border flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-pink-400">
                        <Baby className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate text-foreground">{deal.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-muted-foreground text-[11px]">
                        <span className="font-bold text-pink-600 dark:text-pink-400">{deal.price}</span>
                        {deal.oldPrice && <span className="line-through">{deal.oldPrice}</span>}
                        {deal.discount && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                            {deal.discount}
                          </Badge>
                        )}
                        <span>·</span>
                        <span>{deal.merchant}</span>
                        <span>·</span>
                        <span className="capitalize">{deal.source}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <a
                      href={deal.dealUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded border hover:bg-muted"
                      title="Otwórz link partnerski"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <Button
                      size="sm"
                      className="h-8 text-xs bg-pink-600 hover:bg-pink-700 text-white gap-1"
                      onClick={() => onSelectDealForPost(deal.id)}
                    >
                      <Sparkles className="w-3 h-3" />
                      Stwórz post AI
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
