import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'imgproxy.convertiser.com',
  'static.convertiser.com',
  'images.unsplash.com',
  'picsum.photos',
  'ae-pic-a1.aliexpress-media.com',
]);

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');

  if (!urlParam) {
    return new NextResponse('Missing url', { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'OkazjePlusImageProxy/1.0',
      },
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!upstream.ok) {
      return new NextResponse('Upstream error', { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse('Proxy error', { status: 502 });
  }
}
