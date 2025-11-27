import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { doc, getDoc, collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, ProductRating } from '@/lib/types';
import { getProductRatings } from '@/lib/data';
import ProductDetailClient from './product-detail-client';

// Force dynamic rendering dla real-time danych
export const dynamic = 'force-dynamic';
export const revalidate = 300; // ISR: revalidate co 5 minut

interface PageProps {
  params: { id: string; locale: string };
}

// Server-side data fetching
async function getProductData(id: string) {
  const docRef = doc(db, "products", id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const product = { id: docSnap.id, ...docSnap.data() } as Product;
  
  // Fetch related products from same subcategory
  const relatedQuery = query(
    collection(db, "products"),
    where("subCategorySlug", "==", product.subCategorySlug),
    where("status", "==", "approved"),
    limit(4)
  );
  const relatedSnap = await getDocs(relatedQuery);
  const relatedProducts = relatedSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Product))
    .filter(p => p.id !== id)
    .slice(0, 3);
  
  // Fetch recent ratings
  const recentRatings = await getProductRatings(id, 5);
  
  return { product, relatedProducts, recentRatings };
}

// SEO: Generate metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getProductData(params.id);
  
  if (!data) {
    return {
      title: 'Produkt nie znaleziony',
      description: 'Szukany produkt nie istnieje w naszej bazie.',
    };
  }
  
  const { product } = data;
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.price);
  const originalPrice = product.originalPrice 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.originalPrice)
    : null;
  const discount = product.discountPercent ? Math.round(product.discountPercent * 100) : null;
  
  // SEO title i description z AI lub fallback
  const metaTitle = product.metaTitle || product.seo?.metaTitle || `${product.name} - ${price} | Okazje Plus`;
  const metaDescription = product.metaDescription || product.seo?.metaDescription || product.description || `Kup ${product.name} w najlepszej cenie ${price}. ${product.ratingCard.count} ocen, średnia ${product.ratingCard.average.toFixed(1)}/5.0`;
  
  // Keywords z AI enrichment + SEO
  const keywords = [
    ...(product.seoKeywords || []),
    ...(product.seo?.keywords || []),
    ...(product.ai?.enrichment?.keywords || []),
    product.mainCategorySlug,
    product.subCategorySlug,
    product.subSubCategorySlug || '',
  ].filter(Boolean);
  
  const canonicalUrl = `https://okazje.plus/pl/products/${product.id}`;
  
  return {
    title: metaTitle,
    description: metaDescription.slice(0, 160),
    keywords: keywords.slice(0, 20).join(', '),
    authors: [{ name: 'Okazje Plus' }],
    openGraph: {
      title: metaTitle,
      description: metaDescription.slice(0, 160),
      url: canonicalUrl,
      siteName: 'Okazje Plus',
      locale: 'pl_PL',
      type: 'website',
      images: [
        {
          url: product.image,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDescription.slice(0, 160),
      images: [product.image],
    },
    alternates: {
      canonical: canonicalUrl,
    },
    other: {
      'product:price:amount': product.price.toString(),
      'product:price:currency': 'PLN',
      'product:availability': product.metadata?.stockStatus === 'in_stock' ? 'in stock' : 'out of stock',
      'product:condition': 'new',
      'product:brand': product.metadata?.merchant || 'Generic',
      ...(originalPrice && { 'product:original_price:amount': product.originalPrice?.toString() }),
      'og:price:amount': product.price.toString(),
      'og:price:currency': 'PLN',
    },
  };
}

// Optional: Generate static params for popular products
export async function generateStaticParams() {
  // Generuj dla top 100 produktów
  const productsRef = collection(db, "products");
  const q = query(
    productsRef,
    where("status", "==", "approved"),
    orderBy("ratingCard.count", "desc"),
    limit(100)
  );
  
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const data = await getProductData(params.id);
  
  if (!data) {
    notFound();
  }
  
  const { product, relatedProducts, recentRatings } = data;
  
  // JSON-LD structured data dla Google Rich Results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: product.metadata?.merchant || 'Generic',
    },
    offers: {
      '@type': 'Offer',
      url: `https://okazje.plus/pl/products/${product.id}`,
      priceCurrency: 'PLN',
      price: product.price,
      ...(product.originalPrice && { 
        priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }),
      availability: product.metadata?.stockStatus === 'in_stock' 
        ? 'https://schema.org/InStock'
        : product.metadata?.stockStatus === 'low_stock'
        ? 'https://schema.org/LimitedAvailability'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: product.metadata?.merchant || 'Various',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.ratingCard.average,
      reviewCount: product.ratingCard.count,
      bestRating: 5,
      worstRating: 1,
    },
    ...(product.ai?.enrichment?.features && {
      additionalProperty: product.ai.enrichment.features.slice(0, 10).map(feature => ({
        '@type': 'PropertyValue',
        name: 'Feature',
        value: feature,
      })),
    }),
  };
  
  return (
    <>
      {/* JSON-LD dla SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Client component z interaktywnym UI */}
      <ProductDetailClient 
        product={product}
        relatedProducts={relatedProducts}
        recentRatings={recentRatings}
      />
    </>
  );
}
