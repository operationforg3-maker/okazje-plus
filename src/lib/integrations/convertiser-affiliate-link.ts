import convertiserMap from './convertiser-merchant-map.json';

interface MerchantMapEntry {
  title: string;
  trackingLink: string;
  domain: string;
}

const mapData = convertiserMap as Record<string, MerchantMapEntry>;

/**
 * Transforms a raw merchant URL or offer link into an official Convertiser tracking deep link.
 * Format: https://converti.se/click/<CAMPAIGN_CODE>/?url=<ENCODED_URL>
 */
export function buildConvertiserTrackingLink(
  rawUrl: string,
  merchantName?: string
): string {
  if (!rawUrl) return '';

  // If link is already converti.se with ?url=, convert ?url= to ?deep_link=
  if (rawUrl.includes('converti.se/click/') && rawUrl.includes('?url=')) {
    return rawUrl.replace('?url=', '?deep_link=').replace('&url=', '&deep_link=');
  }

  // If already an official converti.se tracking link with deep_link, return as is
  if (rawUrl.startsWith('https://converti.se/click/') || rawUrl.startsWith('https://tracking.convertiser.com/')) {
    return rawUrl;
  }

  // Extract domain from rawUrl
  let domain = '';
  try {
    const parsed = new URL(rawUrl);
    domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {}

  // Try matching by domain first, then by merchantName
  let entry: MerchantMapEntry | undefined = domain ? mapData[domain] : undefined;
  if (!entry && merchantName) {
    const key = merchantName.toLowerCase().trim();
    entry = mapData[key];
  }

  if (!entry || !entry.trackingLink) {
    // If no campaign match found, return rawUrl cleanly
    return rawUrl;
  }

  const baseTrackingLink = entry.trackingLink.endsWith('/')
    ? entry.trackingLink
    : `${entry.trackingLink}/`;

  // Strip existing broken cvrid or affiliate params from target URL
  let targetUrl = rawUrl;
  targetUrl = targetUrl.replace(/([?&])cvrid=CVR[.\s]*/gi, '');
  targetUrl = targetUrl.replace(/[?&]&+/g, '&').replace(/\?&/g, '?').replace(/[?&]$/, '');
  targetUrl = targetUrl.replace(/\.{3,}$/, '');

  // Construct official Convertiser deep link with deep_link parameter
  return `${baseTrackingLink}?deep_link=${encodeURIComponent(targetUrl)}`;
}
