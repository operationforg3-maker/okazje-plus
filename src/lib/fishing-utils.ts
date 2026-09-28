/**
 * Narzędzia pomocnicze dla Wędkarskiego Autopilota ("Żona nie widzi")
 * Obsługa linków afiliacyjnych, parametrów UTM i kampanii trackingowych (np. Fishing_2)
 */

/**
 * Dodaje tracking Fishing_2 / UTM / SubID / CustomID do linku
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
