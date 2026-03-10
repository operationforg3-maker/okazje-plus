👑 OkazjePlus M6 - Master Architecture Document

Wersja: 2.0 (Zunifikowana) | Ostatnia aktualizacja: Marzec 2026
Cel: Skalowalna platforma Social Commerce z milionem produktów, obsługująca 6 języków, oparta na modelu "Poczekalni" i masowym imporcie (Bulk Ingestion).

Ten dokument stanowi jedyne, ostateczne źródło prawdy (Source of Truth) dla całej architektury OkazjePlus w wersji M6. Opisuje przepływ danych, schematy bazy, zasady UI/UX oraz system kategoryzacji.

🧭 SPIS TREŚCI

Paradygmat Platformy (Social Commerce)

Słownik Pojęć

FAZA 1: Bulk Ingestion & Kategoryzacja (Harvester)

FAZA 2: Baza Danych i Deduplikacja (Schemas)

FAZA 3: AI Enrichment (Wzbogacanie Danych)

FAZA 4: Poczekalnia i System Moderacji Społecznościowej

FAZA 5: Search Engine (Typesense)

FAZA 6: Standardy UX/UI i Responsywności (Mobile-First)

1. PARADYGMAT PLATFORMY (SOCIAL COMMERCE)

OkazjePlus to nie jest tradycyjny sklep internetowy. To platforma Social Commerce bazująca na mądrości tłumu (Crowdsourcing).

Zasada Lejka (The Firehose & Sieve): Pobieramy z API tysiące ofert ("z węża strażackiego"), a następnie brutalnie je odsiewamy przez gęste sito (nasz plik JSON). Tylko pasujące produkty trafiają do bazy.

Product-Centric: Katalog produktów (ProductCore) jest stały i czysty (np. "Apple iPhone 15"). Podłączamy pod niego tymczasowe oferty (DealM6). Produkt agreguje oferty i wskazuje tę najtańszą.

Poczekalnia (Zaufanie Społeczności): Algorytmy wpuszczają deale do "Poczekalni". To użytkownicy swoimi głosami (plusy/minusy) decydują, czy oferta jest prawdziwą okazją i awansuje na "Główną".

2. SŁOWNIK POJĘĆ

Category Tree (JSON): Plik category-tree-seo-extended.json. Pełni rolę Headless CMS. Służy jako baza kategorii, silnik dla parserów (importKeywords), dostawca dynamicznych filtrów (filterableAttributes) oraz meta tagów pod SEO.

ProductCore: Niemutowalna encja w Firestore reprezentująca fizyczny produkt. Posiada znormalizowane specyfikacje i opisy. Zawsze wyświetla bestTotalPrice i kieruje do bestDealId.

DealM6: Mutowalna encja oferty z konkretnego sklepu (np. x-kom, AliExpress). Posiada cenę, link afiliacyjny, statystyki głosowania oraz status.

Poczekalnia: Stan (status) ofert, które zostały pobrane przez Harvester, ale jeszcze nie zdobyły poparcia społeczności.

Temperatura (Score): Dynamiczna wartość określająca "gorączkę" wokół oferty, liczona na podstawie głosów i czasu (algorytm time-decay).

3. FAZA 1: BULK INGESTION & KATEGORYZACJA (HARVESTER)

Zasada: Chronimy limity API i budżet. Pobieramy masowo (Bulk), filtrujemy lokalnie w pamięci RAM.

3.1. Pobieranie Masowe (The Firehose)

Harvester uderza do ogólnych endpointów (np. aliexpress.getTopDeals lub pełne feedy XML z Convertisera). Nie iterujemy po 400 kategoriach w API! Pobieramy tysiące surowych ofert na raz.

3.2. Kaskadowe Filtrowanie (The Sieve)

Każdy pobrany obiekt przepuszczany jest przez silnik CategoryRouter, zasilany plikiem JSON.

Dopasowanie Twarde (ID Match): System sprawdza ustandaryzowane kody (np. googleCategoryId z XML lub aliexpressCategoryIds). Jeśli ID pasuje do węzła L3 w naszym JSON -> ZATRZYMAJ.

Dopasowanie Miękkie (Keyword Match): Jeśli nie ma ID, system szuka w tytule dopasowania do tablic importKeywords ze wszystkich węzłów L3 (fallback tekstowy). Jeśli znajdzie -> ZATRZYMAJ.

Odrzucenie (Drop): Jeśli obie metody zawiodą -> ODRZUĆ. Produkt nie trafia do bazy, oszczędzamy zasoby.

