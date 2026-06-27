import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
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
      // Limit size to prevent OOM; imgproxy will resize
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return new NextResponse('Upstream error', { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = await upstream.arrayBuffer();

    // Return early if buffer is already small (<100KB, likely already optimized)
    if (buffer.byteLength < 100 * 1024) {
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // For large images (> 100KB), use imgproxy server for optimization
    const width = request.nextUrl.searchParams.get('w') || '400';
    const height = request.nextUrl.searchParams.get('h') || '300';
    const format = request.nextUrl.searchParams.get('f') || 'auto'; // auto, avif, webp, jpeg
    const quality = request.nextUrl.searchParams.get('q') || '60'; // 60 for mobile, 75 for desktop

    // Use imgproxy endpoint if available
    const imgproxyUrl = `https://imgproxy.convertiser.com/resize:fit:${width}:${height}:false/quality:${quality}/format:${format}/${Buffer.from(urlParam).toString('base64')}`;

    try {
      const optimized = await fetch(imgproxyUrl, {
        cache: 'force-cache',
        next: { revalidate: 60 * 60 * 24 },
        signal: AbortSignal.timeout(5000),
      });

      if (optimized.ok) {
        const optimizedBuffer = await optimized.arrayBuffer();
        const optimizedType = optimized.headers.get('content-type') || 'image/jpeg';
        return new NextResponse(optimizedBuffer, {
          status: 200,
          headers: {
            'Content-Type': optimizedType,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
    } catch (imgproxyErr) {
      // Fallback to original if imgproxy fails
      console.warn('imgproxy optimization failed, falling back to original:', imgproxyErr);
    }

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
