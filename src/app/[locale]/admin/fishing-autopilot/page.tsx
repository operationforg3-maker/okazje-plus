'use client';

import { FishingAutopilotPanel } from '@/components/admin/fishing/fishing-autopilot-panel';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Share2, ArrowRight } from 'lucide-react';

export default function FishingAutopilotAdminPage() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl px-4 sm:px-6">
      {/* Banner linking to unified hub */}
      <div className="bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent p-3.5 rounded-xl border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Share2 className="w-4 h-4 text-primary shrink-0" />
          <span>
            Ten moduł jest teraz zintegrowany w <strong>Zintegrowanym Centrum Social Media & Autopilot Hub</strong> wraz z profilem ogólnym i dziecięcym.
          </span>
        </div>
        <Button size="sm" variant="outline" asChild className="h-7 text-xs font-semibold shrink-0">
          <Link href="/admin/social-media?niche=fishing">
            Otwórz w Hubie <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      <FishingAutopilotPanel />
    </div>
  );
}
