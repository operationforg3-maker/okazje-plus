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
      return parsed.toString();
    } catch {
      continue;
    }
  }

  return null;
}
