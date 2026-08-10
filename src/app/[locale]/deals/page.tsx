import { Metadata } from 'next';
import { Suspense } from 'react';
import DealsClient from './deals-client';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';
const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const currentLocale = locale || 'pl';
  const canonical = `${SITE_URL}/${currentLocale}/deals`;

  const titles: Record<string, string> = {
    pl: 'Najlepsze Okazje i Promocje - Okazje Plus',
    en: 'Best Deals and Promotions - Okazje Plus',
    de: 'Die besten Angebote und Aktionen - Okazje Plus',
    fr: 'Meilleures Offres et Promotions - Okazje Plus',
    es: 'Mejores Ofertas y Promociones - Okazje Plus',
    uk: 'Найкращі Акції та Пропозиції - Okazje Plus',
  };

  const descriptions: Record<string, string> = {
    pl: 'Odkrywaj najlepsze okazje, promocje i wyprzedaże w internecie. Społeczność Okazje Plus codziennie publikuje sprawdzone oferty i oszczędności.',
    en: 'Discover the best online deals, promotions and discounts. The Okazje Plus community shares verified offers and smart savings every day.',
    de: 'Entdecke die besten Online-Angebote, Rabatte und Aktionen. Die Okazje Plus Community teilt täglich geprüfte Deals und echte Sparmöglichkeiten.',
    fr: 'Découvrez les meilleures offres, promotions et réductions en ligne. La communauté Okazje Plus partage chaque jour des bons plans vérifiés.',
    es: 'Descubre las mejores ofertas, promociones y descuentos en internet. La comunidad Okazje Plus comparte oportunidades verificadas cada día.',
    uk: 'Відкривайте найкращі онлайн-акції, знижки та розпродажі. Спільнота Okazje Plus щодня ділиться перевіреними вигідними пропозиціями.',
  };

  return {
    title: titles[currentLocale] || titles.pl,
    description: descriptions[currentLocale] || descriptions.pl,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          SUPPORTED_LOCALES.map((localeCode) => [localeCode, `${SITE_URL}/${localeCode}/deals`])
        ),
        'x-default': `${SITE_URL}/pl/deals`,
      },
    },
  };
}

export default function Page() {
  return (
    <Suspense fallback={<div className="page-container py-12 text-center text-muted-foreground">Ładowanie okazji...</div>}>
      <DealsClient />
    </Suspense>
  );
}
