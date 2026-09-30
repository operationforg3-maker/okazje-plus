'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sparkles,
  Layers,
  ShoppingBag,
  Bot,
  Settings,
  RefreshCw,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type {
  GeneralAutopilotConfig,
  GeneralBotPersona,
  GeneralPostQueueItem,
  GeneralDealItem,
} from '@/lib/types';
import {
  getGeneralAutopilotConfigAction,
  getGeneralBotsAction,
  getGeneralDealsAction,
  getGeneralQueueAction,
} from '@/app/actions/general-autopilot';
import { GeneralDashboardTab } from '@/components/admin/general/general-dashboard-tab';
import { GeneralQueueTab } from '@/components/admin/general/general-queue-tab';
import { GeneralDealsTab } from '@/components/admin/general/general-deals-tab';
import { GeneralBotsTab } from '@/components/admin/general/general-bots-tab';
import { GeneralSettingsTab } from '@/components/admin/general/general-settings-tab';

export function GeneralAutopilotPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Data states
  const [config, setConfig] = useState<GeneralAutopilotConfig | null>(null);
  const [bots, setBots] = useState<GeneralBotPersona[]>([]);
  const [deals, setDeals] = useState<GeneralDealItem[]>([]);
  const [queueItems, setQueueItems] = useState<GeneralPostQueueItem[]>([]);
  const [selectedDealForPost, setSelectedDealForPost] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, botsRes, dealsRes, queueRes] = await Promise.all([
        getGeneralAutopilotConfigAction(),
        getGeneralBotsAction(),
        getGeneralDealsAction({ limit: 50 }),
        getGeneralQueueAction(),
      ]);

      if (configRes.success && configRes.config) {
        setConfig(configRes.config);
      }
      if (botsRes.success && botsRes.bots) {
        setBots(botsRes.bots);
      }
      if (dealsRes.success && dealsRes.deals) {
        setDeals(dealsRes.deals);
      }
      if (queueRes.success && queueRes.items) {
        setQueueItems(queueRes.items);
      }
    } catch (err) {
      console.error('Error loading general autopilot data:', err);
      toast.error('Błąd ładowania danych panelu Okazje Plus');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectDealForPost = (dealId: string) => {
    setSelectedDealForPost(dealId);
    setActiveTab('dashboard');
    toast.info('Wybrano ofertę. Możesz teraz wygenerować post AI!');
  };

  const pendingCount = queueItems.filter(i => i.status === 'pending').length;

  if (loading && !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Ładowanie autopilota Okazje Plus...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub Header for General Profile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
              🎯
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Ogólne Okazje Plus (Fanpage & Portal)
            </h2>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              Profil Główny
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl">
            Centrum autopilota dla głównego fanpage'a Okazje Plus: smartfony, laptopy, elektronika, sprzęt AGD i hity dnia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>

          {config?.fb.pageId && (
            <Button
              size="sm"
              variant="secondary"
              asChild
              className="text-xs"
            >
              <a
                href={`https://www.facebook.com/${config.fb.pageId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Fanpage FB
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full max-w-4xl h-auto p-1 bg-muted/60">
          <TabsTrigger value="dashboard" className="text-xs py-2 gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Centrum Dowodzenia
          </TabsTrigger>

          <TabsTrigger value="queue" className="text-xs py-2 gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            Kolejka Moderacji
            {pendingCount > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[10px] bg-primary text-white font-mono">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="deals" className="text-xs py-2 gap-1.5 font-medium">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
            Baza Okazji ({deals.length})
          </TabsTrigger>

          <TabsTrigger value="bots" className="text-xs py-2 gap-1.5 font-medium">
            <Bot className="w-3.5 h-3.5 text-indigo-500" />
            AI Boty ({bots.length})
          </TabsTrigger>

          <TabsTrigger value="settings" className="text-xs py-2 gap-1.5 font-medium">
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            Ustawienia & API
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Dashboard / Generator */}
        <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
          {config && (
            <GeneralDashboardTab
              config={config}
              bots={bots}
              deals={deals}
              onRefreshQueue={loadData}
              onSelectDeal={handleSelectDealForPost}
            />
          )}
        </TabsContent>

        {/* Tab 2: Queue / Moderation */}
        <TabsContent value="queue" className="mt-0 focus-visible:outline-none">
          <GeneralQueueTab
            queueItems={queueItems}
            loading={loading}
            onRefresh={loadData}
            config={config}
          />
        </TabsContent>

        {/* Tab 3: Deals Catalog & Harvester */}
        <TabsContent value="deals" className="mt-0 focus-visible:outline-none">
          <GeneralDealsTab
            deals={deals}
            loading={loading}
            onRefreshDeals={loadData}
            onSelectDealForPost={handleSelectDealForPost}
          />
        </TabsContent>

        {/* Tab 4: AI Bot Personas */}
        <TabsContent value="bots" className="mt-0 focus-visible:outline-none">
          <GeneralBotsTab
            bots={bots}
            onRefreshBots={loadData}
          />
        </TabsContent>

        {/* Tab 5: Settings & Meta API */}
        <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
          {config && (
            <GeneralSettingsTab
              config={config}
              onRefreshConfig={loadData}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
