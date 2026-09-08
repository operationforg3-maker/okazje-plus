import { Metadata } from 'next';
import HomeClient from './home-client';
import { getRecommendedProducts, getCategories } from '@/lib/data';
import { searchDeals } from '@/lib/search-server';
import { generateHomePageJsonLd } from '@/lib/json-ld-generators';
import { setRequestLocale } from 'next-intl/server';

// Cache home page more aggressively for better performance
export const revalidate = 300; // ISR co 5 minut dla niższego kosztu backendu i stabilniejszego TTFB

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';

const OG_LOCALES: Record<string, string> = {
  pl: 'pl_PL',
  en: 'en_US',
  de: 'de_DE',
  fr: 'fr_FR',
  es: 'es_ES',
  uk: 'uk_UA',
};

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

const HOME_SEO_BY_LOCALE: Record<string, {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
}> = {
  pl: {
    title: 'Okazje Plus - Najlepsze promocje i okazje w internecie',
    description: 'Odkryj najgorętsze okazje i promocje w internecie. Społeczność Okazje Plus dzieli się sprawdzonymi ofertami, kodami rabatowymi i wyprzedażami.',
    keywords: 'okazje, promocje, wyprzedaże, kody rabatowe, zakupy online, najlepsze ceny, hot deals, sklepy internetowe',
    ogTitle: 'Okazje Plus - Najlepsze promocje i okazje online',
    ogDescription: 'Społeczność łowców okazji. Odkrywaj najlepsze promocje w internecie, dziel się znaleziskami i oszczędzaj.',
    twitterTitle: 'Okazje Plus - Społeczność łowców okazji online',
    twitterDescription: 'Odkryj najgorętsze promocje i produkty w internecie. Dołącz do społeczności!',
  },
  en: {
    title: 'Okazje Plus - Best online deals and promotions',
    description: 'Discover the hottest online deals and promotions. The Okazje Plus community shares verified offers, discount codes and smart shopping tips.',
    keywords: 'deals, promotions, discounts, coupons, online shopping, best prices, hot deals, ecommerce',
    ogTitle: 'Okazje Plus - Best online deals and promos',
    ogDescription: 'A deal-hunters community. Discover top promotions online, share finds and save more.',
    twitterTitle: 'Okazje Plus - Online deal hunters community',
    twitterDescription: 'Find the hottest online promotions and products. Join the community!',
  },
  de: {
    title: 'Okazje Plus - Beste Online-Angebote und Aktionen',
    description: 'Entdecke die heißesten Online-Angebote und Rabatte. Die Okazje Plus Community teilt geprüfte Deals, Gutscheincodes und Spartipps.',
    keywords: 'angebote, aktionen, rabatte, gutscheine, online shopping, beste preise, deals, internet',
    ogTitle: 'Okazje Plus - Beste Online-Angebote',
    ogDescription: 'Community für Dealjäger. Entdecke Top-Aktionen online, teile Funde und spare mehr.',
    twitterTitle: 'Okazje Plus - Community für Online-Deals',
    twitterDescription: 'Finde die heißesten Online-Aktionen und Produkte. Werde Teil der Community!',
  },
  fr: {
    title: 'Okazje Plus - Meilleures offres et promotions en ligne',
    description: 'Découvrez les offres et promotions en ligne les plus intéressantes. La communauté Okazje Plus partage des bons plans vérifiés et des codes promo.',
    keywords: 'offres, promotions, réductions, codes promo, achats en ligne, meilleurs prix, bons plans, internet',
    ogTitle: 'Okazje Plus - Les meilleures offres en ligne',
    ogDescription: 'Une communauté de chasseurs de bons plans. Trouvez les meilleures promotions en ligne et économisez.',
    twitterTitle: 'Okazje Plus - Communauté des bons plans en ligne',
    twitterDescription: 'Découvrez les promotions et produits les plus intéressants en ligne. Rejoignez-nous !',
  },
  es: {
    title: 'Okazje Plus - Mejores ofertas y promociones en internet',
    description: 'Descubre las ofertas y promociones más potentes en internet. La comunidad Okazje Plus comparte chollos verificados y códigos de descuento.',
    keywords: 'ofertas, promociones, descuentos, cupones, compras online, mejores precios, chollos, internet',
    ogTitle: 'Okazje Plus - Las mejores ofertas online',
    ogDescription: 'Comunidad de cazadores de ofertas. Encuentra promociones top en internet y ahorra más.',
    twitterTitle: 'Okazje Plus - Comunidad de ofertas online',
    twitterDescription: 'Descubre las promociones y productos más atractivos en internet. ¡Únete ahora!',
  },
  uk: {
    title: 'Okazje Plus - Найкращі акції та пропозиції онлайн',
    description: 'Відкривайте найгарячіші онлайн-акції та знижки. Спільнота Okazje Plus ділиться перевіреними пропозиціями, купонами та вигідними знахідками.',
    keywords: 'акції, знижки, купони, онлайн покупки, найкращі ціни, вигідні пропозиції, розпродаж, інтернет',
    ogTitle: 'Okazje Plus - Найкращі онлайн-пропозиції',
    ogDescription: 'Спільнота мисливців за знижками. Знаходьте найкращі акції в інтернеті та заощаджуйте більше.',
    twitterTitle: 'Okazje Plus - Спільнота онлайн-акцій',
    twitterDescription: 'Знаходьте найгарячіші акції та товари онлайн. Приєднуйтесь до спільноти!',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const currentLocale = locale || 'pl';
  const seo = HOME_SEO_BY_LOCALE[currentLocale] || HOME_SEO_BY_LOCALE.pl;
  const canonical = `${SITE_URL}/${currentLocale}`;
  const isIndexedLocale = SUPPORTED_LOCALES.includes(currentLocale as (typeof SUPPORTED_LOCALES)[number]);

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    openGraph: {
      title: seo.ogTitle,
      description: seo.ogDescription,
      url: canonical,
      siteName: 'Okazje Plus',
      locale: OG_LOCALES[currentLocale] || OG_LOCALES.pl,
      type: 'website',
      images: [
        {
          url: 'https://okazjeplus.pl/og-home.jpg',
          width: 1200,
          height: 630,
          alt: 'Okazje Plus - Najlepsze promocje',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.twitterTitle,
      description: seo.twitterDescription,
    },
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          SUPPORTED_LOCALES.map((localeCode) => [localeCode, `${SITE_URL}/${localeCode}`])
        ),
        'x-default': `${SITE_URL}/pl`,
      },
    },
    robots: {
      index: isIndexedLocale,
      follow: true,
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  setRequestLocale(resolvedParams.locale);

  // Pobieramy zarówno gorące okazje, jak i najnowsze z bazy, aby połączyć je w świeżą i angażującą prezentację
  const [allHotDeals, latestDeals, topProducts, categories] = await Promise.all([
    searchDeals('*', {
      limit: 30,
      sortBy: 'hot',
      statusFilter: 'approved',
    }),
    searchDeals('*', {
      limit: 30,
      sortBy: 'newest',
      statusFilter: 'approved',
    }),
    getRecommendedProducts(12),
    getCategories(),
  ]);

  // Pomocnik do wyciągania kwoty ceny
  function getDealPrice(deal: any): number {
    if (typeof deal?.price === 'number') return deal.price;
    if (typeof deal?.price === 'object' && deal?.price?.amount) return Number(deal.price.amount);
    return parseFloat(String(deal?.legacyPrice || 0)) || 0;
  }

  function getDealOrigPrice(deal: any): number {
    if (typeof deal?.originalPrice === 'number') return deal.originalPrice;
    if (typeof deal?.originalPrice === 'object' && deal?.originalPrice?.amount) return Number(deal.originalPrice.amount);
    if (typeof deal?.oldPrice === 'number') return deal.oldPrice;
    return 0;
  }

  // Obliczenie rabatu %
  function calcDiscountPct(deal: any): number {
    const price = getDealPrice(deal);
    const orig = getDealOrigPrice(deal);
    if (orig > 0 && price > 0 && orig > price) {
      return Math.round(((orig - price) / orig) * 100);
    }
    if (deal?.discount) {
      const num = parseInt(String(deal.discount).replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(num) && num > 0) return num;
    }
    return 0;
  }

  // Złączenie unikalnych okazji (najnowsze + gorące)
  const dealsMap = new Map<string, any>();
  for (const d of [...latestDeals, ...allHotDeals]) {
    if (!dealsMap.has(d.id)) {
      dealsMap.set(d.id, d);
    }
  }
  const combinedDeals = Array.from(dealsMap.values());

  // Wybieramy okazje do karuzeli "Okazja Tygodnia" — wysoka jakość, obrazek, cena, atrakcyjność i świeżość
  const weeklyDeals = [...combinedDeals]
    .filter((d: any) => {
      const hasImg = !!(d.image || d.imageUrl);
      const price = getDealPrice(d);
      return hasImg && price > 0;
    })
    .sort((a: any, b: any) => {
      const discA = calcDiscountPct(a);
      const discB = calcDiscountPct(b);
      const tempA = Number(a.temperature || 0);
      const tempB = Number(b.temperature || 0);

      const tsA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tsB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const recencyA = tsA > 0 ? Math.max(0, 1 - (Date.now() - tsA) / (14 * 86400000)) * 25 : 0;
      const recencyB = tsB > 0 ? Math.max(0, 1 - (Date.now() - tsB) / (14 * 86400000)) * 25 : 0;

      const scoreA = discA * 1.5 + Math.min(tempA, 100) * 0.5 + recencyA;
      const scoreB = discB * 1.5 + Math.min(tempB, 100) * 0.5 + recencyB;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  // Gorące okazje do siatki (12 elementów): bierzemy top deale z uwzględnieniem różnorodności
  const hotDeals = (allHotDeals.length >= 12 ? allHotDeals : combinedDeals).slice(0, 12);

  const homeJsonLd = generateHomePageJsonLd(hotDeals, topProducts);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <HomeClient 
        initialHotDeals={hotDeals}
        initialTopProducts={topProducts}
        categories={categories}
        weeklyDeals={weeklyDeals}
      />
    </>
  );
}

