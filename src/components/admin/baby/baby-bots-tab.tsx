'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Baby,
  Bot,
  Sparkles,
  Save,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Heart,
  Loader2,
} from 'lucide-react';
import type { BabyBotPersona } from '@/lib/types';
import { saveBabyBotAction } from '@/app/actions/baby-autopilot';

interface BabyBotsTabProps {
  bots: BabyBotPersona[];
  onRefreshBots: () => void;
}

export function BabyBotsTab({
  bots,
  onRefreshBots,
}: BabyBotsTabProps) {
  const [localBots, setLocalBots] = useState<BabyBotPersona[]>(bots);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleUpdateBotField = (botId: string, field: keyof BabyBotPersona, value: any) => {
    setLocalBots(prev => prev.map(b => (b.id === botId ? { ...b, [field]: value } : b)));
  };

  const handleSaveBot = async (bot: BabyBotPersona) => {
    try {
      setSavingId(bot.id);
      const res = await saveBabyBotAction(bot);
      if (res.success) {
        toast.success(`Zapisano konfigurację bota: ${bot.name}`);
        onRefreshBots();
      } else {
        toast.error(res.error || 'Błąd zapisu bota');
      }
    } catch {
      toast.error('Błąd zapisu bota');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold flex items-center gap-2">
          <Bot className="w-5 h-5 text-pink-500" />
          Persony i Boty AI ("Perełki dla Malucha i Mamy")
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Skonfiguruj unikalne charaktery botów, ich ton wypowiedzi, automatyczną akceptację oraz indywidualne prompty dla AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {localBots.map(bot => {
          const isSaving = savingId === bot.id;

          return (
            <Card key={bot.id} className="border border-border/80 flex flex-col justify-between hover:border-pink-300 transition-colors">
              <CardHeader className="pb-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2 bg-background rounded-xl border shadow-sm">
                      {bot.avatar}
                    </span>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        {bot.name}
                        {bot.enabled ? (
                          <Badge variant="default" className="text-[10px] bg-emerald-600">
                            Włączony
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Wyłączony
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs font-medium text-pink-600 dark:text-pink-400 mt-0.5">
                        {bot.badge}
                      </CardDescription>
                    </div>
                  </div>

                  <Switch
                    checked={bot.enabled}
                    onCheckedChange={checked => handleUpdateBotField(bot.id, 'enabled', checked)}
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs flex-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nazwa wyświetlana:</Label>
                  <Input
                    value={bot.name}
                    onChange={e => handleUpdateBotField(bot.id, 'name', e.target.value)}
                    className="text-xs h-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Krótki opis / Rola:</Label>
                  <Textarea
                    value={bot.description}
                    onChange={e => handleUpdateBotField(bot.id, 'description', e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Indywidualne instrukcje dla AI (Prompt systemowy):</Label>
                  <Textarea
                    value={bot.customInstructions || ''}
                    onChange={e => handleUpdateBotField(bot.id, 'customInstructions', e.target.value)}
                    rows={3}
                    className="text-xs font-mono text-[11px]"
                    placeholder="Instrukcje jak bot ma formułować posty..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Ton wypowiedzi:</Label>
                    <Select
                      value={bot.tone}
                      onValueChange={(val: any) => handleUpdateBotField(bot.id, 'tone', val)}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enthusiastic">🛍️ Entuzjastyczny (Promocje)</SelectItem>
                        <SelectItem value="expert">🩺 Ekspercki (Atesty & Pediatria)</SelectItem>
                        <SelectItem value="friendly">☕ Przyjacielski (Pogaduchy)</SelectItem>
                        <SelectItem value="caring">🎨 Troskliwy (Montessori)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Poziom emocji / humoru:</Label>
                    <Select
                      value={bot.humorLevel}
                      onValueChange={(val: any) => handleUpdateBotField(bot.id, 'humorLevel', val)}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Wysoki (ciepły i energiczny)</SelectItem>
                        <SelectItem value="subtle">Subtelny (merytoryczny)</SelectItem>
                        <SelectItem value="legendary">Maksymalny</SelectItem>
                        <SelectItem value="none">Brak (formalny)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`auto-approve-${bot.id}`}
                      checked={bot.autoApprove}
                      onCheckedChange={checked => handleUpdateBotField(bot.id, 'autoApprove', checked)}
                    />
                    <Label htmlFor={`auto-approve-${bot.id}`} className="text-xs cursor-pointer">
                      Auto-zatwierdzanie w kolejce
                    </Label>
                  </div>
                  <span className="text-[11px]">
                    Opublikowano postów: <strong className="text-foreground">{bot.totalPublished || 0}</strong>
                  </span>
                </div>
              </CardContent>

              <CardFooter className="bg-muted/10 border-t pt-3">
                <Button
                  size="sm"
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white text-xs h-8"
                  onClick={() => handleSaveBot(bot)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Zapisz konfigurację bota
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