3.3. Koszty Wysyłki (Shipping Normalization)

W afiliacji cena podstawowa to często pułapka. Harvester musi obliczyć Cenę Całkowitą.

Wymuszone pole: totalPrice = price + shippingCost.

Zawsze sprawdzamy flagę isFreeShipping (do wyświetlania zielonych "badgy" w UI).

4. FAZA 2: BAZA DANYCH I DEDUPLIKACJA (SCHEMAS)

Produkty, które przeszły sito, są poddawane kaskadowej deduplikacji:
[1. Szukaj EAN/UPC/SKU]  --->  [2. Szukaj po IdentityHash (Tytuł+Obraz)]  --->  [3. Utwórz nowy]

4.1 Schema: product_cores (Katalog Głównej)

interface ProductCore {
  id: string;
  identityHash: string;
  ean?: string;
  sku?: string;
  
  // Taksonomia przypisana z CategoryRouter
  categoryL1: string;
  categoryL2: string;
  categoryL3: string;
  
  // Dane wielojęzyczne
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  
  // Specyfikacje na podstawie 'filterableAttributes' z JSON
  coreSpecs: Record<string, string>; 
  
  images: string[];
  
  // Agregacja (Główny punkt wejścia)
  bestDealId: string | null;  // ID najtańszego AKTYWNEGO DealM6
  bestTotalPrice: number;     // price + shipping
  
  status: 'pending_ai' | 'approved';
}


4.2 Schema: deals (Oferty w Poczekalni/Głównej)

interface DealM6 {
  id: string;
  productId: string;          // FK do ProductCore
  
  // Finanse
  price: number;
  currency: string;
  shippingCost: number;
  isFreeShipping: boolean;
  totalPrice: number;
  lowestPrice30d?: number;
  
  source: 'aliexpress' | 'convertiser' | 'amazon' | 'allegro' | 'ebay';
  merchantName: string;
  affiliateLink: string;
  
  // Społeczność
  status: 'poczekalnia' | 'approved' | 'rejected' | 'expired';
  promotedAt?: Date;          // Data wejścia na główną
  addedByUserId?: string;     // W przypadku manualnego dodania przez usera
  
  // System Głosowania
  score: number;              // upvotes - downvotes
  upvotes: number;
  downvotes: number;
  temperature: number;        // Współczynnik dla sortowania 'Gorące'
}


5. FAZA 3: AI ENRICHMENT (WZBOGACANIE DANYCH)

Wzbogacanie odbywa się w tle (asynchronicznie) za pomocą workerów (np. Google Gemini).

Ekstrakcja Atrybutów: Worker pobiera ProductCore, czyta jego categoryL3 i pyta pliku JSON o tablicę filterableAttributes (np. dla L3 laptops jest to ["brand", "ram", "processor"]). AI wyciąga z opisu tylko te konkretne wartości.

Lokalizacja: Tytuł, skompresowany opis i "Selling Points" tłumaczone są na 6 obsługiwanych języków (pl, en, de, fr, es, uk).

6. FAZA 4: POCZEKALNIA I SYSTEM MODERACJI SPOŁECZNOŚCIOWEJ

Każdy nowy, zaimportowany i wzbogacony deal otrzymuje domyślnie status poczekalnia.

6.1 Algorytm Grawitacji (Time-Decay Gravity)

Firestore Trigger (lub Cron Job) przelicza co kilka minut wartość temperature dla aktywnych ofert, by zachować rotację "Gorących" deali.

const AGE_IN_HOURS = (Date.now() - deal.createdAt) / (1000 * 60 * 60);
const GRAVITY = 1.8; // Współczynnik starzenia
const BASE_SCORE = deal.upvotes - deal.downvotes;
// deal.temperature = BASE_SCORE / (AGE_IN_HOURS + 2)^GRAVITY


6.2 Automatyczny Awans (Auto-Approve)

Gdy użytkownik klika "+1", uruchamia się Trigger. Jeśli status === 'poczekalnia' oraz nowa suma punktów score >= 15 (konfigurowalny próg), oferta automatycznie zmienia status na approved i otrzymuje stempel promotedAt = now().
Opcjonalnie: Użytkownicy, którzy jako pierwsi poparli deal w poczekalni, otrzymują punkty "Reputacji Łowcy" w ramach grywalizacji.

6.3 Super User / Admin

Konta z odpowiednimi uprawnieniami widzą w interfejsie frontendowym przyciski:

⚡ Piorun (Force Approve): Wypycha deal natychmiast na stronę główną.

🗑️ Kosz (Force Reject): Wyrzuca deal ze strony.

