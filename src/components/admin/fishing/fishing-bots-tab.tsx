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
  Bot,
  Sparkles,
  Save,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Flame,
  MessageSquare,
  HelpCircle,
  Loader2
} from 'lucide-react';
import type { FishingBotPersona } from '@/lib/types';
import { saveFishingBotAction } from '@/app/actions/fishing-autopilot';

interface FishingBotsTabProps {
  bots: FishingBotPersona[];
  onRefreshBots: () => void;
}

export function FishingBotsTab({
  bots,
  onRefreshBots,
}: FishingBotsTabProps) {
  const [localBots, setLocalBots] = useState<FishingBotPersona[]>(bots);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleUpdateBotField = (botId: string, field: keyof FishingBotPersona, value: any) => {
    setLocalBots(prev => prev.map(b => b.id === botId ? { ...b, [field]: value } : b));
  };

  const handleSaveBot = async (bot: FishingBotPersona) => {
    try {
      setSavingId(bot.id);
      const res = await saveFishingBotAction(bot);
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
      <div className="bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base">AI Boty & Persony Wędkarskie</h3>
            <p className="text-xs text-muted-foreground">
              Skonfiguruj osobowości sztucznej inteligencji piszące posty na Fanpage, Grupę FB oraz Portal Okazje Plus.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {localBots.map((bot) => {
          const isSaving = savingId === bot.id;

          return (
            <Card key={bot.id} className="flex flex-col justify-between border-border/80 hover:border-border transition-all">
              <div>
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-1.5 bg-background rounded-lg border shadow-xs shrink-0">
                        {bot.avatar}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold">
                            {bot.name}
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px]">
                            {bot.badge}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-0.5">
                          {bot.description}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={bot.enabled}
                        onCheckedChange={(checked) => handleUpdateBotField(bot.id, 'enabled', checked)}
                        id={`switch-bot-${bot.id}`}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Mode & Target Strip */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Cel Publikacji
                      </Label>
                      <Select
                        value={bot.target}
                        onValueChange={(val: any) => handleUpdateBotField(bot.id, 'target', val)}
                      >
                        <SelectTrigger className="text-xs mt-1 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Facebook + Portal</SelectItem>
                          <SelectItem value="facebook">Tylko Facebook</SelectItem>
                          <SelectItem value="portal">Tylko Portal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Poziom Humoru
                      </Label>
                      <Select
                        value={bot.humorLevel}
                        onValueChange={(val: any) => handleUpdateBotField(bot.id, 'humorLevel', val)}
                      >
                        <SelectTrigger className="text-xs mt-1 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="legendary">🤫 Legendarny (Żona nie widzi)</SelectItem>
                          <SelectItem value="high">😄 Wysoki</SelectItem>
                          <SelectItem value="subtle">🙂 Subtelny</SelectItem>
                          <SelectItem value="none">😐 Poważny / Rzeczowy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Auto-Approve Switch */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                    <div>
                      <Label className="text-xs font-semibold block cursor-pointer">
                        Autopublikacja bez moderacji
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        Posty publikowane natychmiast o zaplanowanych godzinach
                      </span>
                    </div>
                    <Switch
                      checked={bot.autoApprove}
                      onCheckedChange={(checked) => handleUpdateBotField(bot.id, 'autoApprove', checked)}
                    />
                  </div>

                  {/* Custom Prompt Instructions */}
                  <div>
                    <Label className="text-xs font-semibold">
                      Własne Instrukcje Promptu dla Bota (AI Persona Guidelines)
                    </Label>
                    <Textarea
                      value={bot.customInstructions || ''}
                      onChange={(e) => handleUpdateBotField(bot.id, 'customInstructions', e.target.value)}
                      placeholder="Dopisz specjalne wytyczne dla tego bota..."
                      className="text-xs min-h-[75px] mt-1 font-mono leading-relaxed"
                    />
                  </div>

                  {/* Stats & Schedule */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {bot.scheduleDescription || 'Według harmonogramu'}
                    </span>
                    <span>
                      Wygenerowane: <strong>{bot.totalGenerated || 0}</strong> • Opublikowane: <strong>{bot.totalPublished || 0}</strong>
                    </span>
                  </div>
                </CardContent>
              </div>

              <CardFooter className="p-3 border-t bg-muted/10 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSaveBot(bot)}
                  disabled={isSaving}
                  className="text-xs gap-1.5 h-8"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Zapisz Bota
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
