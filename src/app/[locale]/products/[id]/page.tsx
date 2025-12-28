import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { doc, getDoc, collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, ProductRating, ProductCore, DealM6 } from '@/lib/types';
import { getProductRatings, getProductWithDeals } from '@/lib/data';
import ProductDetailM6Client from './product-detail-m6-client';

// Force dynamic rendering dla real-time danych
export const dynamic = 'force-dynamic';
export const revalidate = 300; // ISR: revalidate co 5 minut

interface PageProps {
  params: { id: string; locale: string };
}

// Server-side data fetching - używa M6 ProductCore + DealM6
async function getProductData(id: string) {
  // Try M6 first (ProductCore + Deals)
  const m6Data = await getProductWithDeals(id);
  
  if (m6Data) {
    // M6 ProductCore found - return with deals
    const { product: productCore, deals } = m6Data;
    
    // Fetch related products from same subcategory (from ProductCore collection)
    const relatedQuery = query(
      collection(db, "product_cores"),
      where("subCategorySlug", "==", productCore.subCategorySlug),
      where("status", "==", "approved"),
      limit(4)
    );
    const relatedSnap = await getDocs(relatedQuery);
    const relatedProducts = relatedSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(p => p.id !== id)
      .slice(0, 3);
    
    // Fetch recent ratings (still using product ID)
    const recentRatings = await getProductRatings(id, 5);
    
    return { productCore, deals, relatedProducts, recentRatings, isM6: true };
  }
  
  // Fallback to legacy Product if not found in ProductCore
  const docRef = doc(db, "products", id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const productData = docSnap.data();
  const product = {
    id: docSnap.id,
    ...productData,
    // Ensure required fields have defaults
    ratingCard: productData.ratingCard || { average: 0, count: 0 },
    price: productData.price ?? 0,
    originalPrice: productData.originalPrice ?? undefined,
    discountPercent: productData.discountPercent ?? undefined,
  } as Product;
  
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
  
  return { product, relatedProducts, recentRatings, deals: [], isM6: false };
}

// SEO: Generate metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getProductData(params.id);
  
  if (!data || !data.product) {
    return {
      title: 'Produkt nie znaleziony',
      description: 'Szukany produkt nie istnieje w naszej bazie.',
    };
  }
  
  const product = data.product;
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.price ?? 0);
  const originalPrice = product.originalPrice 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.originalPrice)
    : null;
  const discount = product.discountPercent ? Math.round(product.discountPercent * 100) : null;
  
  // SEO title i description z AI lub fallback
  const metaTitle = product.metaTitle || product.seo?.metaTitle || `${product.name} - ${price} | Okazje Plus`;
  const ratingText = product.ratingCard?.count > 0 
    ? `${product.ratingCard.count} ocen, średnia ${product.ratingCard.average.toFixed(1)}/5.0` 
    : 'Brak ocen';
  const metaDescription = product.metaDescription || product.seo?.metaDescription || product.description || `Kup ${product.name} w najlepszej cenie ${price}. ${ratingText}`;
  
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
  
  const { productCore, product, deals, relatedProducts, recentRatings, isM6 } = data;
  
  // Use productCore if M6, otherwise fallback to product
  const productData = isM6 ? productCore : product;
  
  // JSON-LD structured data dla Google Rich Results
  const productName = typeof productData.title === 'object' 
    ? (productData.title.pl || productData.title.en || 'Produkt')
    : (productData.name || 'Produkt');
  const productDescription = typeof productData.description === 'string' 
    ? productData.description 
    : (productData.shortDescription?.pl || productData.fullDescription?.pl || '');
  
  // For M6: use bestPrice, for legacy: use price
  const priceAmount = isM6 ? productCore.bestPrice.amount : product.price;
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    description: productDescription,
    image: isM6 ? productCore.images[0] : product.image,
    sku: productData.id,
    brand: {
      '@type': 'Brand',
      name: 'Various',
    },
    offers: isM6 ? {
      '@type': 'AggregateOffer',
      url: `https://okazje.plus/pl/products/${productData.id}`,
      priceCurrency: 'PLN',
      lowPrice: productCore.bestPrice.amount,
      offerCount: deals.length,
      offers: deals.slice(0, 5).map((deal: any) => ({
        '@type': 'Offer',
        price: deal.price.amount,
        priceCurrency: deal.price.currency,
        availability: deal.stockStatus === 'in_stock' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: deal.merchantName || 'Merchant',
        },
      })),
    } : {
      '@type': 'Offer',
      url: `https://okazje.plus/pl/products/${productData.id}`,
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
      ratingValue: isM6 ? productCore.rating.score : product.ratingCard.average,
      reviewCount: isM6 ? productCore.rating.count : product.ratingCard.count,
      bestRating: 5,
      worstRating: 1,
    },
  };

  // BreadcrumbList schema for better navigation in Google
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Strona główna',
        item: 'https://okazjeplus.pl'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Produkty',
        item: 'https://okazjeplus.pl/products'
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: productName,
        item: `https://okazjeplus.pl/products/${product.id}`
      }
    ]
  };
  
  return (
    <>
      {/* JSON-LD dla SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList) }}
      />
      
      {/* Client component z interaktywnym UI */}
      <ProductDetailM6Client 
        productCore={isM6 ? productCore : undefined}
        product={!isM6 ? product : undefined}
        deals={deals}
        relatedProducts={relatedProducts}
        recentRatings={recentRatings}
        isM6={isM6}
      />
    </>
  );
}
