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

  for (const candidate of candidates) {
    const url = String(candidate || '').trim();
    if (!url) continue;
    if (url.startsWith('/')) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (internalHosts.has(host) || host.endsWith('.okazjeplus.pl')) {
        continue;
      }
      return url;
    } catch {
      continue;
    }
  }

  return null;
}
