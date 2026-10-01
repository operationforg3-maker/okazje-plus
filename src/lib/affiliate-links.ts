/**
 * Centralny moduł formatowania, walidacji i skracania linków afiliacyjnych
 * dla wszystkich 3 sieci partnerskich:
 * 1. AliExpress (s.click.aliexpress.com deep link z kluczem _pz9sEiR)
 * 2. Convertiser (converti.se/click deep link wg mapy kampanii)
 * 3. TradeTracker (tc.tradetracker.net z subID r= oraz a=511688)
 */

import { buildConvertiserTrackingLink } from '@/lib/integrations/convertiser-affiliate-link';
import { buildTradeTrackerTrackingLink } from '@/lib/integrations/tradetracker-affiliate-link';

export const ALIEXPRESS_AFFILIATE_SHORT_KEY = '_pz9sEiR';
export const TRADETRACKER_DEFAULT_SITE_ID = process.env.TRADETRACKER_SITE_ID || '511688';

/**
 * Usuwa uszkodzone parametry tymczasowe (np. cvrid=CVR...... z API Convertiser)
 * oraz podwójne znaki zapytania / ampersandy.
 */
export function cleanDummyTrackingParams(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim();

  // Usuń cvrid=CVR... (kropki, spacje)
  cleaned = cleaned.replace(/([?&])cvrid=CVR[.\s]*/gi, '');
  // Usuń powielone & oraz wiszące ?/&
  cleaned = cleaned.replace(/[?&]&+/g, '&').replace(/\?&/g, '?').replace(/[?&]$/, '');
  // Usuń wiszące wielokropki na końcu linku
  cleaned = cleaned.replace(/\.{2,}$/, '');

  return cleaned;
}

/**
 * Ekstrahuje numeryczne ID produktu AliExpress z dowolnego linku lub obiektu.
 */
