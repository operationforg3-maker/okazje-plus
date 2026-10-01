/**
 * Narzędzia pomocnicze dla Wędkarskiego Autopilota ("Żona nie widzi")
 * Obsługa linków afiliacyjnych, parametrów UTM i kampanii trackingowych (np. Fishing_2)
 */

import { buildTradeTrackerTrackingLink } from '@/lib/integrations/tradetracker-affiliate-link';
import { buildConvertiserTrackingLink } from '@/lib/integrations/convertiser-affiliate-link';

/**
 * Dodaje podstawowy tracking Fishing_2 / UTM / SubID / CustomID do linku
 */
export function applyFishingTracking(rawUrl: string, campaign = 'Fishing_2'): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);

    // TradeTracker tracking link
    if (url.hostname.includes('tradetracker.net')) {
      url.searchParams.set('r', campaign);
      return url.toString();
    }

    // Convertiser tracking link
    if (url.hostname.includes('converti.se') || url.hostname.includes('convertiser.com')) {
      url.searchParams.set('custom_id', campaign);
      return url.toString();
    }

    // AliExpress
    if (url.hostname.includes('aliexpress.com')) {
      url.searchParams.set('sub_id', campaign);
      url.searchParams.set('tracking_id', campaign);
      url.searchParams.set('sub', campaign);
    }

    // Parametry UTM dla linków portalu i sklepów
    if (!url.searchParams.has('utm_campaign')) {
      url.searchParams.set('utm_campaign', campaign);
    }
    if (!url.searchParams.has('utm_source')) {
      url.searchParams.set('utm_source', 'facebook');
    }
    if (!url.searchParams.has('utm_medium')) {
      url.searchParams.set('utm_medium', 'social');
    }

    return url.toString();
  } catch {
    const sep = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${sep}utm_campaign=${encodeURIComponent(campaign)}&utm_source=facebook&utm_medium=social`;
  }
}

/**
 * Rozwiązuje bezpośredni link do partnera z pełnym kodem afiliacyjnym i SubID (np. Fishing_2).
 * Prowadzi prosto do sklepu/produktu (AliExpress, Convertiser, TradeTracker), a NIE do portalu.
 */
import { resolveUnifiedAffiliateUrl } from '@/lib/affiliate-links';

export function resolveFishingAffiliateUrl(deal: any, campaign = 'Fishing_2'): string {
  return resolveUnifiedAffiliateUrl(deal, campaign);
}

/**
 * Pomocnicze rozpoznawanie linku ze stringa URL
 */
function resolveAffiliateUrlFromString(rawUrl: string, campaign: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // AliExpress
  if (trimmed.includes('aliexpress.com') || trimmed.includes('s.click.aliexpress.com')) {
    const match = trimmed.match(/item\/(\d+)\.html/) || 
                  trimmed.match(/\/(\d+)\.html/) ||
                  trimmed.match(/productId=(\d+)/) ||
                  trimmed.match(/id=(\d+)/);
    if (match && match[1]) {
      const targetUrl = `https://pl.aliexpress.com/item/${match[1]}.html`;
      return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=_pz9sEiR&dl_target_url=${encodeURIComponent(targetUrl)}&sub=${encodeURIComponent(campaign)}`;
    }
    if (trimmed.includes('s.click.aliexpress.com')) {
      try {
        const u = new URL(trimmed);
        u.searchParams.set('sub', campaign);
        return u.toString();
      } catch {
        const sep = trimmed.includes('?') ? '&' : '?';
        return `${trimmed}${sep}sub=${encodeURIComponent(campaign)}`;
      }
    }
    return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=_pz9sEiR&dl_target_url=${encodeURIComponent(trimmed)}&sub=${encodeURIComponent(campaign)}`;
  }

  // TradeTracker
  if (trimmed.includes('tradetracker.net')) {
    return buildTradeTrackerTrackingLink(trimmed, campaign, {
      affiliateSiteId: process.env.TRADETRACKER_SITE_ID,
    });
  }

  // Convertiser
  if (trimmed.includes('converti.se') || trimmed.includes('tracking.convertiser.com')) {
    return applyFishingTracking(trimmed, campaign);
  }

  // Sprawdź w Convertiser map
  const cvLink = buildConvertiserTrackingLink(trimmed);
  if (cvLink && cvLink.includes('converti.se/click/')) {
    return applyFishingTracking(cvLink, campaign);
  }

  return applyFishingTracking(trimmed, campaign);
}
