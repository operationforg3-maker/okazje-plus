'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Share2,
  Sparkles,
  Fish,
  Baby,
  Globe,
  Loader2,
  Layers,
} from 'lucide-react';
import { GeneralAutopilotPanel } from '@/components/admin/general/general-autopilot-panel';
import { FishingAutopilotPanel } from '@/components/admin/fishing/fishing-autopilot-panel';
import { BabyAutopilotPanel } from '@/components/admin/baby/baby-autopilot-panel';
import { MultiPlatformSocialTab } from '@/components/admin/multi-platform-social-tab';

type NicheType = 'general' | 'fishing' | 'baby' | 'legacy';

function SocialMediaHubContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [activeNiche, setActiveNiche] = useState<NicheType>('general');

  // Sync state with URL query param on mount and param change
  useEffect(() => {
    const nicheParam = searchParams.get('niche') || searchParams.get('type');
    if (nicheParam === 'fishing') {
      setActiveNiche('fishing');
    } else if (nicheParam === 'baby') {
      setActiveNiche('baby');
    } else if (nicheParam === 'legacy' || nicheParam === 'multi') {
      setActiveNiche('legacy');
    } else if (nicheParam === 'general') {
      setActiveNiche('general');
    }
  }, [searchParams]);

  const handleNicheChange = (niche: NicheType) => {
    setActiveNiche(niche);
    // Update URL query parameter without full reload
    const params = new URLSearchParams(searchParams.toString());
    params.set('niche', niche);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (!authLoading && user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Brak dostępu</CardTitle>
            <CardDescription>
              Tylko administrator ma dostęp do sekcji automatyzacji social mediów.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-orange-500 text-white flex items-center justify-center text-xl shadow-md">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Centrum Social Media & Autopilot
                </h1>
                <Badge variant="default" className="text-xs bg-primary text-white">
                  All-in-One Hub
                </Badge>
              </div>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
            Zintegrowane centrum zarządzania profilami społecznościowymi: <strong>Ogólne Okazje Plus</strong>, <strong>Wędkarskie ("Żona nie widzi")</strong> oraz <strong>Perełki dla Malucha i Mamy</strong>.
            Każdy profil posiada pełny zestaw narzędzi: Generator AI, Podgląd Facebooka na żywo, Kolejkę moderacji, Harvester z feedów partnerskich, Boty oraz Ustawienia API.
          </p>
        </div>
      </div>

      {/* Unified Niche Selector Bar */}
      <div className="bg-muted/40 p-1.5 rounded-2xl border border-border/80 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => handleNicheChange('general')}
            className={cn(
              "flex items-center gap-2.5 py-3 px-3.5 rounded-xl text-left transition-all",
              activeNiche === 'general'
                ? "bg-background text-foreground shadow-sm border border-border/80 ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <span className="text-2xl p-1.5 rounded-lg bg-primary/10">🎯</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs sm:text-sm truncate">Ogólne Okazje</span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1 font-semibold shrink-0">
                  Główny
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Elektronika, AGD, Smartfony
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleNicheChange('fishing')}
            className={cn(
              "flex items-center gap-2.5 py-3 px-3.5 rounded-xl text-left transition-all",
              activeNiche === 'fishing'
                ? "bg-background text-foreground shadow-sm border border-border/80 ring-1 ring-amber-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <span className="text-2xl p-1.5 rounded-lg bg-amber-500/10">🎣</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs sm:text-sm truncate">Wędkarskie</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1 font-semibold shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Żona nie widzi
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Wędki, kołowrotki, pontony
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleNicheChange('baby')}
            className={cn(
              "flex items-center gap-2.5 py-3 px-3.5 rounded-xl text-left transition-all",
              activeNiche === 'baby'
                ? "bg-background text-foreground shadow-sm border border-border/80 ring-1 ring-pink-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <span className="text-2xl p-1.5 rounded-lg bg-pink-500/10">👶</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs sm:text-sm truncate">Maluch & Mama</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1 font-semibold shrink-0 bg-pink-500/10 text-pink-600 border-pink-500/30">
                  Perełki
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Pieluszki, wózki, zabawki
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleNicheChange('legacy')}
            className={cn(
              "flex items-center gap-2.5 py-3 px-3.5 rounded-xl text-left transition-all",
              activeNiche === 'legacy'
                ? "bg-background text-foreground shadow-sm border border-border/80 ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <span className="text-2xl p-1.5 rounded-lg bg-slate-500/10">🌐</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs sm:text-sm truncate">Wieloplatformowe</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1 shrink-0">
                  Multi
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Instagram, Twitter, Szablony
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Niche Content Panels */}
      <div className="pt-2">
        {activeNiche === 'general' && <GeneralAutopilotPanel />}
        {activeNiche === 'fishing' && <FishingAutopilotPanel />}
        {activeNiche === 'baby' && <BabyAutopilotPanel />}
        {activeNiche === 'legacy' && <MultiPlatformSocialTab />}
      </div>
    </div>
  );
}

export default function SocialMediaAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Ładowanie Centrum Social Media...</p>
        </div>
      }
    >
      <SocialMediaHubContent />
    </Suspense>
  );
}

