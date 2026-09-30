'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Bot,
  Save,
  Loader2,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Flame,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import type { GeneralBotPersona } from '@/lib/types';
import { saveGeneralBotAction } from '@/app/actions/general-autopilot';

interface GeneralBotsTabProps {
  bots: GeneralBotPersona[];
  onRefreshBots: () => void;
}

export function GeneralBotsTab({
  bots,
  onRefreshBots,
}: GeneralBotsTabProps) {
  const [editingBots, setEditingBots] = useState<Record<string, GeneralBotPersona>>(
    bots.reduce((acc, b) => ({ ...acc, [b.id]: { ...b } }), {})
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleChange = (id: string, updates: Partial<GeneralBotPersona>) => {
    setEditingBots(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...updates,
      },
    }));
  };

  const handleSave = async (id: string) => {
    const bot = editingBots[id];
    if (!bot) return;

    try {
      setSavingId(id);
      const res = await saveGeneralBotAction(bot);
      if (res.success) {
        toast.success(`Zapisano bota: ${bot.name}`);
        onRefreshBots();
      } else {
        toast.error(res.error || 'Błąd zapisu bota');
      }
    } catch (err: any) {
      toast.error(err.message || 'Wystąpił błąd');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Persony Botów AI dla Okazje Plus ({bots.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Każdy bot ma unikalną osobowość, styl wypowiedzi oraz dedykowany harmonogram publikacji.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bots.map(bot => {
          const current = editingBots[bot.id] || bot;

          return (
            <Card key={bot.id} className="border-border shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2 rounded-xl bg-primary/10 border border-primary/20">
                      {current.avatar}
                    </span>
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        {current.name}
                        <Badge variant="outline" className="text-[10px]">
                          {current.badge}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Rola: <strong>{current.role}</strong>
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={current.enabled}
                      onCheckedChange={checked => handleChange(bot.id, { enabled: checked })}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                <p className="text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded border border-border/50">
                  {current.description}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Ton wypowiedzi</Label>
                    <Select
                      value={current.tone}
                      onValueChange={(val: any) => handleChange(bot.id, { tone: val })}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enthusiastic">Entuzjastyczny (🔥 Viral)</SelectItem>
                        <SelectItem value="expert">Ekspercki (🛡️ Rzetelny)</SelectItem>
                        <SelectItem value="friendly">Przyjazny (💬 Społeczność)</SelectItem>
                        <SelectItem value="concise">Zwięzły (⚡ Szybki)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Poziom emocji / humoru</Label>
                    <Select
                      value={current.humorLevel}
                      onValueChange={(val: any) => handleChange(bot.id, { humorLevel: val })}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subtle">Subtelny</SelectItem>
                        <SelectItem value="high">Wysoki</SelectItem>
                        <SelectItem value="legendary">Maksymalny</SelectItem>
                        <SelectItem value="none">Brak (Formalny)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Własne instrukcje dla AI (Prompt)</Label>
                  <Textarea
                    value={current.customInstructions || ''}
                    onChange={e => handleChange(bot.id, { customInstructions: e.target.value })}
                    rows={3}
                    className="text-xs resize-y"
                    placeholder="Wskazówki dla modelu AI jak formułować posty..."
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <span>Wygenerowane posty: <strong>{current.totalGenerated || 0}</strong></span>
                  <span>Opublikowane na FB: <strong>{current.totalPublished || 0}</strong></span>
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t bg-muted/20 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSave(bot.id)}
                  disabled={savingId === bot.id}
                  className="text-xs h-8 gap-1.5 font-semibold"
                >
                  {savingId === bot.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Zapisz Konfigurację Bota
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
