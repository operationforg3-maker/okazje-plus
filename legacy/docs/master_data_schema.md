Master Data Schema (Product-Centric + AliExpress Enrichment)

Wersja ostateczna (v3.0 - Complete). Rozdziela fizyczny produkt (ProductCore) od oferty handlowej (Deal). Uwzględnia pełne wymogi prawne (Omnibus), SEO, AI Vector Search oraz specyfikę AliExpress.

1. ProductCore (Produkt Bazowy)

Kolekcja Firestore: product_cores

To jest "Złoty Rekord" produktu. Reprezentuje fizyczny przedmiot (np. "Telefon Xiaomi 13T"), niezależnie od tego, gdzie jest sprzedawany. Służy jako główny punkt wejścia dla SEO i wyszukiwarki.

Kategoria

Pole

Typ Danych

Opis / Logika

Identyfikacja

id

UUID

Unikalny ID produktu w systemie.



identityHash

String

[CRITICAL] Hash unikalności (np. SHA256 z brand + model). Służy do łączenia ofert z różnych sklepów.



ean / gtin

String?

Kod kreskowy (jeśli udało się ustalić, np. przez AI).



brand

String

Marka (znormalizowana, np. "Xiaomi").



model

String

Model (znormalizowany, np. "13T Pro").



categoryPath

String

Ścieżka kategorii (np. elektronika/smartfony).

Treść (i18n)

title

Map<Locale, String>

Tytuł produktu. Klucz pl priorytetowy.



description

Map<Locale, HTML>

[ALIEXPRESS] Pełny opis HTML. AI czyści HTML i tłumaczy tekst.



specs

Map<Locale, KeyValue>

[ALIEXPRESS] Specyfikacja techniczna. Źródło: attribute_list.



features

Map<Locale, String[]>

Lista kluczowych cech (Bullet points).



pros

Map<Locale, String[]>

[AI] Zalety produktu wygenerowane z opinii.



cons

Map<Locale, String[]>

[AI] Wady produktu wygenerowane z opinii.

SEO (i18n)

seoTitle

Map<Locale, String>

Tytuł <60 znaków pod Google.



seoDescription

Map<Locale, String>

Meta description <160 znaków.



slug

Map<Locale, String>

Przyjazny URL (np. xiaomi-13t-pro).

Media

images

String[]

Galeria zdjęć (URL). Pierwsze zdjęcie to mainImage.



videoUrl

String?

[ALIEXPRESS] Link do wideo z API (product_video_url).

AI Data

embeddings

Vector[]

Wektor semantyczny (768 wymiarów) do wyszukiwania "po sensie" i "podobnych".



aiRating

Float

Ocena jakości produktu (0-100) wg algorytmów AI.

2. Deal (Oferta Handlowa)

Kolekcja Firestore: deals

Konkretna oferta sprzedaży danego ProductCore w konkretnym sklepie (AliExpress, Amazon, Allegro).

Kategoria

Pole

Typ Danych

Opis / Logika

Relacja

id

UUID

ID oferty.



productCoreId

UUID

[FK] Wskazuje na rodzica (ProductCore).



source

Enum

aliexpress, amazon, allegro, ebay.



externalId

String

ID w sklepie źródłowym (np. Ali Item ID).

Finanse

price

Money

Aktualna cena + waluta.



originalPrice

Money

Cena przekreślona (bazowa).



discount

Int

Procent zniżki (wyliczany automatycznie).



couponCode

String?

Kod rabatowy do skopiowania.



commissionRate

Float

[ADMIN] Stawka prowizji (np. 7.5%). Ważne do sortowania po dochodowości.

Omnibus

priceHistory

PricePoint[]

Historia cen: [{ date, price }]. Wymagane do wykresów i dyrektywy Omnibus.



lowestPrice30d

Money

Najniższa cena z ostatnich 30 dni przed obniżką.

Logistyka

shipping

Object

{ cost: Money, deliveryDays: 14, carrier: "AliExpress Standard", isFree: Bool }.



stock

Int?

Ilość dostępnych sztuk (jeśli API zwraca).



status

Enum

active, expired, out_of_stock, banned.

Sprzedawca

seller

Object

{ id: "123", name: "Xiaomi Official Store", url: "...", rating: 98.5 }.

Metryki

salesMetrics

Object

[ALIEXPRESS] { soldCount: 1500, reviewCount: 50, avgRating: 4.8 }.

Linki

dealUrl

String

Link wewnętrzny (cloaked) przekierowujący do sklepu.



affiliateUrl

String

Pełny link afiliacyjny (Convertiser/Awin).

3. Definicje TypeScript (Source of Truth)

Poniższe interfejsy powinny trafić do pliku src/lib/core-types.ts.

export type Locale = 'pl' | 'en' | 'de' | 'es' | 'uk';
export type Currency = 'PLN' | 'USD' | 'EUR';

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Localized<T> {
  [key in Locale]?: T;
}

export interface PricePoint {
  date: Date; // Firestore Timestamp
  amount: number;
  currency: Currency;
}

export interface ProductCore {
  id: string;
  identityHash: string;
  brand: string;
  model: string;
  ean?: string;
  
  title: Localized<string>;
  description: Localized<string>; // HTML
  specs: Localized<Record<string, string>>; // np. { "Bateria": "5000mAh" }
  features: Localized<string[]>;
  pros: Localized<string[]>;
  cons: Localized<string[]>;
  
  seoTitle: Localized<string>;
  seoDescription: Localized<string>;
  slug: Localized<string>;

  images: string[];
  videoUrl?: string;
  
  embeddings?: number[]; // Vector
  aiRating?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  productCoreId: string;
  source: 'aliexpress' | 'amazon' | 'allegro' | 'ebay';
  externalId: string;
  
  price: Money;
  originalPrice?: Money;
  discount: number;
  couponCode?: string;
  commissionRate?: number;
  
  priceHistory: PricePoint[];
  lowestPrice30d?: Money;
  
  shipping: {
    cost: Money;
    deliveryDays?: number;
    isFree: boolean;
  };
  
  seller: {
    id: string;
    name: string;
    url: string;
    rating?: number;
  };
  
  salesMetrics: {
    soldCount: number;
    reviewCount?: number;
  };
  
  dealUrl: string;
  affiliateUrl: string;
  status: 'active' | 'expired' | 'out_of_stock' | 'banned';
  
  expirationDate?: Date;
  lastCheck: Date;
}


4. Kluczowe Zasady Danych

Separacja Językowa: ProductCore przechowuje treści w wielu językach. Deal jest zazwyczaj niezależny językowo (cyfry, waluty), chyba że specyficzne warunki promocji są w danym języku.

Historia Cen: Każda aktualizacja ceny (Harvester -> Deal) musi dodać nowy wpis do priceHistory. Nie nadpisujemy starej ceny, tylko dopisujemy nową do historii.

Deduplikacja: Przed utworzeniem nowego ProductCore zawsze sprawdzamy identityHash. Jeśli istnieje, dodajemy tylko nowy Deal do istniejącego produktu.