export function getExternalUrl(...candidates: Array<string | null | undefined>): string | null {
  const rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  const internalHosts = new Set<string>([
    'okazjeplus.pl',
    'okazje-plus-backend--okazje-plus.europe-west4.hosted.app',
    'localhost',
  ]);

  if (rawSiteUrl) {
    try {
      internalHosts.add(new URL(rawSiteUrl).hostname);
    } catch {
      // ignore invalid site url
    }
  }

  const normalizeCandidate = (candidate: string): string | null => {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('/')) return null;
    if (/^(javascript|data|mailto|tel):/i.test(trimmed)) return null;

    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      return null;
    }

    if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return null;
  };

  let fallbackCandidate: string | null = null;

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(String(candidate || ''));
    const url = normalized || '';
    if (!url) continue;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (internalHosts.has(host) || host.endsWith('.okazjeplus.pl')) {
        continue;
      }

      // Demote generic AliExpress shortlinks that redirect to best.aliexpress.com
      if (
        (host.includes('aliexpress.com') && (parsed.pathname.startsWith('/s/') || host.startsWith('best.')))
      ) {
        if (!fallbackCandidate) {
          fallbackCandidate = parsed.toString();
        }
        continue;
      }

      return parsed.toString();
    } catch {
      continue;
    }
  }

  return fallbackCandidate;
}

/**
 * Intelligent outbound URL resolver for deals.
 * If the deal points to a generic AliExpress campaign landing page (best.aliexpress.com)
 * but has a real product ID, it automatically generates a direct affiliate deep link to the product!
 */
export function getDealExternalUrl(deal: any, product?: any): string | null {
  if (!deal) return null;

  const aliId =
    deal.sourceProductId ||
    deal.metadata?.originalId ||
    deal.externalOriginalId ||
    (deal as any)?.productCoreId ||
    product?.externalId ||
    product?.metadata?.originalId;

  const rawLink = String(deal.link || deal.affiliateLink || deal.dealUrl || deal.sourceUrl || '');
  const isGenericAliLink =
    rawLink.includes('s.click.aliexpress.com/s/') ||
    rawLink.includes('best.aliexpress.com');

  // If link leads to generic best.aliexpress.com and we have a numeric item ID, generate deep link to item
  if (isGenericAliLink && aliId && /^\d+$/.test(String(aliId))) {
    return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=_pz9sEiR&dl_target_url=${encodeURIComponent(`https://pl.aliexpress.com/item/${aliId}.html`)}`;
  }

  const resolved = getExternalUrl(
    deal.link,
    deal.affiliateLink,
    deal.affiliateUrl,
    deal.dealUrl,
    deal.sourceUrl,
    deal.url,
    deal.externalUrl,
    deal.metadata?.offerPreviewUrl,
    deal.metadata?.previewUrl,
    deal.metadata?.offerUrl,
    deal.metadata?.externalUrl,
    deal.metadata?.url,
    deal.product?.link,
    deal.product?.affiliateLink,
    deal.product?.sourceUrl,
    product?.sourceLinks?.[0]?.url,
    product?.sourceLinks?.[0]?.link
  );

  if (resolved && !resolved.includes('best.aliexpress.com') && !resolved.includes('s.click.aliexpress.com/s/')) {
    return resolved;
  }

  // Fallback to item deep link if product ID is available
  if (aliId && /^\d+$/.test(String(aliId))) {
    return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=_pz9sEiR&dl_target_url=${encodeURIComponent(`https://pl.aliexpress.com/item/${aliId}.html`)}`;
  }

  return resolved;
}

