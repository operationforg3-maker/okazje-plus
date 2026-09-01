/**
 * TradeTracker Affiliate Link Builder & SubID / Reference Injector
 * 
 * Handles formatting and tagging of TradeTracker tracking links:
 * - TradeTracker standard tracking format:
 *   https://tc.tradetracker.net/?c={campaignID}&m={materialID}&a={affiliateSiteID}&r={reference/subID}&u={encodedDestinationUrl}
 * 
 * - Injects SubID / reference (`r`) for conversion tracking & attribution
 * - Supports wrapping raw merchant URLs if campaign ID & affiliateSiteId are configured
 */

export interface TradeTrackerTrackingOptions {
  campaignId?: string;
  materialId?: string;
  affiliateSiteId?: string;
  reference?: string;
}

/**
 * Ensures a TradeTracker link has our affiliateSiteId and SubID/reference (`r`) attached
 */
export function buildTradeTrackerTrackingLink(
  rawUrl: string,
  reference?: string,
  options?: TradeTrackerTrackingOptions
): string {
  if (!rawUrl) return '';

  const siteId = options?.affiliateSiteId || process.env.TRADETRACKER_SITE_ID || '';
  const ref = reference || options?.reference || '';

  // 1. If link is already a TradeTracker redirect link
  if (rawUrl.includes('tc.tradetracker.net')) {
    try {
      const parsed = new URL(rawUrl);

      // Ensure affiliateSiteId ('a') is populated if missing
      if (siteId && (!parsed.searchParams.get('a') || parsed.searchParams.get('a') === '')) {
        parsed.searchParams.set('a', siteId);
      }

      // Inject or replace SubID / reference ('r')
      if (ref) {
        parsed.searchParams.set('r', ref);
      }

      return parsed.toString();
    } catch {
      // Fallback string manipulation if URL parsing fails
      if (ref && !rawUrl.includes('r=')) {
        const sep = rawUrl.includes('?') ? '&' : '?';
        return `${rawUrl}${sep}r=${encodeURIComponent(ref)}`;
      }
      return rawUrl;
    }
  }

  // 2. If raw merchant URL and we have explicit campaignId and siteId
  const campaignId = options?.campaignId || process.env.TRADETRACKER_DEFAULT_CAMPAIGN_ID;
  const materialId = options?.materialId || '12'; // Default text link material ID in TradeTracker

  if (campaignId && siteId) {
    const params = new URLSearchParams({
      c: campaignId,
      m: materialId,
      a: siteId,
    });
    if (ref) {
      params.set('r', ref);
    }
    params.set('u', rawUrl);

    return `https://tc.tradetracker.net/?${params.toString()}`;
  }

  // Return unchanged if no transformation possible
  return rawUrl;
}
