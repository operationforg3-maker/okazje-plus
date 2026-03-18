import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductWithDeals } from '@/lib/data';
import { generateVideoObjectJsonLd } from '@/lib/json-ld-generators';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

const BASE_URL = 'https://okazjeplus.pl';

function toAbsoluteHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function getLocalizedText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const candidate = localized.pl || localized.en || localized.de;
    if (typeof candidate === 'string') return candidate;
  }
  return fallback;
}

function extractVideoUrl(product: any): string | null {
  const direct = [
    product?.videoUrl,
    product?.productVideoUrl,
    product?.product_video_url,
  ];

  for (const candidate of direct) {
    const resolved = toAbsoluteHttpUrl(candidate);
    if (resolved) return resolved;
  }

  const gallery = Array.isArray(product?.gallery) ? product.gallery : [];
  for (const item of gallery) {
    if (item?.type === 'VIDEO') {
      const resolved = toAbsoluteHttpUrl(item?.url);
      if (resolved) return resolved;
    }
  }

  return null;
}

function extractThumbnailUrl(product: any): string | null {
  const direct = [
    Array.isArray(product?.images) ? product.images[0] : null,
    product?.image,
  ];

  for (const candidate of direct) {
    const resolved = toAbsoluteHttpUrl(candidate);
    if (resolved) return resolved;
  }

  const gallery = Array.isArray(product?.gallery) ? product.gallery : [];
  for (const item of gallery) {
    const resolved = toAbsoluteHttpUrl(item?.thumbnail || item?.url);
    if (resolved) return resolved;
  }

  return null;
}

async function getWatchData(id: string) {
  const data = await getProductWithDeals(id);
  if (!data?.product) return null;

  const product = data.product;
  if (product.status && product.status !== 'approved') return null;

  const videoUrl = extractVideoUrl(product);
  if (!videoUrl) return null;

  const thumbnailUrl = extractThumbnailUrl(product);
  if (!thumbnailUrl) return null;

  const name = getLocalizedText(product.title, 'Wideo produktu');
  const rawDescription = getLocalizedText(product.description, '')
    || getLocalizedText(product.shortDescription, '')
    || `Wideo prezentujące produkt ${name}.`;
  const description = rawDescription.slice(0, 500);

  const uploadDate = String(product.updatedAt || product.createdAt || new Date().toISOString());

  return {
    id,
    productName: name,
    description,
    videoUrl,
    thumbnailUrl,
    uploadDate,
    productPath: `/pl/products/${id}`,
    watchPath: `/pl/watch/products/${id}`,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;

  if (locale !== 'pl') {
    return {
      robots: { index: false, follow: false },
      alternates: { canonical: `${BASE_URL}/pl/watch/products/${id}` },
    };
  }

  const data = await getWatchData(id);
  if (!data) {
    return {
      title: 'Wideo produktu niedostępne | Okazje Plus',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${data.productName} - wideo | Okazje Plus`,
    description: data.description,
    alternates: {
      canonical: `${BASE_URL}${data.watchPath}`,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: 'video.other',
      url: `${BASE_URL}${data.watchPath}`,
      title: `${data.productName} - wideo`,
      description: data.description,
      images: [data.thumbnailUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.productName} - wideo`,
      description: data.description,
      images: [data.thumbnailUrl],
    },
  };
}

export default async function ProductWatchPage({ params }: PageProps) {
  const { locale, id } = await params;

  if (locale !== 'pl') {
    notFound();
  }

  const data = await getWatchData(id);
  if (!data) {
    notFound();
  }

  const videoJsonLd = generateVideoObjectJsonLd({
    id: data.id,
    name: data.productName,
    description: data.description,
    thumbnailUrl: data.thumbnailUrl,
    contentUrl: data.videoUrl,
    watchPath: data.watchPath,
    uploadDate: data.uploadDate,
  });

  return (
    <main className="page-container py-6 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">{data.productName} - wideo produktu</h1>
          <p className="text-muted-foreground">{data.description}</p>
        </div>

        <div className="rounded-xl overflow-hidden border bg-black">
          <video
            className="w-full h-auto"
            controls
            preload="metadata"
            poster={data.thumbnailUrl}
            src={data.videoUrl}
          >
            Twoja przeglądarka nie obsługuje odtwarzania wideo.
          </video>
        </div>

        <div>
          <Link href={data.productPath} className="text-primary hover:underline">
            Wroc do strony produktu
          </Link>
        </div>
      </div>
    </main>
  );
}
