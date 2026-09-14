import { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';
const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const currentLocale = locale || 'pl';
  const canonical = `${SITE_URL}/${currentLocale}/products`;

  const titles: Record<string, string> = {
    pl: 'Katalog produktów – porównanie cen i specyfikacje | Okazje Plus',
    en: 'Product Catalog – Price Comparison & Specs | Okazje Plus',
    de: 'Produktkatalog – Preisvergleich & Spezifikationen | Okazje Plus',
    fr: 'Catalogue de produits – Comparateur de prix | Okazje Plus',
    es: 'Catálogo de productos – Comparador de precios | Okazje Plus',
    uk: 'Каталог товарів – Порівняння цін та характеристики | Okazje Plus',
  };

  const descriptions: Record<string, string> = {
    pl: 'Przeglądaj tysiące produktów, porównuj ceny w sklepach, sprawdzaj historię cen i opinie kupujących na Okazje Plus.',
    en: 'Browse thousands of products, compare prices across stores, check price history and buyer reviews on Okazje Plus.',
    de: 'Durchsuchen Sie Tausende von Produkten, vergleichen Sie Preise in Geschäften und prüfen Sie Preisverläufe auf Okazje Plus.',
    fr: 'Parcourez des milliers de produits, comparez les prix en magasin et consultez les avis sur Okazje Plus.',
    es: 'Explora miles de productos, compara precios en tiendas y consulta historiales de precios en Okazje Plus.',
    uk: 'Переглядайте тисячі товарів, порівнюйте ціни в магазинах та перевіряйте історію цін на Okazje Plus.',
  };

  return {
    title: titles[currentLocale] || titles.pl,
    description: descriptions[currentLocale] || descriptions.pl,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          SUPPORTED_LOCALES.map((localeCode) => [localeCode, `${SITE_URL}/${localeCode}/products`])
        ),
        'x-default': `${SITE_URL}/pl/products`,
      },
    },
  };
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
