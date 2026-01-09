# Okazje Plus - Checklist Testów Manualnych

**Data utworzenia:** 9 listopada 2025  
**Środowisko produkcyjne:** https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app/

---

## 📋 SPIS TREŚCI

1. [Testy Funkcjonalne - Użytkownik Niezalogowany (Guest)](#1-testy-funkcjonalne---użytkownik-niezalogowany-guest)
2. [Testy Funkcjonalne - Użytkownik Zalogowany (User)](#2-testy-funkcjonalne---użytkownik-zalogowany-user)
3. [Testy Funkcjonalne - Administrator (Admin)](#3-testy-funkcjonalne---administrator-admin)
4. [Testy Analityki i Tracking](#4-testy-analityki-i-tracking)
5. [Testy Wydajności i UX](#5-testy-wydajności-i-ux)
6. [Testy Bezpieczeństwa](#6-testy-bezpieczeństwa)
7. [Testy Integracyjne](#7-testy-integracyjne)
8. [Procedura Zbierania Wyników](#8-procedura-zbierania-wyników)
9. [Analiza Wyników](#9-analiza-wyników)

---

## 1. TESTY FUNKCJONALNE - Użytkownik Niezalogowany (Guest)

### 1.1 Strona Główna
- [ ] **T-G-001**: Załadowanie strony głównej w <3s
  - **Procedura**: Otwórz https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app/ w trybie incognito
  - **Oczekiwany wynik**: Strona załadowana, widoczne sekcje: Hero, Gorące Okazje, Polecane Produkty
  - **Zbieranie wyników**: Screenshot + DevTools Performance (Lighthouse)

- [ ] **T-G-002**: Wyświetlanie gorących okazji (temperatura ≥300)
  - **Procedura**: Sprawdź sekcję "🔥 Gorące Okazje" na stronie głównej
  - **Oczekiwany wynik**: Min. 3 okazje z badge "Hot", sorted by temperature DESC
  - **Zbieranie wyników**: Screenshot + liczba okazji

- [ ] **T-G-003**: Wyświetlanie polecanych produktów
  - **Procedura**: Sprawdź sekcję "🛍️ Polecane Produkty"
  - **Oczekiwany wynik**: Min. 6 produktów, badge "Top Rated" dla rating ≥4.5
  - **Zbieranie wyników**: Screenshot + liczba produktów

### 1.2 Przeglądanie Okazji
- [ ] **T-G-004**: Lista wszystkich okazji (`/deals`)
  - **Procedura**: Przejdź do /deals
  - **Oczekiwany wynik**: Lista okazji (status=approved), sortowanie, paginacja
  - **Zbieranie wyników**: Screenshot + liczba okazji na pierwszej stronie

- [ ] **T-G-005**: Filtrowanie po kategorii głównej
  - **Procedura**: Kliknij kategorię w mega menu (np. Elektronika)
  - **Oczekiwany wynik**: URL zawiera `?mainCategory=elektronika`, filtrowana lista
  - **Zbieranie wyników**: Screenshot + URL + liczba wyników

- [ ] **T-G-006**: Filtrowanie po podkategorii
  - **Procedura**: W mega menu wybierz podkategorię (np. Smartfony)
  - **Oczekiwany wynik**: URL zawiera `?subCategory=smartfony`, filtrowana lista
  - **Zbieranie wyników**: Screenshot + URL + liczba wyników

- [ ] **T-G-007**: Szczegóły okazji
  - **Procedura**: Kliknij dowolną okazję z listy
  - **Oczekiwany wynik**: Strona `/deals/[id]` z pełnymi szczegółami, temperatura, komentarze
  - **Zbieranie wyników**: Screenshot + ID okazji

- [ ] **T-G-008**: Przycisk "Go to Deal" (link zewnętrzny)
  - **Procedura**: Na stronie szczegółów kliknij "Przejdź do okazji"
  - **Oczekiwany wynik**: Otwarcie w nowej karcie, przekierowanie do `deal.link`
  - **Zbieranie wyników**: URL docelowy + czy otwarto w nowej karcie

### 1.3 Przeglądanie Produktów
- [ ] **T-G-009**: Lista wszystkich produktów (`/products`)
  - **Procedura**: Przejdź do /products
  - **Oczekiwany wynik**: Lista produktów (status=approved), rating visible
  - **Zbieranie wyników**: Screenshot + liczba produktów

- [ ] **T-G-010**: Filtrowanie produktów po kategorii
  - **Procedura**: Wybierz kategorię z menu
  - **Oczekiwany wynik**: Filtrowana lista produktów
  - **Zbieranie wyników**: Screenshot + liczba wyników

- [ ] **T-G-011**: Szczegóły produktu
  - **Procedura**: Kliknij produkt z listy
  - **Oczekiwany wynik**: Strona `/products/[id]` z rating details (tooltip 4 kryteria), komentarze
  - **Zbieranie wyników**: Screenshot + product ID

- [ ] **T-G-012**: Przycisk "Kup teraz" (link afiliacyjny)
  - **Procedura**: Na stronie produktu kliknij "Kup teraz"
  - **Oczekiwany wynik**: Otwarcie w nowej karcie, przekierowanie do `product.affiliateUrl`
  - **Zbieranie wyników**: URL docelowy + czy otwarto w nowej karcie

### 1.4 Wyszukiwanie
- [ ] **T-G-013**: Wyszukiwanie okazji przez search bar
  - **Procedura**: W search bar wpisz "laptop", Enter
  - **Oczekiwany wynik**: Strona `/search?q=laptop` z wynikami dla deals i products
  - **Zbieranie wyników**: Screenshot + liczba wyników (deals/products)

- [ ] **T-G-014**: Wyszukiwanie z pustym query
  - **Procedura**: Kliknij search bez wpisywania tekstu
  - **Oczekiwany wynik**: Komunikat walidacji lub przekierowanie do /search bez wyników
  - **Zbieranie wyników**: Screenshot + komunikat

- [ ] **T-G-015**: Wyszukiwanie bez wyników
  - **Procedura**: Wpisz "xyzabc123nonexistent"
  - **Oczekiwany wynik**: Strona search z komunikatem "Brak wyników"
  - **Zbieranie wyników**: Screenshot

### 1.5 Nawigacja i UX
- [ ] **T-G-016**: Mega menu (hover/click)
  - **Procedura**: Hover nad "Okazje" w navbar
  - **Oczekiwany wynik**: Rozwinięcie mega menu z kategoriami (5 głównych + podkategorie)
  - **Zbieranie wyników**: Screenshot mega menu

- [ ] **T-G-017**: Footer links
  - **Procedura**: Sprawdź wszystkie linki w footer (Regulamin, Polityka prywatności)
  - **Oczekiwany wynik**: Poprawne przekierowania do /regulamin i /polityka-prywatnosci
  - **Zbieranie wyników**: Lista działających linków

- [ ] **T-G-018**: Responsywność mobile (320px-768px)
  - **Procedura**: Zmień viewport na mobile (DevTools)
  - **Oczekiwany wynik**: Hamburger menu, poprawne układy kart, brak overflow
  - **Zbieranie wyników**: Screenshots (320px, 375px, 768px)

- [ ] **T-G-019**: Dark mode toggle
  - **Procedura**: Kliknij ikonę dark mode w navbar
  - **Oczekiwany wynik**: Przełączenie motywu, zachowanie wyboru w localStorage
  - **Zbieranie wyników**: Screenshot light + dark

### 1.6 Udostępnianie (Share)
- [ ] **T-G-020**: Share deal - Facebook
  - **Procedura**: Na karcie okazji kliknij "Udostępnij" → Facebook
  - **Oczekiwany wynik**: Otwarcie okna Facebook share z poprawnym URL
  - **Zbieranie wyników**: Screenshot okna share + URL

- [ ] **T-G-021**: Share deal - Twitter/X
  - **Procedura**: Kliknij "Udostępnij" → X (Twitter)
  - **Oczekiwany wynik**: Otwarcie okna Twitter z tytułem + URL
  - **Zbieranie wyników**: Screenshot + URL

- [ ] **T-G-022**: Share deal - Copy link
  - **Procedura**: Kliknij "Udostępnij" → Kopiuj link
  - **Oczekiwany wynik**: Toast "Link skopiowany", schowek zawiera pełny URL
  - **Zbieranie wyników**: Screenshot toast + zawartość schowka

---

## 2. TESTY FUNKCJONALNE - Użytkownik Zalogowany (User)

### 2.1 Autentykacja
- [ ] **T-U-001**: Rejestracja nowego użytkownika
  - **Procedura**: Kliknij "Zaloguj" → "Zarejestruj się" → wypełnij formularz (email/hasło)
  - **Oczekiwany wynik**: Konto utworzone, przekierowanie do strony głównej, user nav visible
  - **Zbieranie wyników**: Screenshot + user ID z Firestore

- [ ] **T-U-002**: Logowanie istniejącego użytkownika
  - **Procedura**: Wejdź na /login, wprowadź credentials
  - **Oczekiwany wynik**: Zalogowanie, user nav z avatarem/inicjałami
  - **Zbieranie wyników**: Screenshot navbar po logowaniu

- [ ] **T-U-003**: Wylogowanie
  - **Procedura**: Kliknij avatar → "Wyloguj się"
  - **Oczekiwany wynik**: Wylogowanie, przekierowanie do /, navbar wraca do stanu guest
  - **Zbieranie wyników**: Screenshot

- [ ] **T-U-004**: Próba dostępu do /profile bez logowania
  - **Procedura**: Otwórz /profile w trybie incognito
  - **Oczekiwany wynik**: Przekierowanie do /login
  - **Zbieranie wyników**: Screenshot + URL

### 2.2 Głosowanie (Voting)
- [ ] **T-U-005**: Głosowanie "w górę" na okazję
  - **Procedura**: Na karcie okazji kliknij ↑
  - **Oczekiwany wynik**: Temperature +1, voteCount +1, przycisk highlighted, toast "Dziękujemy"
  - **Zbieranie wyników**: Screenshot przed/po + wartości z Firestore

- [ ] **T-U-006**: Głosowanie "w dół" na okazję
  - **Procedura**: Kliknij ↓
  - **Oczekiwany wynik**: Temperature -1, voteCount -1, przycisk highlighted
  - **Zbieranie wyników**: Screenshot przed/po + wartości

- [ ] **T-U-007**: Zmiana głosu (up→down lub down→up)
  - **Procedura**: Zagłosuj ↑, potem kliknij ↓
  - **Oczekiwany wynik**: Temperature zmienia się o 2 (z +1 na -1), voteCount aktualizowany
  - **Zbieranie wyników**: Screenshot + wartości przed/po

- [ ] **T-U-008**: Idempotencja głosowania (ten sam przycisk 2x)
  - **Procedura**: Zagłosuj ↑, potem ponownie kliknij ↑
  - **Oczekiwany wynik**: Brak zmiany (temperature/voteCount bez zmian)
  - **Zbieranie wyników**: Screenshot + wartości Firestore

- [ ] **T-U-009**: Optimistic update głosowania
  - **Procedura**: Zagłosuj przy wolnym połączeniu (throttle DevTools)
  - **Oczekiwany wynik**: UI aktualizuje się natychmiast, rollback przy błędzie
  - **Zbieranie wyników**: Video + network log

### 2.3 Komentarze
- [ ] **T-U-010**: Dodanie komentarza do okazji
  - **Procedura**: Na stronie `/deals/[id]` wpisz komentarz, kliknij "Dodaj komentarz"
  - **Oczekiwany wynik**: Komentarz pojawia się na liście, commentsCount +1, toast "Komentarz dodany"
  - **Zbieranie wyników**: Screenshot + comment ID

- [ ] **T-U-011**: Dodanie komentarza do produktu
  - **Procedura**: Na `/products/[id]` dodaj komentarz
  - **Oczekiwany wynik**: Analogicznie jak dla okazji
  - **Zbieranie wyników**: Screenshot + comment ID

- [ ] **T-U-012**: Walidacja pustego komentarza
  - **Procedura**: Spróbuj wysłać pusty komentarz
  - **Oczekiwany wynik**: Brak akcji lub komunikat walidacji
  - **Zbieranie wyników**: Screenshot

- [ ] **T-U-013**: Limit długości komentarza (500 znaków)
  - **Procedura**: Wpisz komentarz >500 znaków, wyślij
  - **Oczekiwany wynik**: Firestore rules reject (lub frontend walidacja)
  - **Zbieranie wyników**: Screenshot + error message

### 2.4 Ulubione (Favorites)
- [ ] **T-U-014**: Dodanie okazji do ulubionych
  - **Procedura**: Kliknij ikonę ♡ na karcie okazji
  - **Oczekiwany wynik**: Ikona zmienia się na ♥ (red filled), doc w favorites collection
  - **Zbieranie wyników**: Screenshot + Firestore doc ID

- [ ] **T-U-015**: Usunięcie okazji z ulubionych
  - **Procedura**: Kliknij ♥ ponownie
  - **Oczekiwany wynik**: Ikona wraca do ♡, doc usunięty z favorites
  - **Zbieranie wyników**: Screenshot

- [ ] **T-U-016**: Dodanie produktu do ulubionych
  - **Procedura**: Analogicznie dla produktu
  - **Oczekiwany wynik**: Jw.
  - **Zbieranie wyników**: Screenshot + doc ID

- [ ] **T-U-017**: Lista ulubionych na profilu użytkownika
  - **Procedura**: Przejdź do /profile, zakładka "Ulubione"
  - **Oczekiwany wynik**: Lista wszystkich ulubionych (deals + products)
  - **Zbieranie wyników**: Screenshot + liczba items

### 2.5 Dodawanie Okazji
- [ ] **T-U-018**: Dodanie nowej okazji przez formularz
  - **Procedura**: Przejdź do /add-deal, wypełnij formularz (tytuł, opis, cena, link, kategoria, obraz)
  - **Oczekiwany wynik**: Okazja zapisana ze statusem "draft", toast "Okazja dodana", przekierowanie
  - **Zbieranie wyników**: Screenshot + deal ID + status w Firestore

- [ ] **T-U-019**: Walidacja formularza dodawania okazji
  - **Procedura**: Spróbuj wysłać formularz z pustymi polami wymaganymi
  - **Oczekiwany wynik**: Komunikaty walidacji przy polach
  - **Zbieranie wyników**: Screenshot błędów walidacji

- [ ] **T-U-020**: Upload obrazu okazji
  - **Procedura**: Wybierz plik obrazu w formularzu
  - **Oczekiwany wynik**: Preview obrazu, upload do Firebase Storage (opcjonalnie)
  - **Zbieranie wyników**: Screenshot preview

### 2.6 Oceny Produktów (Rating)
- [ ] **T-U-021**: Dodanie oceny produktu (4 kryteria)
  - **Procedura**: Na stronie produktu kliknij "Oceń produkt", ustaw 4 slidery (durability, value, ease, versatility)
  - **Oczekiwany wynik**: Rating zapisany w Firestore ratings/[userId]_[productId], product.ratingCard zaktualizowany
  - **Zbieranie wyników**: Screenshot formularza + rating doc ID + nowe wartości ratingCard

- [ ] **T-U-022**: Edycja własnej oceny produktu
  - **Procedura**: Ponownie otwórz formularz oceny dla tego samego produktu
  - **Oczekiwany wynik**: Formularz zawiera poprzednie wartości, można edytować
  - **Zbieranie wyników**: Screenshot + aktualizacja doc

- [ ] **T-U-023**: Próba oceny produktu bez logowania
  - **Procedura**: Wyloguj się, spróbuj ocenić produkt
  - **Oczekiwany wynik**: Przekierowanie do /login lub modal logowania
  - **Zbieranie wyników**: Screenshot

---

## 3. TESTY FUNKCJONALNE - Administrator (Admin)

### 3.1 Dostęp do Panelu Admin
- [ ] **T-A-001**: Logowanie jako admin
  - **Procedura**: Zaloguj się z kontem admin@okazjeplus.pl
  - **Oczekiwany wynik**: W navbar pojawia się link "Admin Panel"
  - **Zbieranie wyników**: Screenshot navbar

- [ ] **T-A-002**: Dostęp do /admin bez uprawnień
  - **Procedura**: Zaloguj się jako zwykły user, spróbuj wejść na /admin
  - **Oczekiwany wynik**: Przekierowanie lub brak linku
  - **Zbieranie wyników**: Screenshot + console errors (jeśli są)

### 3.2 Dashboard Admina
- [ ] **T-A-003**: Wyświetlanie statystyk na dashboardzie
  - **Procedura**: Otwórz /admin
  - **Oczekiwany wynik**: Karty z metrykami: Total Deals, Products, Users, Temperature, Analytics (views/clicks/shares/conversion/growth%)
  - **Zbieranie wyników**: Screenshot + wartości metryk

- [ ] **T-A-004**: Quick stats (real-time analytics)
  - **Procedura**: Sprawdź sekcję "Quick Stats" (views/clicks dzisiaj, conversion rate)
  - **Oczekiwany wynik**: Dane z kolekcji analytics, growth % i trendy (↑↓)
  - **Zbieranie wyników**: Screenshot

- [ ] **T-A-005**: Top content (deals/products)
  - **Procedura**: Sprawdź sekcję "Top 10 Deals/Products"
  - **Oczekiwany wynik**: Lista sorted by temperature (deals) lub rating (products)
  - **Zbieranie wyników**: Screenshot

### 3.3 Zarządzanie Okazjami (Deals Tab)
- [ ] **T-A-006**: Lista wszystkich okazji w panelu
  - **Procedura**: Przejdź do /admin, zakładka "Okazje"
  - **Oczekiwany wynik**: Tabela z deal ID, title, status, temperature, actions (View/Edit/Delete)
  - **Zbieranie wyników**: Screenshot + liczba okazji

- [ ] **T-A-007**: Filtrowanie okazji po statusie
  - **Procedura**: Użyj dropdown filter status (all/approved/draft/rejected)
  - **Oczekiwany wynik**: Filtrowana lista
  - **Zbieranie wyników**: Screenshot dla każdego statusu

- [ ] **T-A-008**: Edycja okazji przez panel admin
  - **Procedura**: Kliknij "Edit" przy okazji, zmień tytuł, zapisz
  - **Oczekiwany wynik**: Deal zaktualizowany w Firestore, toast "Zaktualizowano"
  - **Zbieranie wyników**: Screenshot + before/after Firestore

- [ ] **T-A-009**: Zmiana statusu okazji (draft → approved)
  - **Procedura**: Wybierz okazję ze statusem draft, zmień na approved
  - **Oczekiwany wynik**: Status zmieniony, okazja widoczna publicznie
  - **Zbieranie wyników**: Screenshot + weryfikacja na /deals

- [ ] **T-A-010**: Usunięcie okazji
  - **Procedura**: Kliknij "Delete", potwierdź w AlertDialog
  - **Oczekiwany wynik**: Doc usunięty z Firestore, toast "Usunięto", znika z listy
  - **Zbieranie wyników**: Screenshot + Firestore query result

- [ ] **T-A-011**: Eksport okazji do CSV
  - **Procedura**: Kliknij "Export CSV" na liście okazji
  - **Oczekiwany wynik**: Pobranie pliku deals-export.csv z kolumnami (id, title, price, status, temperature)
  - **Zbieranie wyników**: Plik CSV + screenshot pierwszych wierszy

### 3.4 Zarządzanie Produktami (Products Tab)
- [ ] **T-A-012**: Lista wszystkich produktów
  - **Procedura**: Zakładka "Produkty"
  - **Oczekiwany wynik**: Tabela z product ID, name, status, rating, actions
  - **Zbieranie wyników**: Screenshot

- [ ] **T-A-013**: Edycja produktu
  - **Procedura**: Analogicznie jak dla okazji
  - **Oczekiwany wynik**: Aktualizacja w Firestore
  - **Zbieranie wyników**: Screenshot

- [ ] **T-A-014**: Eksport produktów do CSV
  - **Procedura**: Kliknij "Export CSV"
  - **Oczekiwany wynik**: Pobranie products-export.csv
  - **Zbieranie wyników**: Plik CSV

### 3.5 Zarządzanie Użytkownikami (Users Tab)
- [ ] **T-A-015**: Lista użytkowników
  - **Procedura**: Zakładka "Użytkownicy"
  - **Oczekiwany wynik**: Tabela z user ID, email, createdAt, role, actions
  - **Zbieranie wyników**: Screenshot + liczba userów

- [ ] **T-A-016**: Zmiana roli użytkownika (user → admin)
  - **Procedura**: Kliknij "Edit", zmień role na admin, zapisz
  - **Oczekiwany wynik**: Role zaktualizowany w user doc
  - **Zbieranie wyników**: Screenshot + Firestore doc

- [ ] **T-A-017**: Eksport użytkowników do CSV
  - **Procedura**: Kliknij "Export CSV"
  - **Oczekiwany wynik**: Pobranie users-export.csv
  - **Zbieranie wyników**: Plik CSV

### 3.6 Moderacja Komentarzy
- [ ] **T-A-018**: Lista komentarzy w panelu moderacji
  - **Procedura**: Zakładka "Moderacja" (jeśli istnieje) lub sekcja komentarzy
  - **Oczekiwany wynik**: Lista komentarzy z flagą "nieodpowiednie" lub wszystkie
  - **Zbieranie wyników**: Screenshot

- [ ] **T-A-019**: Usunięcie komentarza przez admina
  - **Procedura**: Na stronie okazji/produktu, hover nad komentarzem → Trash icon (widoczny tylko dla admina)
  - **Oczekiwany wynik**: AlertDialog potwierdzenia, po OK: komentarz usunięty, commentsCount -1
  - **Zbieranie wyników**: Screenshot + Firestore query

### 3.7 Import CSV (jeśli funkcja dostępna)
- [ ] **T-A-020**: Import okazji z CSV
  - **Procedura**: Zakładka "Import", wybierz CSV z okazjami, upload
  - **Oczekiwany wynik**: Okazje dodane do Firestore, toast z liczbą zaimportowanych
  - **Zbieranie wyników**: Screenshot + liczba nowych docs

- [ ] **T-A-021**: Import produktów z CSV
  - **Procedura**: Analogicznie
  - **Oczekiwany wynik**: Produkty dodane
  - **Zbieranie wyników**: Screenshot

### 3.8 Kategorie
- [ ] **T-A-022**: Lista kategorii w panelu
  - **Procedura**: Zakładka "Kategorie"
  - **Oczekiwany wynik**: Drzewo kategorii (main + subcategories)
  - **Zbieranie wyników**: Screenshot

- [ ] **T-A-023**: Dodanie nowej kategorii
  - **Procedura**: Kliknij "Dodaj kategorię", wypełnij formularz (name, slug, type)
  - **Oczekiwany wynik**: Kategoria dodana do Firestore
  - **Zbieranie wyników**: Screenshot + doc ID

- [ ] **T-A-024**: Edycja/usunięcie kategorii
  - **Procedura**: Edit/Delete kategoria
  - **Oczekiwany wynik**: Aktualizacja/usunięcie doc
  - **Zbieranie wyników**: Screenshot

### 3.9 Analityka (Analytics Tab)
- [ ] **T-A-025**: Dashboard analityki
  - **Procedura**: Przejdź do /admin/analytics
  - **Oczekiwany wynik**: Karty z metrykami: Wizyty, Kliknięcia, Unikalni użytkownicy, Sesje, Udostępnienia, Współczynnik konwersji, Śr. sesji/użytkownik
  - **Zbieranie wyników**: Screenshot + wartości

- [ ] **T-A-026**: Wykres wyświetleń dziennie (viewsByDay)
  - **Procedura**: Sprawdź wykres słupkowy w sekcji "Wyświetlenia dziennie"
  - **Oczekiwany wynik**: Dane z ostatnich 7/14/30 dni (zależnie od filtra), tooltip na hover
  - **Zbieranie wyników**: Screenshot wykresu

- [ ] **T-A-027**: Filtr zakresu dat (7/14/30 dni)
  - **Procedura**: Zmień selektor zakresu
  - **Oczekiwany wynik**: Wykres i metryki odświeżają się, nowe dane z Firestore
  - **Zbieranie wyników**: Screenshots dla każdego zakresu

- [ ] **T-A-028**: Top Okazje (najczęściej oglądane)
  - **Procedura**: Sprawdź sekcję "Top Okazje"
  - **Oczekiwany wynik**: Lista 5 okazji z najwięcej views i clicks
  - **Zbieranie wyników**: Screenshot + deal IDs

- [ ] **T-A-029**: Top Produkty (najczęściej oglądane)
  - **Procedura**: Sprawdź sekcję "Top Produkty"
  - **Oczekiwany wynik**: Lista 5 produktów z najwięcej views i clicks
  - **Zbieranie wyników**: Screenshot + product IDs

- [ ] **T-A-030**: Google Analytics integration status
  - **Procedura**: Sprawdź sekcję "Google Analytics 4"
  - **Oczekiwany wynik**: Badge "Aktywne", link do konsoli GA4
  - **Zbieranie wyników**: Screenshot

### 3.10 Testy (Tests Tab)
- [ ] **T-A-031**: Uruchomienie testów automatycznych z panelu
  - **Procedura**: Zakładka "Testy", kliknij "Run All Tests"
  - **Oczekiwany wynik**: Wykonanie 26 testów, wyświetlenie wyników (pass/fail/warning/skip)
  - **Zbieranie wyników**: Screenshot wyników + JSON response

- [ ] **T-A-032**: Interpretacja wyników testów
  - **Procedura**: Przeanalizuj każdy test
  - **Oczekiwany wynik**: Identyfikacja failed/warning tests, link do detali
  - **Zbieranie wyników**: Lista failed tests + przyczyny

### 3.11 AI Trending Prediction
- [ ] **T-A-033**: Predykcja trending deals przez AI
  - **Procedura**: Zakładka "Trending Prediction", kliknij "Predict"
  - **Oczekiwany wynik**: AI (Genkit) analizuje deals, zwraca top 10 z uzasadnieniem
  - **Zbieranie wyników**: Screenshot + lista predicted deals

---

## 4. TESTY ANALITYKI I TRACKING

### 4.1 Google Analytics 4
- [ ] **T-AN-001**: Tracking pageview (strona główna)
  - **Procedura**: Otwórz stronę główną, sprawdź GA4 Realtime w konsoli
  - **Oczekiwany wynik**: Event "page_view" widoczny w GA4
  - **Zbieranie wyników**: Screenshot GA4 Realtime

- [ ] **T-AN-002**: Tracking view_item (okazja)
  - **Procedura**: Otwórz `/deals/[id]`, sprawdź GA4
  - **Oczekiwany wynik**: Event "view_item" z parametrami (content_type=deal, item_id)
  - **Zbieranie wyników**: Screenshot GA4 DebugView

- [ ] **T-AN-003**: Tracking vote (głosowanie)
  - **Procedura**: Zagłosuj na okazję, sprawdź GA4
  - **Oczekiwany wynik**: Custom event "vote" z vote_type (up/down)
  - **Zbieranie wyników**: Screenshot DebugView

- [ ] **T-AN-004**: Tracking share (udostępnienie)
  - **Procedura**: Udostępnij okazję przez Facebook/Twitter/Copy
  - **Oczekiwany wynik**: Event "share" z method (facebook/twitter/copy_link)
  - **Zbieranie wyników**: Screenshot DebugView

- [ ] **T-AN-005**: Tracking comment (komentarz)
  - **Procedura**: Dodaj komentarz, sprawdź GA4
  - **Oczekiwany wynik**: Event "comment" z content_type + item_id
  - **Zbieranie wyników**: Screenshot DebugView

- [ ] **T-AN-006**: Tracking search (wyszukiwanie)
  - **Procedura**: Wyszukaj "laptop", sprawdź GA4
  - **Oczekiwany wynik**: Event "search" z search_term + results_count
  - **Zbieranie wyników**: Screenshot DebugView

### 4.2 Firestore Analytics
- [ ] **T-AN-007**: Tracking view event do Firestore
  - **Procedura**: Otwórz okazję, sprawdź kolekcję `analytics` w Firestore
  - **Oczekiwany wynik**: Doc z type=view, resourceType=deal, resourceId, userId, sessionId, timestamp
  - **Zbieranie wyników**: Screenshot Firestore doc + doc ID

- [ ] **T-AN-008**: Debounced view tracking (1x per session)
  - **Procedura**: Odśwież tę samą okazję 3x
  - **Oczekiwany wynik**: Tylko 1 doc w analytics (sessionStorage zapobiega duplikatom)
  - **Zbieranie wyników**: Screenshot sessionStorage + liczba docs

- [ ] **T-AN-009**: Tracking click event
  - **Procedura**: Kliknij "Zobacz szczegóły" na karcie okazji
  - **Oczekiwany wynik**: Doc z type=click w analytics
  - **Zbieranie wyników**: Screenshot doc

- [ ] **T-AN-010**: Tracking share event do Firestore
  - **Procedura**: Udostępnij okazję
  - **Oczekiwany wynik**: Doc z type=share, metadata.platform (facebook/twitter/copy_link)
  - **Zbieranie wyników**: Screenshot doc

- [ ] **T-AN-011**: Tracking favorite event
  - **Procedura**: Dodaj okazję do ulubionych
  - **Oczekiwany wynik**: Doc z type=favorite, metadata.action=add
  - **Zbieranie wyników**: Screenshot doc

- [ ] **T-AN-012**: Tracking comment event
  - **Procedura**: Dodaj komentarz
  - **Oczekiwany wynik**: Doc z type=comment, metadata.length
  - **Zbieranie wyników**: Screenshot doc

- [ ] **T-AN-013**: Tracking vote event
  - **Procedura**: Zagłosuj
  - **Oczekiwany wynik**: Doc z type=vote, metadata.direction (up/down)
  - **Zbieranie wyników**: Screenshot doc

### 4.3 Agregacje Analytics
- [ ] **T-AN-014**: Liczenie unikalnych użytkowników
  - **Procedura**: Uruchom getGlobalAnalytics(7), sprawdź uniqueUsers
  - **Oczekiwany wynik**: Liczba distinct userId z analytics collection
  - **Zbieranie wyników**: Wartość uniqueUsers + query Firestore

- [ ] **T-AN-015**: Liczenie unikalnych sesji
  - **Procedura**: Sprawdź uniqueSessions
  - **Oczekiwany wynik**: Liczba distinct sessionId
  - **Zbieranie wyników**: Wartość uniqueSessions

- [ ] **T-AN-016**: Współczynnik konwersji (clicks/views)
  - **Procedura**: Sprawdź avgConversionRate w analytics dashboard
  - **Oczekiwany wynik**: (totalClicks / totalViews) * 100, rounded
  - **Zbieranie wyników**: Wartość + formuła weryfikacji

---

## 5. TESTY WYDAJNOŚCI I UX

### 5.1 Performance
- [ ] **T-P-001**: Lighthouse Score (Desktop)
  - **Procedura**: Uruchom Lighthouse na stronie głównej (desktop)
  - **Oczekiwany wynik**: Performance ≥90, Accessibility ≥95, Best Practices ≥90, SEO ≥90
  - **Zbieranie wyników**: Screenshot Lighthouse report + scores

- [ ] **T-P-002**: Lighthouse Score (Mobile)
  - **Procedura**: Lighthouse mobile
  - **Oczekiwany wynik**: Performance ≥80, pozostałe ≥90
  - **Zbieranie wyników**: Screenshot report

- [ ] **T-P-003**: First Contentful Paint (FCP)
  - **Procedura**: DevTools Performance tab, załaduj stronę
  - **Oczekiwany wynik**: FCP <1.8s
  - **Zbieranie wyników**: Wartość FCP z DevTools

- [ ] **T-P-004**: Largest Contentful Paint (LCP)
  - **Procedura**: Jw.
  - **Oczekiwany wynik**: LCP <2.5s
  - **Zbieranie wyników**: Wartość LCP

- [ ] **T-P-005**: Cumulative Layout Shift (CLS)
  - **Procedura**: Jw.
  - **Oczekiwany wynik**: CLS <0.1
  - **Zbieranie wyników**: Wartość CLS

- [ ] **T-P-006**: Time to Interactive (TTI)
  - **Procedura**: Jw.
  - **Oczekiwany wynik**: TTI <3.8s
  - **Zbieranie wyników**: Wartość TTI

- [ ] **T-P-007**: Bundle size (First Load JS)
  - **Procedura**: Sprawdź build output (`npm run build`)
  - **Oczekiwany wynik**: Shared chunks <150kB, route chunks <50kB (gdzie możliwe)
  - **Zbieranie wyników**: Screenshot build output

### 5.2 Lazy Loading & Code Splitting
- [ ] **T-P-008**: Images lazy loading
  - **Procedura**: Sprawdź Network tab, scrolluj listę okazji
  - **Oczekiwany wynik**: Obrazy ładowane on-demand (intersection observer)
  - **Zbieranie wyników**: Network waterfall screenshot

- [ ] **T-P-009**: Route-based code splitting
  - **Procedura**: Przejdź z / do /deals, sprawdź Network
  - **Oczekiwany wynik**: Ładowanie tylko chunków dla /deals
  - **Zbieranie wyników**: Network tab screenshot

### 5.3 User Experience (UX)
- [ ] **T-UX-001**: Loading states (skeleton screens)
  - **Procedura**: Odśwież stronę z throttled network, obserwuj ładowanie
  - **Oczekiwany wynik**: Skeleton cards widoczne podczas ładowania
  - **Zbieranie wyników**: Screenshot loading state

- [ ] **T-UX-002**: Error states (404, network errors)
  - **Procedura**: Wejdź na nieistniejący URL (/deals/nonexistent)
  - **Oczekiwany wynik**: Strona 404 z linkiem powrotu
  - **Zbieranie wyników**: Screenshot

- [ ] **T-UX-003**: Toast notifications
  - **Procedura**: Wykonaj akcję (głos, komentarz, favorite)
  - **Oczekiwany wynik**: Toast Sonner pojawia się, auto-dismiss po 3-5s
  - **Zbieranie wyników**: Screenshot toast

- [ ] **T-UX-004**: Focus states (keyboard navigation)
  - **Procedura**: Nawiguj używając Tab
  - **Oczekiwany wynik**: Widoczny focus indicator na interaktywnych elementach
  - **Zbieranie wyników**: Screenshot focused element

- [ ] **T-UX-005**: Aria labels i accessibility
  - **Procedura**: Uruchom screen reader (VoiceOver/NVDA)
  - **Oczekiwany wynik**: Wszystkie elementy poprawnie ogłaszane
  - **Zbieranie wyników**: Lista elementów z brakującymi labels (jeśli są)

---

## 6. TESTY BEZPIECZEŃSTWA

### 6.1 Firestore Rules
- [ ] **T-SEC-001**: Guest read tylko approved content
  - **Procedura**: W trybie incognito, query Firestore Console dla draft deals
  - **Oczekiwany wynik**: Permission denied
  - **Zbieranie wyników**: Screenshot error + rules log

- [ ] **T-SEC-002**: User nie może edytować cudzych deals
  - **Procedura**: Zaloguj jako userA, spróbuj edytować deal userB (np. przez API)
  - **Oczekiwany wynik**: Permission denied
  - **Zbieranie wyników**: Screenshot error

- [ ] **T-SEC-003**: Votes limit (tylko temperature i voteCount)
  - **Procedura**: Spróbuj zaktualizować deal doc z dodatkowymi polami (np. title) przez vote API
  - **Oczekiwany wynik**: Rules reject update (diff zawiera więcej niż temperature/voteCount)
  - **Zbieranie wyników**: Screenshot error + rules log

- [ ] **T-SEC-004**: Comment max length (500 chars)
  - **Procedura**: Spróbuj dodać komentarz >500 znaków przez API
  - **Oczekiwany wynik**: Rules reject
  - **Zbieranie wyników**: Screenshot error

- [ ] **T-SEC-005**: Favorites isolation (read only own)
  - **Procedura**: Zaloguj jako userA, query favorites collection dla userB
  - **Oczekiwany wynik**: Permission denied
  - **Zbieranie wyników**: Screenshot error

- [ ] **T-SEC-006**: Notifications isolation
  - **Procedura**: Analogicznie dla notifications
  - **Oczekiwany wynik**: Permission denied
  - **Zbieranie wyników**: Screenshot error

- [ ] **T-SEC-007**: Admin-only moderation (status change)
  - **Procedura**: Zaloguj jako user, spróbuj zmienić status deal z draft na approved
  - **Oczekiwany wynik**: Permission denied
  - **Zbieranie wyników**: Screenshot error

### 6.2 Authentication & Authorization
- [ ] **T-SEC-008**: Redirect do /login dla protected routes
  - **Procedura**: W trybie incognito, spróbuj wejść na /profile
  - **Oczekiwany wynik**: Przekierowanie do /login
  - **Zbieranie wyników**: Screenshot + URL

- [ ] **T-SEC-009**: Admin panel access control
  - **Procedura**: Zaloguj jako zwykły user, spróbuj wejść na /admin
  - **Oczekiwany wynik**: Brak dostępu lub przekierowanie
  - **Zbieranie wyników**: Screenshot

- [ ] **T-SEC-010**: XSS protection (input sanitization)
  - **Procedura**: Spróbuj dodać komentarz z HTML/script tags
  - **Oczekiwany wynik**: Tags escaped lub usunięte
  - **Zbieranie wyników**: Screenshot rendered content

- [ ] **T-SEC-011**: CSRF protection (Firebase handles)
  - **Procedura**: Sprawdź headers w mutating requests
  - **Oczekiwany wynik**: Firebase Auth token w Authorization header
  - **Zbieranie wyników**: Network tab screenshot

### 6.3 Rate Limiting & Abuse Prevention
- [ ] **T-SEC-012**: Vote rate limiting (max 1 vote per deal per user)
  - **Procedura**: Spróbuj zagłosować 10x na tę samą okazję szybko
  - **Oczekiwany wynik**: Idempotencja lub rate limit error
  - **Zbieranie wyników**: Screenshot + liczba zapisanych votes

- [ ] **T-SEC-013**: Comment spam prevention
  - **Procedura**: Spróbuj dodać 20 komentarzy w ciągu 1 minuty
  - **Oczekiwany wynik**: Rate limit error (jeśli zaimplementowany) lub manual moderation
  - **Zbieranie wyników**: Screenshot + liczba dodanych komentarzy

---

## 7. TESTY INTEGRACYJNE

### 7.1 Firebase Integration
- [ ] **T-INT-001**: Firestore connection
  - **Procedura**: Sprawdź, czy app łączy się z Firestore (check devtools console)
  - **Oczekiwany wynik**: Brak błędów połączenia
  - **Zbieranie wyników**: Screenshot console

- [ ] **T-INT-002**: Firebase Auth flow
  - **Procedura**: Pełny flow rejestracja → logowanie → wylogowanie
  - **Oczekiwany wynik**: User doc utworzony w Firestore, auth state poprawnie zarządzany
  - **Zbieranie wyników**: Screenshot + user doc ID

- [ ] **T-INT-003**: Firebase Storage (jeśli używany)
  - **Procedura**: Upload obrazu okazji
  - **Oczekiwany wynik**: Plik zapisany w Storage bucket, URL w deal doc
  - **Zbieranie wyników**: Storage console screenshot + URL

### 7.2 Typesense Integration (Search)
- [ ] **T-INT-004**: Typesense connection
  - **Procedura**: Wykonaj wyszukiwanie, sprawdź Network tab
  - **Oczekiwany wynik**: Request do Typesense API lub fallback do Firestore
  - **Zbieranie wyników**: Network tab screenshot

- [ ] **T-INT-005**: Search fallback (Typesense unavailable)
  - **Procedura**: Jeśli Typesense nie skonfigurowany, sprawdź czy działa Firestore fallback
  - **Oczekiwany wynik**: Wyszukiwanie działa przez Firestore
  - **Zbieranie wyników**: Screenshot wyników + console log

### 7.3 AI Integration (Genkit)
- [ ] **T-INT-006**: AI trending prediction
  - **Procedura**: W admin panel, uruchom Trending Prediction
  - **Oczekiwany wynik**: API call do Genkit flow, zwrot top 10 deals z reasoning
  - **Zbieranie wyników**: Screenshot wyników + response JSON

- [ ] **T-INT-007**: AI error handling
  - **Procedura**: Jeśli Genkit unavailable, sprawdź obsługę błędu
  - **Oczekiwany wynik**: Graceful error message, brak crash
  - **Zbieranie wyników**: Screenshot error message

---

## 8. PROCEDURA ZBIERANIA WYNIKÓW

### 8.1 Narzędzia
- **Browser DevTools**: Chrome/Firefox DevTools (Network, Console, Performance, Lighthouse)
- **Firestore Console**: https://console.firebase.google.com/project/okazje-plus/firestore
- **Firebase Auth Console**: https://console.firebase.google.com/project/okazje-plus/authentication
- **Google Analytics 4**: https://analytics.google.com/analytics/web/#/p491578768/
- **Screen Recording**: QuickTime (macOS), OBS, lub ShareX (Windows)
- **Screenshots**: Cmd+Shift+4 (macOS), Win+Shift+S (Windows)

### 8.2 Template Raportu (dla każdego testu)
Dla każdego testu wypełnij:

```markdown
## Test ID: [T-XX-YYY]
**Nazwa:** [Nazwa testu]
**Kategoria:** [Guest/User/Admin/Analytics/Performance/Security/Integration]
**Data wykonania:** [YYYY-MM-DD HH:MM]
**Tester:** [Imię]
**Przeglądarka:** [Chrome 120 / Firefox 121 / Safari 17]
**Środowisko:** [Production URL]

### Procedura
[Kroki wykonane]

### Oczekiwany wynik
[Co powinno się stać]

### Rzeczywisty wynik
[Co faktycznie się stało]

### Status
- [ ] ✅ PASS
- [ ] ❌ FAIL
- [ ] ⚠️ WARNING
- [ ] ⏭️ SKIP

### Artefakty
- Screenshot 1: [link/nazwa pliku]
- Screenshot 2: [link/nazwa pliku]
- Video: [link]
- Firestore doc ID: [ID]
- Console log: [snippet]

### Uwagi
[Dodatkowe obserwacje, edge cases, etc.]
```

### 8.3 Struktura Folderów Artefaktów
```
test-results/
├── guest/
│   ├── T-G-001_homepage_load.png
│   ├── T-G-002_hot_deals.png
│   └── ...
├── user/
│   ├── T-U-001_registration.png
│   ├── T-U-005_vote_up_before.png
│   ├── T-U-005_vote_up_after.png
│   └── ...
├── admin/
│   ├── T-A-001_admin_navbar.png
│   ├── T-A-003_dashboard.png
│   └── ...
├── analytics/
│   ├── T-AN-001_ga4_pageview.png
│   ├── T-AN-007_firestore_view_doc.png
│   └── ...
├── performance/
│   ├── T-P-001_lighthouse_desktop.png
│   ├── T-P-002_lighthouse_mobile.png
│   └── ...
├── security/
│   ├── T-SEC-001_guest_draft_deny.png
│   └── ...
├── integration/
│   ├── T-INT-001_firestore_connection.png
│   └── ...
└── summary/
    ├── test-summary.md
    ├── failed-tests.md
    └── recommendations.md
```

### 8.4 Automatyzacja Zbierania (opcjonalnie)
Dla powtarzalnych testów można użyć:
- **Playwright** lub **Cypress** do automatyzacji UI tests
- **Lighthouse CI** do automatycznego generowania raportów Performance
- **Firebase Emulator** do testów Firestore rules w CI/CD

---

## 9. ANALIZA WYNIKÓW

### 9.1 Metryki Sukcesu
- **Pass Rate:** (liczba PASS / total tests) * 100 ≥ 90%
- **Critical Failures:** 0 (kategoria Security + Authentication)
- **Performance Score:** Lighthouse ≥ 85 (mobile), ≥ 90 (desktop)
- **Accessibility Score:** ≥ 95

### 9.2 Kategoryzacja Problemów
#### 🔴 Critical (Blocker)
- Security vulnerabilities (unauthorized access, XSS, data leak)
- Complete feature breakdown (nie działa logowanie, dodawanie okazji crash)
- Data corruption (błędne zapisywanie danych)

#### 🟠 High (Major)
- Broken core functionality (voting nie działa, komentarze nie zapisują się)
- Performance degradation (LCP >4s, TTI >5s)
- Accessibility blockers (brak keyboard navigation, screen reader fails)

#### 🟡 Medium (Minor)
- UI glitches (layout shift, missing styles)
- Non-critical warnings (console errors bez wpływu na funkcjonalność)
- UX issues (confusing messaging, slow feedback)

#### 🟢 Low (Trivial)
- Typos, visual inconsistencies
- Non-blocking warnings w testach automatycznych
- Minor performance optimizations

### 9.3 Report Template - Podsumowanie
```markdown
# Test Report Summary - Okazje Plus
**Data:** [YYYY-MM-DD]
**Środowisko:** Production (https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app/)
**Liczba testów:** [X]

## Statystyki
- ✅ PASS: [X] ([%])
- ❌ FAIL: [X] ([%])
- ⚠️ WARNING: [X] ([%])
- ⏭️ SKIP: [X] ([%])

## Failed Tests (Priority)
### 🔴 Critical
1. [T-SEC-002] - User może edytować cudze deals
   - **Impact:** Data integrity breach
   - **Recommendation:** Fix Firestore rules ASAP

### 🟠 High
2. [T-A-009] - Zmiana statusu nie propaguje do frontend
   - **Impact:** Moderation workflow broken
   - **Recommendation:** Clear cache + add revalidation

### 🟡 Medium
3. [T-UX-002] - 404 page brak stylu
   - **Impact:** Poor UX
   - **Recommendation:** Create custom 404 component

## Warnings
1. [T-A-004] - Temperature unusual (398 for 1 vote)
   - **Note:** Check vote calculation logic, może być feature

## Performance Summary
- Desktop Lighthouse: [Score]
- Mobile Lighthouse: [Score]
- LCP: [value]
- CLS: [value]

## Recommendations
1. **Security:** [lista akcji]
2. **Performance:** [lista akcji]
3. **UX:** [lista akcji]
4. **Code Quality:** [lista akcji]

## Next Steps
- [ ] Fix critical issues
- [ ] Re-run failed tests
- [ ] Deploy hotfix
- [ ] Full regression test
```

### 9.4 Continuous Monitoring
Po zakończeniu testów manualnych:
1. **Setup monitoring alerts** (Firebase Console → Monitoring)
2. **Enable Error Reporting** (Sentry/Firebase Crashlytics)
3. **Schedule regular audits** (co tydzień: Lighthouse, co miesiąc: pełny manual test)
4. **Track analytics KPIs** (bounce rate, conversion rate, session duration)

---

## 📊 STATUS TESTÓW

**Ostatnia aktualizacja:** [YYYY-MM-DD HH:MM]

| Kategoria | Total | Pass | Fail | Warning | Skip | Pass % |
|-----------|-------|------|------|---------|------|--------|
| Guest     | 22    | -    | -    | -       | -    | -      |
| User      | 23    | -    | -    | -       | -    | -      |
| Admin     | 33    | -    | -    | -       | -    | -      |
| Analytics | 16    | -    | -    | -       | -    | -      |
| Performance | 9  | -    | -    | -       | -    | -      |
| Security  | 13    | -    | -    | -       | -    | -      |
| Integration | 7  | -    | -    | -       | -    | -      |
| **TOTAL** | **123** | **-** | **-** | **-** | **-** | **-%** |

---

## 🔗 LINKI UŻYTECZNE

- **Production URL:** https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app/
- **Firebase Console:** https://console.firebase.google.com/project/okazje-plus
- **GA4 Console:** https://analytics.google.com/analytics/web/#/p491578768/
- **GitHub Repo:** https://github.com/operationforg3-maker/okazje-plus
- **Automated Tests API:** https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app/api/admin/tests/run

---

**Koniec checklisty**