export function extractAliExpressProductId(raw: any): string | null {
  if (!raw) return null;

  if (typeof raw === 'object') {
    const candidate =
      raw.sourceProductId ||
      raw.productId ||
      raw.item_id ||
      raw.product_id ||
      raw.metadata?.originalId ||
      raw.externalOriginalId ||
      raw.productCoreId;
    if (candidate && /^\d{8,}$/.test(String(candidate).trim())) {
      return String(candidate).trim();
    }
  }

  const str = typeof raw === 'string' ? raw.trim() : String(raw.link || raw.dealUrl || raw.url || '');
  if (!str) return null;

  // Sprawdź czy sam string to ID
  if (/^\d{8,}$/.test(str)) {
    return str;
  }

  // Dopasowania regex URLi AliExpress
  const match =
    str.match(/item\/(\d{8,})\.html/) ||
    str.match(/\/(\d{8,})\.html/) ||
    str.match(/[?&]productId=(\d{8,})/i) ||
    str.match(/[?&]id=(\d{8,})/i);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Buduje czysty, krótki (~110-130 znaków) oficjalny deep link partnerski AliExpress.
 * Zamiast 1000-znakowego tokena sesyjnego (s.click.aliexpress.com/s/...),
 * generuje bezpośredni redirect do strony produktu z naliczaniem prowizji dla _pz9sEiR.
 */
export function buildAliExpressAffiliateLink(
  rawUrlOrId: string,
  subId: string = 'Okazje_1'
): string {
  if (!rawUrlOrId) return '';
  const trimmed = rawUrlOrId.trim();

  // 1. Ekstrakcja numerycznego ID produktu
  const aliId = extractAliExpressProductId(trimmed);
  if (aliId) {
    const directProductUrl = `https://pl.aliexpress.com/item/${aliId}.html`;
    return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${ALIEXPRESS_AFFILIATE_SHORT_KEY}&dl_target_url=${encodeURIComponent(directProductUrl)}&sub=${encodeURIComponent(subId)}`;
  }

  // 2. Jeśli to już poprawny deep link AliExpress
  if (trimmed.includes('s.click.aliexpress.com/deep_link.htm')) {
    try {
      const u = new URL(trimmed);
      if (!u.searchParams.get('aff_short_key')) {
        u.searchParams.set('aff_short_key', ALIEXPRESS_AFFILIATE_SHORT_KEY);
      }
      u.searchParams.set('sub', subId);
      return u.toString();
    } catch {
      return trimmed;
    }
  }

  // 3. Jeśli to standardowy URL aliexpress.com (nie zepsuty token /s/)
  if (trimmed.includes('aliexpress.com') && !trimmed.includes('s.click.aliexpress.com/s/')) {
    try {
      const cleanUrl = cleanDummyTrackingParams(trimmed);
      return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${ALIEXPRESS_AFFILIATE_SHORT_KEY}&dl_target_url=${encodeURIComponent(cleanUrl)}&sub=${encodeURIComponent(subId)}`;
    } catch {
      return trimmed;
    }
  }

  // 4. Jeśli to niestety stary 1000-znakowy s.click.aliexpress.com/s/... i nie dało się wyciągnąć ID
  if (trimmed.includes('s.click.aliexpress.com/s/')) {
    // Fallback: kieruj na główną AliExpress przez nasz klucz afiliacyjny, a nie gigantyczny token
    return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${ALIEXPRESS_AFFILIATE_SHORT_KEY}&dl_target_url=${encodeURIComponent('https://pl.aliexpress.com')}&sub=${encodeURIComponent(subId)}`;
  }

  return trimmed;
}

/**
 * Buduje zoptymalizowany link partnerski Convertiser
 * - Wykrywa zarejestrowane kampanie wg domeny lub nazwy sklepu
 * - Czyści uszkodzone parametry cvrid=CVR......
 * - Dokleja subid
 */
export function buildConvertiserAffiliateLink(
  rawUrl: string,
  merchantName?: string,
  subId: string = 'Okazje_1'
): string {
  if (!rawUrl) return '';
  const cleaned = cleanDummyTrackingParams(rawUrl);

  // Jeśli link to już converti.se/click/...
  if (cleaned.includes('converti.se/click/') || cleaned.includes('tracking.convertiser.com/')) {
    try {
      const u = new URL(cleaned);
      if (!u.searchParams.has('subid')) {
        u.searchParams.set('subid', subId);
      }
      return u.toString();
    } catch {
      return cleaned;
    }
  }

  // Sprawdź czy sklep jest w oficjalnej mapie Convertiser
  const cvLink = buildConvertiserTrackingLink(cleaned, merchantName);
  if (cvLink && cvLink.includes('converti.se/click/')) {
    try {
      const u = new URL(cvLink);
      if (!u.searchParams.has('subid')) {
        u.searchParams.set('subid', subId);
      }
      return u.toString();
    } catch {
      return cvLink;
    }
  }

  // Jeśli sklep nie ma aktywnej kampanii w Convertiser, zwróć wyczyszczony URL z UTM
  try {
    const urlObj = new URL(cleaned);
    if (!urlObj.searchParams.has('utm_campaign')) {
      urlObj.searchParams.set('utm_source', 'facebook');
      urlObj.searchParams.set('utm_medium', 'social');
      urlObj.searchParams.set('utm_campaign', subId);
    }
    return urlObj.toString();
  } catch {
    return cleaned;
  }
}

/**
 * Buduje poprawny link partnerski TradeTracker
 * - Zachowuje oryginalny docelowy URL w parametrze 'u'
 * - Nadaje subID w parametrze 'r'
 * - Zapewnia poprawny affiliateSiteId 'a'
 */
export function buildTradeTrackerAffiliateLink(
  rawUrl: string,
  subId: string = 'Okazje_1',
  customSiteId?: string
): string {
  if (!rawUrl) return '';
  const cleaned = cleanDummyTrackingParams(rawUrl);

  return buildTradeTrackerTrackingLink(cleaned, subId, {
    affiliateSiteId: customSiteId || TRADETRACKER_DEFAULT_SITE_ID,
  });
}

/**
 * Uniwersalny resolver linków afiliacyjnych dla postów, kolejek i deali.
 * Obsługuje obiekty Deal, rekordy kolejki oraz zwykłe stringi URL.
 */
export function resolveUnifiedAffiliateUrl(
  dealOrUrl: any,
  subId: string = 'Okazje_1'
): string {
  if (!dealOrUrl) return '';

  let targetUrl = '';
  let source = '';
  let merchant = '';
  let aliId: string | null = null;

  if (typeof dealOrUrl === 'string') {
    targetUrl = dealOrUrl.trim();
  } else if (dealOrUrl && typeof dealOrUrl === 'object') {
    targetUrl = (
      dealOrUrl.directAffiliateUrl ||
      dealOrUrl.affiliateUrl ||
      dealOrUrl.affiliateLink ||
      dealOrUrl.dealUrl ||
      dealOrUrl.link ||
      dealOrUrl.url ||
      dealOrUrl.rawLink ||
      ''
    ).trim();
    source = (dealOrUrl.source || '').toLowerCase();
    merchant = dealOrUrl.merchant || dealOrUrl.merchantName || '';
    aliId = extractAliExpressProductId(dealOrUrl);
  }

  if (!targetUrl && !aliId) return '';

  // 1. Sprawdzenie AliExpress
  const isAliExpress =
    Boolean(aliId) ||
    source.includes('aliexpress') ||
    targetUrl.includes('aliexpress.') ||
    targetUrl.includes('s.click.aliexpress.com');

  if (isAliExpress) {
    return buildAliExpressAffiliateLink(aliId || targetUrl, subId);
  }

  // 2. Sprawdzenie TradeTracker
  const isTradeTracker =
    source.includes('tradetracker') ||
    targetUrl.includes('tradetracker.net') ||
    targetUrl.includes('tc.trakker.pl');

  if (isTradeTracker && targetUrl) {
    return buildTradeTrackerAffiliateLink(targetUrl, subId);
  }

  // 3. Sprawdzenie Convertiser
  const isConvertiser =
    source.includes('convertiser') ||
    targetUrl.includes('converti.se') ||
    targetUrl.includes('tracking.convertiser.com') ||
    targetUrl.includes('cvrid=CVR');

  if (isConvertiser && targetUrl) {
    return buildConvertiserAffiliateLink(targetUrl, merchant, subId);
  }

  // 4. Inne sklepy zewnętrzne: próba dopasowania do sieci Convertiser
  if (targetUrl && !targetUrl.includes('okazjeplus.pl')) {
    const cvLink = buildConvertiserAffiliateLink(targetUrl, merchant, subId);
    if (cvLink.includes('converti.se/click/')) {
      return cvLink;
    }
  }

  // 5. Fallback link ogólny (czyszczenie dummy parametrów + UTM)
  try {
    const cleaned = cleanDummyTrackingParams(targetUrl);
    const urlObj = new URL(cleaned);
    if (!urlObj.searchParams.has('utm_campaign')) {
      urlObj.searchParams.set('utm_source', 'facebook');
      urlObj.searchParams.set('utm_medium', 'social');
      urlObj.searchParams.set('utm_campaign', subId);
    }
    return urlObj.toString();
  } catch {
    return cleanDummyTrackingParams(targetUrl);
  }
}
