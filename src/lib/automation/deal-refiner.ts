import { adminDb } from '@/lib/firebase-admin';
import { DealM6, RefinerJob, LocalizedText } from '@/lib/types';
import { enrichDeal } from '@/ai/flows/deal-enrichment';
import { ensureLocalizedTitle } from '@/ai/flows/translation';

/**
 * Deal Refiner - Enriches Deal documents with AI-generated content
 * - Translates deal titles and descriptions to PL/EN/DE/FR/ES/UK
 * - Generates offer-specific selling points (e.g., "Fast shipping from X", "Cashback available")
 * - Creates review summaries specific to this seller/deal
 * - Extracts key offer metrics
 * 
 * Unlike ProductCore (immutable product specs), Deal is mutable and source-specific,
 * so refinement focuses on how the offer is presented to users across languages.
 */
export class DealRefiner {
  private jobId: string;
  private logs: RefinerJob['logs'] = [];

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string, details?: any) {
    let serializedDetails = undefined;
    if (details) {
      if (details instanceof Error) {
        serializedDetails = { message: details.message, stack: details.stack };
      } else if (typeof details === 'object') {
        try {
          serializedDetails = JSON.parse(JSON.stringify(details));
        } catch {
          serializedDetails = String(details);
        }
      } else {
        serializedDetails = details;
      }
    }
    this.logs.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      details: serializedDetails,
    } as any);
    console.log(`[DealRefiner] [${level.toUpperCase()}] ${message}`, details || '');
  }

  /**
   * Main entry: Refine all deals that have missing translations
   * (i.e., deals with incomplete localization or plain string titles)
   */
  async refineNewDeals(limit: number = 50): Promise<RefinerJob> {
    const jobStartTime = new Date().toISOString();
    let dealsSuccessful = 0;
    let dealsFailed = 0;
    const processedIds: string[] = [];

    try {
      this.addLog('info', `Starting Deal Refiner job: limit=${limit}`);

      // Find deals that need refinement:
      // - Status is 'draft' (newly harvested deals awaiting moderation + enrichment)
      // - title is missing OR
      // - title lacks 'pl' field (Polish translation missing - CRITICAL!)
      const dealsSnapshot = await adminDb
        .collection('deals')
        .where('status', '==', 'draft')
        .limit(limit)
        .get();

      const totalDeals = dealsSnapshot.docs.length;
      this.addLog('info', `Found ${totalDeals} deals to process`);

      let skipped = 0;

      for (const dealDoc of dealsSnapshot.docs) {
        const deal = dealDoc.data() as DealM6;
        
        // Check if deal needs refinement
        const needsRefinement = this.dealNeedsRefinement(deal);
        
        if (!needsRefinement) {
          this.addLog('info', `Deal ${dealDoc.id} already fully refined, skipping`);
          skipped++;
          continue;
        }

        try {
          const refined = await this.refineSingleDeal(deal, dealDoc.id);
          
          if (refined) {
            await dealDoc.ref.update(refined);
            dealsSuccessful++;
            processedIds.push(dealDoc.id);
            this.addLog('info', `Refined deal ${dealDoc.id}`);
          }
        } catch (err) {
          dealsFailed++;
          this.addLog('error', `Failed to refine deal ${dealDoc.id}`, err);
        }
      }

      const job: RefinerJob = {
        id: this.jobId,
        status: 'completed',
        startedAt: jobStartTime,
        completedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        logs: this.logs,
      } as any;

      this.addLog('info', `Deal Refinement completed: ${dealsSuccessful} refined, ${dealsFailed} failed, ${skipped} skipped`);
      return job;
    } catch (err) {
      this.addLog('error', 'Deal refinement job failed', err);
      throw err;
    }
  }

  /**
   * Refine specific deals by ID (used for post-harvest auto-enrichment)
   */
  async refineDeals(dealIds: string[]): Promise<RefinerJob> {
    const jobStartTime = new Date().toISOString();
    let dealsSuccessful = 0;
    let dealsFailed = 0;
    let dealsSkipped = 0;
    const processedIds: string[] = [];

    try {
      this.addLog('info', `Starting targeted Deal Refiner job for ${dealIds.length} deals`);

      for (const dealId of dealIds) {
        try {
          const dealDoc = await adminDb.collection('deals').doc(dealId).get();
          if (!dealDoc.exists) {
            this.addLog('warn', `Deal ${dealId} not found, skipping`);
            dealsSkipped++;
            continue;
          }

          const deal = dealDoc.data() as DealM6;

          if (!this.dealNeedsRefinement(deal)) {
            dealsSkipped++;
            this.addLog('info', `Deal ${dealId} already localized, skipping`);
            continue;
          }

          const refined = await this.refineSingleDeal(deal, dealId);
          if (refined) {
            await dealDoc.ref.update(refined);
            dealsSuccessful++;
            processedIds.push(dealId);
          } else {
            dealsSkipped++;
          }
        } catch (err) {
          dealsFailed++;
          this.addLog('error', `Failed to refine deal ${dealId}`, err);
        }
      }

      const completedAt = new Date().toISOString();
      const job: RefinerJob = {
        id: this.jobId,
        status: 'completed',
        productIds: dealIds, // Reuse field for traceability
        refinationType: 'deal_enrichment' as any,
        productsProcessed: dealIds.length,
        productsSuccessful: dealsSuccessful,
        productsFailed: dealsFailed,
        startedAt: jobStartTime,
        completedAt,
        lastUpdatedAt: completedAt,
        logs: this.logs,
      };

      this.addLog('info', `Targeted Deal Refiner finished: ${dealsSuccessful} refined, ${dealsFailed} failed, ${dealsSkipped} skipped`);
      return job;
    } catch (err) {
      this.addLog('error', 'Targeted Deal Refiner job failed', err);
      throw err;
    }
  }

  /**
   * Check if a deal needs refinement
   * Criteria:
   * - title is not localized (plain string)
   * - title is missing Polish translation (title.pl)
  * - title lacks English, German, French, Spanish, or Ukrainian translations
   */
  private dealNeedsRefinement(deal: DealM6): boolean {
    // If title is a plain string (old format), needs refinement
    if (typeof deal.title === 'string') {
      return true;
    }

    // If title is an object, check for missing languages
    if (typeof deal.title === 'object' && deal.title) {
      // CRITICAL: Always refine if Polish is missing
      if (!deal.title.pl) {
        return true;
      }
      // Also refine if missing English, German, French, Spanish, or Ukrainian
      if (!deal.title.en || !deal.title.de || !deal.title.fr || !deal.title.es || !deal.title.uk) {
        return true;
      }
    }

    // If title is missing completely, needs refinement
    if (!deal.title) {
      return true;
    }

    // Description must be localized (PL/EN/DE/FR/ES/UK). String or missing fields -> refine
    if (!deal.description) {
      return true;
    }
    if (typeof deal.description === 'string') {
      return true;
    }
    if (typeof deal.description === 'object' && deal.description) {
      if (!deal.description.pl || !deal.description.en || !deal.description.de || !deal.description.fr || !deal.description.es || !deal.description.uk) {
        return true;
      }
    }

    // Selling points should exist for UI (metadata.sellingPoints)
    const sellingPoints = (deal.metadata as any)?.sellingPoints;
    if (!sellingPoints || !sellingPoints.pl || !sellingPoints.en || !sellingPoints.de || !sellingPoints.fr || !sellingPoints.es || !sellingPoints.uk) {
      return true;
    }

    // Deal is fully refined
    return false;
  }

  /**
   * Refine a single deal:
   * 1. ENSURE Polish title exists (critical!)
  * 2. Ensure title is localized (PL/EN/DE/FR/ES/UK)
   * 3. Generate seller-specific selling points
   * 4. Create offer summary (combining merchant rating + deal type)
   */
  private async refineSingleDeal(
    deal: DealM6,
    dealId: string
  ): Promise<Partial<DealM6> | null> {
    const refined: Partial<DealM6> = {};

    // Step 0: Ensure we have a Polish title (this is CRITICAL)
    // Extract whatever we have and ensure Polish exists
    let titlePL = '';
    let titleEN = '';
    let titleDE = '';
    let titleFR = '';
    let titleES = '';
    let titleUK = '';

    if (typeof deal.title === 'object' && deal.title) {
      titlePL = deal.title.pl || '';
      titleEN = deal.title.en || '';
      titleDE = deal.title.de || '';
      titleFR = deal.title.fr || '';
      titleES = deal.title.es || '';
      titleUK = deal.title.uk || '';
    } else if (typeof deal.title === 'string') {
      // Old format: title is a plain string - treat as Polish fallback
      titlePL = deal.title;
      titleEN = deal.title;
      titleDE = deal.title;
      titleFR = deal.title;
      titleES = deal.title;
      titleUK = deal.title;
    }

    // If we somehow have nothing, skip
    if (!titlePL && !titleEN && !titleDE && !titleFR && !titleES && !titleUK) {
      this.addLog('warn', `Deal ${dealId} has no extractable title, skipping`);
      return null;
    }

    // Use whatever is available as base for refinement (prefer Polish)
    const titleForAI = titlePL || titleEN || titleDE || titleFR || titleES || titleUK;
    const sourceLocale = deal.source === 'aliexpress' || deal.source === 'amazon' ? 'en' : 'pl';

    // Step 1: Call AI to translate and enhance
    try {
      const enriched = await this.generateDealEnrichment({
        dealTitle: titleForAI,
        sourceLocale,
        merchantName: deal.merchantName || deal.source,
        merchantRating: deal.merchantRating || 0,
        dealType: deal.dealType || 'regular',
        source: deal.source,
        price: deal.price.amount,
        shippingCost: deal.shipping.cost,
        shippingDays: deal.shipping.timeDays,
      });

      if (enriched) {
        // Ensure title is fully localized with guaranteed Polish
        // Priority: explicit > enriched > fallback
        const fullyLocalizedTitle = ensureLocalizedTitle({
          pl: titlePL || enriched.titlePL || titleForAI, // CRITICAL: Always have Polish
          en: titleEN || enriched.titleEN || titleForAI,
          de: titleDE || enriched.titleDE || titleForAI,
          fr: titleFR || enriched.titleFR || titleForAI,
          es: titleES || enriched.titleES || titleForAI,
          uk: titleUK || enriched.titleUK || titleForAI,
        });

        refined.title = fullyLocalizedTitle as LocalizedText;

        this.addLog('info', `Deal ${dealId} title localized: PL="${fullyLocalizedTitle.pl}" EN="${fullyLocalizedTitle.en}" DE="${fullyLocalizedTitle.de}" FR="${fullyLocalizedTitle.fr}" ES="${fullyLocalizedTitle.es}" UK="${fullyLocalizedTitle.uk}"`);

        // Store AI-generated selling points for UI display
        if (enriched.sellingPoints) {
          refined.metadata = {
            ...(deal.metadata || {}),
            sellingPoints: {
              pl: enriched.sellingPoints.pl || [],
              en: enriched.sellingPoints.en || [],
              de: enriched.sellingPoints.de || [],
              fr: enriched.sellingPoints.fr || [],
              es: enriched.sellingPoints.es || [],
              uk: enriched.sellingPoints.uk || [],
            },
          };
        }

        // Store rich description (HTML formatted)
        if (enriched.description) {
          refined.description = enriched.description as LocalizedText;
        }

        // Store highlights
        if (enriched.highlights) {
          if (!refined.metadata) {
            refined.metadata = deal.metadata || {};
          }
          refined.metadata = {
            ...refined.metadata,
            highlights: {
              pl: enriched.highlights.pl || [],
              en: enriched.highlights.en || [],
              de: enriched.highlights.de || [],
              fr: enriched.highlights.fr || [],
              es: enriched.highlights.es || [],
              uk: enriched.highlights.uk || [],
            },
          };
        }

        // Store offer summary
        if (enriched.offerSummary) {
          if (!refined.metadata) {
            refined.metadata = deal.metadata || {};
          }
          refined.metadata = {
            ...refined.metadata,
            offerSummary: enriched.offerSummary as { pl: string; en: string; de: string; fr: string; es: string; uk: string },
          };
        }
      }

      return Object.keys(refined).length > 0 ? refined : null;
    } catch (err) {
      this.addLog('error', `AI enrichment failed for deal ${dealId}`, err);
      return null;
    }
  }

  /**
   * Call enrichment flow to generate deal enrichment:
   * - Translate title to EN/DE
   * - Generate seller-specific selling points
   * - Create short offer summary
   */
  private async generateDealEnrichment(context: {
    dealTitle: string;
    sourceLocale?: string;
    merchantName: string;
    merchantRating: number;
    dealType: string;
    source: string;
    price: number;
    shippingCost: number;
    shippingDays: number;
  }) {
    try {
      return await enrichDeal(context);
    } catch (err) {
      this.addLog('error', 'Deal enrichment failed', err);
      return null;
    }
  }
}

/**
 * Helper: start deal refiner for specific deal IDs
 */
export async function startDealRefinerJob(dealIds: string[]): Promise<RefinerJob> {
  const jobId = `deal_refiner_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const refiner = new DealRefiner(jobId);
  return await refiner.refineDeals(dealIds);
}
