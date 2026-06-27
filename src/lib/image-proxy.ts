const PROXY_HOSTS = new Set([
  'imgproxy.convertiser.com',
  'static.convertiser.com',
  'images.unsplash.com',
  'picsum.photos',
  'ae-pic-a1.aliexpress-media.com',
  'ae-pic-a2.aliexpress-media.com',
  'ae-pic-a3.aliexpress-media.com',
  'ae01.alicdn.com',
  'ae02.alicdn.com',
]);

export function withImageProxy(url?: string): string {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && PROXY_HOSTS.has(parsed.hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(parsed.toString())}`;
    }
  } catch {
    return url;
  }

  return url;
}