7. FAZA 5: SEARCH ENGINE (TYPESENSE)

Wszystkie zapytania odczytujące oferty (poza panelem administracyjnym) trafiają do Typesense, chroniąc Firebase przed kosztownymi odczytami masowymi.

Poczekalnia: filter_by: "status:=poczekalnia", sort_by: "createdAt:desc"

Główna - Gorące: filter_by: "status:=approved", sort_by: "temperature:desc"

Główna - Najnowsze: filter_by: "status:=approved", sort_by: "promotedAt:desc"

SEO Wyszukiwanie: Jeśli usera szuka "komórka", silnik sięga do słownika seoKeywords w JSON, znajduje powiązanie z kategorią smartphones i poprawnie zwraca wyniki.

8. FAZA 6: STANDARDY UX/UI I RESPONSYWNOŚCI (MOBILE-FIRST)

Projekt OkazjePlus.pl opiera się na obsesyjnym podejściu Mobile-First. Płynność działania i ergonomia na smartfonach to absolutny priorytet.

8.1. Strefa Kciuka (Thumb Zone Navigation)

Mobile (< 768px): Całkowity brak górnego paska z akcjami. Wprowadzamy przyklejony do dołu Bottom Tab Bar (np. [Główna], [Poczekalnia], [Szukaj], [Konto]).

Desktop (>= 768px): Klasyczny Top Navbar i boczne Sidebary.

8.2. Shape-Shifting Karta Deala

Karta musi adaptować się do urządzenia, zachowując maksymalną gęstość informacji.

Widok Mobile (Kompaktowa Lista): Układ poziomy (obrazek po lewej, treść w środku, wielka, widoczna Cena Całkowita). Ekstremalnie łatwy dostęp do pionowego przycisku głosowania na prawej krawędzi.

Widok Desktop (Siatka Kart): Karty pionowe w siatce grid. Wielkie zdjęcia, kontrolki głosowania pod opisem.

8.3. Interakcje (Zero-Latency Feel)

Gesty (Mobile): Przesunięcie karty (Swipe) w prawo = upvote. Swipe w lewo = downvote.

Optymistyczne UI: Kliknięcie głosu zmienia licznik i kolor przycisku w milisekundach, bez czekania na sieć.

Haptic Feedback: Wibracja telefonu przy udanym głosowaniu (dla wspieranych urządzeń).

Touch Targets: Minimalny obszar klikalny dla ikon/tagów: 44x44px.

8.4. Wydajność Renderowania

Infinite Scroll z Wirtualizacją: Aby przewijanie 5 000 deali w poczekalni nie zabiło przeglądarki na telefonie, używamy bibliotek wirtualizacyjnych (np. @tanstack/react-virtual).

Prewencja CLS (Sztywne Szkielety): Wszystkie zdjęcia ofert (często ładowane z zewnętrznych domen) muszą mieć sztywno narzucony w kodzie aspect-ratio i ładować się z użyciem efektu Shimmer/Skeleton. Brak skaczących tekstów.

9. ANEKS OPERACYJNY: INDEKSY TYPESENSE (M6)

W praktyce produkcyjnej indeks `products` musi być budowany z `product_cores` (model M6), a nie tylko z legacy `products`.

Skrypt `src/scripts/typesense-sync.ts` synchronizuje teraz:

- `deals`: statusy `approved`, `poczekalnia`, `pending`, `pending_approval`, `approval`
- `products`: źródło główne `product_cores` (te same statusy) + fallback z legacy `products` (`approved`)

To zapewnia poprawne działanie widoków `waiting_room` bez pustych wyników w `/api/search`.

9.1. Wymagane zmienne środowiskowe

- `TYPESENSE_HOST`
- `TYPESENSE_PORT` (opcjonalnie, domyślnie `443`)
- `TYPESENSE_PROTOCOL` (opcjonalnie, domyślnie `https`)
- `TYPESENSE_ADMIN_API_KEY`

Uwaga: samo `NEXT_PUBLIC_TYPESENSE_HOST` nie wystarczy do indeksowania (to tylko konfiguracja kliencka).

9.2. Komenda synchronizacji

```bash
npm run typesense:sync:full
```

9.3. Szybka walidacja po sync

```bash
curl -s "http://localhost:9002/api/search?type=deals&q=*&limit=5&status=waiting_room"
curl -s "http://localhost:9002/api/search?type=products&q=*&limit=5&status=waiting_room"
```

Oczekiwany rezultat: niepuste listy (jeżeli dane istnieją w Firestore).