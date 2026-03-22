import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { doc, getDoc, collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, ProductRating, ProductCore, DealM6 } from '@/lib/types';
import { getProductRatings, getProductWithDeals } from '@/lib/data';
import { getProductWithDealsAdmin } from '@/lib/data-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { generateProductJsonLd, generateBreadcrumbJsonLd, generateFaqJsonLd } from '@/lib/json-ld-generators';
import { buildCategoryPath, humanizeCategorySlug } from '@/lib/category-routes';
import ProductDetailM6Client from './product-detail-m6-client';

// Force dynamic rendering dla real-time danych
export const dynamic = 'force-dynamic';
export const revalidate = 300; // ISR: revalidate co 5 minut

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

function localeToOgLocale(locale: string): string {
  const map: Record<string, string> = {
    pl: 'pl_PL',
    en: 'en_US',
    de: 'de_DE',
    fr: 'fr_FR',
    es: 'es_ES',
    uk: 'uk_UA',
  };
  return map[locale] || 'pl_PL';
}

// Server-side data fetching - używa M6 ProductCore + DealM6
async function getProductData(id: string) {
  try {
    // Walidacja ID - zapobiegaj próbom z pustym ID
    if (!id || id.trim() === '') {
      console.error('[getProductData] Invalid product ID:', id);
      return null;
    }

    console.log(`[getProductData] Fetching product: ${id}`);
    const session = await getServerAuthSession();
    const isAdmin = session?.role === 'admin' || session?.role === 'moderator';

    // Try M6 first (ProductCore + Deals)
    // If admin, use Admin permissions (view drafts). If generic user, use standard query (only approved).
    let m6Data;
    if (isAdmin) {
       console.log('[getProductData] Admin access detected - using privileged fetch');
       m6Data = await getProductWithDealsAdmin(id);
    } else {
       m6Data = await getProductWithDeals(id);
    }
    
    if (m6Data) {
      console.log(`[getProductData] M6 data found for ${id}, have ${m6Data.deals.length} deals`);
      // M6 ProductCore found - return with deals
      const { product: productCore, deals } = m6Data;

      // Skip non-approved cores early to avoid leaking drafts
      // UNLESS user is admin
      if (productCore?.status && productCore.status !== 'approved' && !isAdmin) {
        return null;
      }

      // Fetch related products from same subcategory (from ProductCore collection)
      const relatedProducts = productCore?.subCategorySlug
        ? (() => {
            const relatedQuery = query(
              collection(db, "product_cores"),
              where("subCategorySlug", "==", productCore.subCategorySlug),
              where("status", "==", "approved"),
              limit(4)
            );
            return getDocs(relatedQuery).then((relatedSnap) =>
              relatedSnap.docs
                .map(doc => {
                  const data = doc.data() as any;
                  return {
                    id: doc.id,
                    ...data,
                    // Convert Firestore timestamps to ISO strings
                    createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || new Date().toISOString(),
                    updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt || new Date().toISOString(),
                  };
                })
                .filter(p => p.id !== id && p.id) // Filter out empty IDs
                .slice(0, 3)
            );
          })()
        : Promise.resolve([]);
      
      // Fetch recent ratings (still using product ID)
      let recentRatings: ProductRating[] = [];
      try {
        recentRatings = await getProductRatings(id, 5);
      } catch (err) {
        console.error('[getProductData] Error fetching ratings for M6:', err);
        recentRatings = [];
      }
      
      const [resolvedRelated] = await Promise.all([
        relatedProducts,
      ]);
      
      // Serialize everything to prevent "passing non-serializable data to Client Component" errors
      // caused by Firestore Timestamps in relatedProducts or recentRatings
      // This is critical for both Admin (draft) and User (approved) views
      return JSON.parse(JSON.stringify({ 
        productCore, 
        deals, 
        relatedProducts: resolvedRelated, 
        recentRatings, 
        isM6: true 
      }));
    }
    
    // Fallback to legacy Product if not found in ProductCore
    console.log(`[getProductData] M6 data not found, trying legacy products for ${id}`);
    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.warn(`[getProductData] Product not found in both M6 and legacy: ${id}`);
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
  
  // Fetch related products from same subcategory (only if subCategorySlug exists)
  let relatedProducts: Product[] = [];
  if (product.subCategorySlug) {
    try {
      const relatedQuery = query(
        collection(db, "products"),
        where("subCategorySlug", "==", product.subCategorySlug),
        where("status", "==", "approved"),
        limit(4)
      );
      const relatedSnap = await getDocs(relatedQuery);
      relatedProducts = relatedSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .filter(p => p.id !== id)
        .slice(0, 3);
    } catch (err) {
      console.error('[getProductData] Error fetching related products:', err);
      relatedProducts = [];
    }
  }
  
  // Fetch recent ratings
  let recentRatings: ProductRating[] = [];
  try {
    recentRatings = await getProductRatings(id, 5);
  } catch (err) {
    console.error('[getProductData] Error fetching ratings for legacy product:', err);
    recentRatings = [];
  }
  
  // Serialize legacy data return as well
  return JSON.parse(JSON.stringify({ 
    product, 
    relatedProducts, 
    recentRatings, 
    deals: [], 
    isM6: false 
  }));
  } catch (error) {
    console.error('[getProductData] Unexpected error fetching product:', error);
    return null;
  }
}

