'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Fish,
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
  FishingAutopilotConfig, 
  FishingBotPersona, 
  FishingPostQueueItem,
  FishingDealItem 
} from '@/lib/types';
import {
  getFishingAutopilotConfigAction,
  getFishingBotsAction,
  getFishingDealsAction,
  getFishingQueueAction,
} from '@/app/actions/fishing-autopilot';
import { FishingDashboardTab } from '@/components/admin/fishing/fishing-dashboard-tab';
import { FishingQueueTab } from '@/components/admin/fishing/fishing-queue-tab';
import { FishingDealsTab } from '@/components/admin/fishing/fishing-deals-tab';
import { FishingBotsTab } from '@/components/admin/fishing/fishing-bots-tab';
import { FishingSettingsTab } from '@/components/admin/fishing/fishing-settings-tab';

export function FishingAutopilotPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Data states
  const [config, setConfig] = useState<FishingAutopilotConfig | null>(null);
  const [bots, setBots] = useState<FishingBotPersona[]>([]);
  const [deals, setDeals] = useState<FishingDealItem[]>([]);
  const [queueItems, setQueueItems] = useState<FishingPostQueueItem[]>([]);
  const [selectedDealForPost, setSelectedDealForPost] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, botsRes, dealsRes, queueRes] = await Promise.all([
        getFishingAutopilotConfigAction(),
        getFishingBotsAction(),
        getFishingDealsAction(),
        getFishingQueueAction(),
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
      console.error('Error loading fishing autopilot data:', err);
      toast.error('Błąd ładowania danych panelu wędkarskiego');
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
    toast.info('Wybrano ofertę wędkarską. Możesz teraz wygenerować post AI!');
  };

  const pendingCount = queueItems.filter(i => i.status === 'pending').length;

  if (loading && !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Ładowanie panelu wędkarskiego "Żona nie widzi"...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg">
              🎣
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Wędkarskie Promocje ("Żona nie widzi")
            </h2>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              Autopilot FB & Portal
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl">
            Centrum automatycznego pozyskiwania i publikowania ofert wędkarskich na grupie i fanpage Facebooka oraz w portalu Okazje Plus. Wspierane przez boty AI z kultowym humorem wędkarskim.
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

          <Button
            size="sm"
            variant="secondary"
            asChild
            className="text-xs"
          >
            <a
              href={`https://www.facebook.com/${config?.fb.pageId || '982464291620541'}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Fanpage FB
            </a>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full max-w-4xl h-auto p-1 bg-muted/60">
          <TabsTrigger value="dashboard" className="text-xs py-2 gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Centrum Dowodzenia
          </TabsTrigger>

          <TabsTrigger value="queue" className="text-xs py-2 gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            Kolejka Moderacji
            {pendingCount > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[10px] bg-amber-500 text-white font-mono">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="deals" className="text-xs py-2 gap-1.5 font-medium">
            <Fish className="w-3.5 h-3.5 text-emerald-500" />
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
            <FishingDashboardTab
              config={config}
              bots={bots}
              deals={deals}
              onRefreshQueue={loadData}
              selectedDealIdProp={selectedDealForPost}
              onClearSelectedDeal={() => setSelectedDealForPost(null)}
            />
          )}
        </TabsContent>

        {/* Tab 2: Queue / Moderation */}
        <TabsContent value="queue" className="mt-0 focus-visible:outline-none">
          <FishingQueueTab
            queueItems={queueItems}
            loading={loading}
            onRefresh={loadData}
            config={config}
          />
        </TabsContent>

        {/* Tab 3: Fishing Deals Catalog */}
        <TabsContent value="deals" className="mt-0 focus-visible:outline-none">
          <FishingDealsTab
            deals={deals}
            loading={loading}
            onRefreshDeals={loadData}
            onSelectDealForPost={handleSelectDealForPost}
          />
        </TabsContent>

        {/* Tab 4: AI Bot Personas */}
        <TabsContent value="bots" className="mt-0 focus-visible:outline-none">
          <FishingBotsTab
            bots={bots}
            onRefreshBots={loadData}
          />
        </TabsContent>

        {/* Tab 5: Settings & Meta API */}
        <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
          {config && (
            <FishingSettingsTab
              config={config}
              onRefreshConfig={loadData}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
