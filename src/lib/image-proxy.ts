const PROXY_HOSTS = new Set([
  'imgproxy.convertiser.com',
  'static.convertiser.com',
  'convertiser.com',
  'media.convertiser.com',
  'images.unsplash.com',
  'picsum.photos',
  'cdn.mediaexpert.pl',
  'images.morele.net',
  'cdna.empik.com',
]);

export function withImageProxy(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  
  // Convert protocol-relative URLs to https
  let processedUrl = url;
  if (processedUrl.startsWith('//')) {
    processedUrl = `https:${processedUrl}`;
  }

  try {
    const parsed = new URL(processedUrl);
    if (parsed.protocol === 'https:' && PROXY_HOSTS.has(parsed.hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(parsed.toString())}`;
    }
  } catch {
    return processedUrl;
  }

  return processedUrl;
}

export function isAliExpressImage(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('aliexpress-media.com') || parsed.hostname.includes('alicdn.com');
  } catch {
    return false;
  }
}