// SEO: Generate metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, locale } = await params;
  const effectiveLocale = SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])
    ? locale
    : 'pl';
  const data = await getProductData(id);
  
  if (!data) {
    return {
      title: 'Produkt nie znaleziony',
      description: 'Szukany produkt nie istnieje w naszej bazie.',
    };
  }
  
  const { product, productCore, deals, isM6 } = data;
  
  // Safe destructuring - check which mode we're in
  if (isM6 && !productCore) {
    return {
      title: 'Błąd produktu',
      description: 'Produkt M6 nie ma ProductCore',
    };
  }
  
  if (!isM6 && !product) {
    return {
      title: 'Błąd produktu',
      description: 'Produkt legacy nie ma product data',
    };
  }

  const bestDealFromApprovedDeals = isM6 && Array.isArray(deals) && deals.length > 0
    ? deals.reduce((best, current) => {
        const bestShipping = best?.shipping?.cost || best?.shippingCost || 0;
        const currentShipping = current?.shipping?.cost || current?.shippingCost || 0;
        const bestTotal = (best?.price?.amount || best?.price || 0) + bestShipping;
        const currentTotal = (current?.price?.amount || current?.price || 0) + currentShipping;
        return currentTotal < bestTotal ? current : best;
      }, deals[0])
    : null;
  
  const productData = isM6 ? productCore! : product!;
  const priceAmount = isM6
    ? (bestDealFromApprovedDeals
        ? ((bestDealFromApprovedDeals?.price?.amount || bestDealFromApprovedDeals?.price || 0) + (bestDealFromApprovedDeals?.shipping?.cost || bestDealFromApprovedDeals?.shippingCost || 0))
        : null)
    : (product?.price ?? 0);
  const price = priceAmount !== null
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(priceAmount)
    : 'sprawdź oferty';
  const originalPrice = !isM6 && product?.originalPrice 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.originalPrice)
    : null;
  const discount = !isM6 && product?.discountPercent ? Math.round(product.discountPercent * 100) : null;
  
  // SEO title i description z AI lub fallback
  const productName = isM6 
    ? (typeof productCore!.title === 'object' ? (productCore!.title.pl || productCore!.title.en) : productCore!.title) 
    : product!.name;
  const metaTitle = !isM6 && product ? (product.metaTitle || product.seo?.metaTitle) : undefined;
  const fallbackTitle = `${productName} - ${price} | Okazje Plus`;
  const ratingScore = isM6 ? (productCore?.rating?.score ?? 0) : (product?.ratingCard?.average ?? 0);
  const ratingCount = isM6 ? (productCore?.rating?.count ?? 0) : (product?.ratingCard?.count ?? 0);
  const ratingText = ratingCount > 0 
    ? `${ratingCount} ocen, średnia ${ratingScore.toFixed(1)}/5.0` 
    : 'Brak ocen';
  const productDesc = isM6 
    ? (typeof productCore?.description === 'object' ? (productCore.description.pl || productCore.description.en) : (typeof productCore?.description === 'string' ? productCore.description : '')) 
    : (product?.description ?? '');
  const metaDescription = !isM6 && product ? (product.metaDescription || product.seo?.metaDescription) : undefined;
  const fallbackDescription = `Kup ${productName} w najlepszej cenie ${price}. ${ratingText}`;
  const finalTitle = metaTitle || fallbackTitle;
  const finalDescription = metaDescription || productDesc || fallbackDescription;
  
  // Keywords z AI enrichment + SEO
  const keywords = [
    ...(!isM6 && product ? (product.seoKeywords || []) : []),
    ...(!isM6 && product ? (product.seo?.keywords || []) : []),
    ...(!isM6 && product ? (product.ai?.enrichment?.keywords || []) : isM6 && productCore ? (productCore.searchTags || []) : []),
    productData.mainCategorySlug,
    productData.subCategorySlug,
    productData.subSubCategorySlug || '',
  ].filter(Boolean);
  
  const canonicalUrl = `https://okazjeplus.pl/${effectiveLocale}/products/${productData.id}`;
  
  const productImage = isM6 && productCore ? (productCore.images?.[0] || '') : (product?.image || '');
  const stockStatus = isM6 
    ? 'in stock' 
    : (product && product.metadata?.stockStatus === 'in_stock' ? 'in stock' : 'out of stock');
  const brandName = isM6 
    ? 'Various' 
    : (product && product.metadata?.merchant ? product.metadata.merchant : 'Generic');
  
  return {
    title: finalTitle,
    description: finalDescription.slice(0, 160),
    keywords: keywords.slice(0, 20).join(', '),
    authors: [{ name: 'Okazje Plus' }],
    openGraph: {
      title: finalTitle,
      description: finalDescription.slice(0, 160),
      url: canonicalUrl,
      siteName: 'Okazje Plus',
      locale: localeToOgLocale(effectiveLocale),
      type: 'website',
      images: [
        {
          url: productImage,
          width: 1200,
          height: 630,
          alt: productName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: finalTitle,
      description: finalDescription.slice(0, 160),
      images: [productImage],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: Object.fromEntries(
        [
          ...SUPPORTED_LOCALES.map((localeCode) => [localeCode, `https://okazjeplus.pl/${localeCode}/products/${productData.id}`]),
          ['x-default', `https://okazjeplus.pl/pl/products/${productData.id}`],
        ]
      ),
    },
    other: {
      ...(priceAmount !== null && {
        'product:price:amount': priceAmount.toString(),
        'product:price:currency': 'PLN',
        'og:price:amount': priceAmount.toString(),
        'og:price:currency': 'PLN',
      }),
      'product:availability': stockStatus,
      'product:condition': 'new',
      'product:brand': brandName,
      ...(originalPrice && { 'product:original_price:amount': originalPrice.replace(/[^0-9.,]/g, '') }),
    },
  };
}

// Optional: Generate static params for approved ProductCore records (top 100 by freshness)
export async function generateStaticParams() {
  // Używamy kolekcji product_cores (M6), żeby nie polegać na legacy products ani dodatkowych indeksach
  const coresRef = collection(db, "product_cores");
  const q = query(
    coresRef,
    where("status", "==", "approved"),
    orderBy("updatedAt", "desc"),
    limit(100)
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id }));
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id, locale } = await params;
  const effectiveLocale = SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])
    ? locale
    : 'pl';
  const data = await getProductData(id);
  
  if (!data) {
    notFound();
  }
  
  const { productCore, product, deals, relatedProducts, recentRatings, isM6 } = data;
  
  // Use productCore if M6, otherwise fallback to product
  const productData = isM6 ? productCore : product;
  
  // Guard against missing productData (shouldn't happen but defensive programming)
  if (!productData) {
    notFound();
  }
  
  // JSON-LD structured data dla Google Rich Results
  const productName = typeof (productData as any)?.title === 'object' 
    ? ((productData as any).title.pl || (productData as any).title.en || 'Produkt')
    : ((productData as any)?.title || (productData as any)?.name || 'Produkt');
  
  const jsonLd = generateProductJsonLd(productData, isM6, deals || [], productCore, product);
  const breadcrumbList = generateBreadcrumbJsonLd(
    productName,
    productData.id,
    (productData as any)?.mainCategorySlug
      ? {
          name:
            humanizeCategorySlug((productData as any)?.subSubCategorySlug)
            || humanizeCategorySlug((productData as any)?.subCategorySlug)
            || humanizeCategorySlug((productData as any)?.mainCategorySlug),
          path: buildCategoryPath(
            effectiveLocale,
            (productData as any).mainCategorySlug,
            (productData as any)?.subCategorySlug,
            (productData as any)?.subSubCategorySlug
          ),
        }
      : undefined
  );
  const faqJsonLd = generateFaqJsonLd([
    {
      question: `Jaka jest najniższa cena produktu ${productName}?`,
      answer: isM6 && productCore?.bestPrice?.amount
        ? `Aktualnie najniższa wykryta cena to ${productCore.bestPrice.amount} ${productCore.bestPrice.currency || 'PLN'}.`
        : 'Cena produktu zależy od dostępnych ofert i może się zmieniać w czasie.',
    },
    {
      question: `Ile ofert jest dostępnych dla ${productName}?`,
      answer: `Aktualnie dostępnych ofert: ${deals?.length || 0}.`,
    },
    {
      question: `Czy ten produkt jest regularnie aktualizowany?`,
      answer: 'Tak, dane ofertowe są okresowo odświeżane przez system harvestera i procesy moderacji.',
    },
  ]);
  
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
