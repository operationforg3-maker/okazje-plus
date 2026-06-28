# Okazje Plus UI Redesign Roadmap

## Cel
Przygotować ukryte strony podglądowe dla czterech nowych wariantów UX i wdrożyć je na produkcję w postaci ukrytych adresów URL. Dzięki temu nowe koncepty mogą być ocenione bez eksponowania ich w głównej nawigacji.

## Ukryte adresy podglądowe
- `/pl/preview` — lista projektów
- `/pl/preview/design-1` — AI Concierge
- `/pl/preview/design-2` — Editorial Magazine
- `/pl/preview/design-3` — Speedboard / Quick Scan
- `/pl/preview/design-4` — Conversational Funnel

## Etapy wdrożenia

### Etap 1 — Ustalenie infrastruktury ukrytych podglądów
- Dodaj nową sekcję tras w `src/app/[locale]/preview/`.
- Stwórz stronę indeksową, która nie jest wystawiona w żadnym głównym menu.
- Ustaw metadane `robots: { index: false, follow: false }` dla wszystkich stron podglądowych.
- Upewnij się, że podglądowe strony dalej korzystają ze standardowego layoutu `src/app/[locale]/layout.tsx`.

### Etap 2 — Implementacja 4 wariantów UX
- Dla każdego wariantu stwórz samodzielną stronę z przykładowym landingiem, widokiem dealowym, widokiem produktu i kilkoma kartami demonstracyjnymi.
- Użyj istniejącego systemu stylów Tailwind i komponentów UI.
- Zachowaj eleganckie wizualne różnice między wariantami.
- Nie musisz integrować jeszcze rzeczywistego searcha ani backendu — wystarczy wiarygodny prototyp wizualny.

### Etap 3 — Podgląd i feedback
- Umożliw dostęp do nowych wariantów tylko poprzez bezpośrednie URL.
- Przekaż linki do zespołu UX / PM / stakeholderów w celu oceny.
- Zbierz uwagi, priorytety i wyboru najlepszego kierunku.

### Etap 4 — Przygotowanie do wdrożenia produkcyjnego
- Po wyborze wariantu przenieś finalny układ do właściwych tras głównych (`/pl`, `/pl/deals`, `/pl/products`).
- Dodaj ewentualny feature flag lub roboczy warunek, jeśli chcesz etapową aktywację.
- Usuń lub zachowaj wersje podglądowe jako archiwum eksperymentalne.

### Etap 5 — Testowanie i obserwacja
- Przetestuj nowe strony pod kątem dostępności, responsywności i czasu ładowania.
- Uruchom build i sprawdź brak błędów TypeScript/ESLint.
- Po wdrożeniu monitoruj zachowanie i wskaźniki oraz porównaj je z dotychczasowym UX.

## Techniczne założenia
- Wszystkie nowe strony są wdrożone w standardowej aplikacji Next.js jako route pod `src/app/[locale]/preview/`.
- Strony pozostaną ukryte, ponieważ nie będą linkowane z głównego menu ani innych widocznych sekcji.
- Metadata stron będzie zawierać `noindex`, aby unikać indeksowania przez wyszukiwarki.
- Layout będzie korzystał z istniejących providerów (`AuthProvider`, `CurrencyProvider`, `SmartCartProvider`) w `src/app/[locale]/layout.tsx`.

## Zalecenie
Najlepiej wdrożyć wszystkie cztery warianty równolegle jako podglądowe strony i dopiero potem wybrać najlepszy kierunek. W ten sposób można szybko przetestować koncepcje z użytkownikami wewnętrznymi lub z wybranym gronem beta.
