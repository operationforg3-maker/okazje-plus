# AliExpress Open Service API — Overview (Dec 2025)

> Źródło: https://openservice.aliexpress.com/doc/api.htm (portal dynamiczny; szczegółowe parametry i przykłady są dostępne po zalogowaniu w konsoli deweloperskiej). Ten dokument podsumowuje kluczowe elementy integracji, strukturę metod oraz dobre praktyki dla zespołu Okazje Plus.

## 1. Architektura i bazowe endpointy
- **Model**: REST-like API z parametrami w query lub body (w zależności od metody), odpowiedzi w JSON.
- **Regiony bramki** (gateway): wybierane w zależności od geolokalizacji / SLA (np. `api-sg`, `api-eu`). Konkretny gateway oraz ścieżki metod są podane w portalu (doc/console).
- **Nazewnictwo metod**: zwykle `aliexpress.<domena>.<zasób>.<akcja>`, np. `aliexpress.solution.product.info.get`.
- **Wersjonowanie**: parametr `version`/`v` w zapytaniu (np. `1.0`).

## 2. Uwierzytelnianie i autoryzacja
- **OAuth 2.0** (Authorization Code):
  - Uzyskaj `app_key` i `app_secret` w konsoli.
  - Przekierowanie użytkownika na stronę zgody AliExpress → kod autoryzacyjny.
  - Wymiana kodu na `access_token` (i `refresh_token`).
  - Tokeny przekazujesz jako parametr `access_token` lub w nagłówku (wg metody w doc).
- **Odświeżanie tokena**: endpoint refresh; wymagane `refresh_token`, `app_key`, `sign`, `timestamp`.
- **Sygnatura (sign)**:
  - Tworzona z posortowanych parametrów + `app_secret` (algorytm MD5/HMAC w zależności od metody z dokumentacji).
  - Typowo pola: `app_key`, `method`, `timestamp`, `sign_method`, `version`, `access_token` (jeśli wymagany), plus payload specyficzny dla metody.
  - Kolejność i dokładny sposób konkatenacji opisany w sekcji "Signature" w portalu (sprawdź aktualny algorytm — zmiany historyczne).

## 3. Kluczowe domeny API (wysokopoziomowy przegląd)
> Szczegółowe parametry i pola odpowiedzi są w portalu; poniżej lista typowych grup metod do planowania integracji.

### 3.0 Dostępne uprawnienia (nasze konto)
- **Standard API for Publishers / Affiliates Default**: podstawowe metody afiliacyjne (generowanie linków, podstawowe feedy produktowe i kupony).
- **Advanced API (Affiliates Advanced)**: hot products query + smart match (rekomendacje), rozszerzone feedy; używaj gdy potrzebne lepsze trafienie i priorytety.
- **SKU Dimension API**: szczegóły na poziomie SKU (warianty, ceny, dostępność); istotne dla poprawnych kart produktowych i cen w wariantach.
- **Get Xinghe Merchant License**: metody do pobrania licencji sprzedawców; potrzebne do wyświetlania statusów zaufania/zgodności jeśli włączymy w UI/score.

### 3.1 Product & Offer
- **Pobieranie szczegółów produktu**: tytuł, cena, warianty, obrazy, logistyka.
- **Search/Listing**: filtrowanie po słowach kluczowych, kategoriach, cenie, ratingu.
- **Linki afiliacyjne / trackingowe**: generowanie linków z parametrami trackingu.
- **Availability & pricing**: aktualna cena, cena przed rabatem, waluty, stan magazynowy.

### 3.2 Orders & Logistics
- **Order detail**: status, buyer info (zmaskowane), kwoty, linie zamówień, adres.
- **Order list**: zakres po czasie utworzenia / modyfikacji, statusy.
- **Logistics tracking**: numer śledzenia, status przesyłki, linie logistyczne.
- **Dispute/after-sale**: dostępne w dedykowanych metodach (jeśli włączone dla aplikacji).

### 3.3 Marketing & Coupons
- **Coupons/Vouchers**: pobieranie dostępnych kuponów, sprawdzanie ważności, progów.
- **Campaign participation**: pobieranie kampanii tematycznych (np. wyprzedaże sezonowe).

### 3.4 Messaging/Notification
- **Push/Callback**: subskrypcje webhook (zamówienia, logistyka, spory).
- **In-app messages**: metody do wysyłania/odbierania wiadomości (włącz jeśli dostępne).

### 3.5 System / Metadata
- **Category tree**: listy kategorii, atrybuty, słowniki (rozmiary, kolory).
- **Country/Logistics services**: lista krajów, metod wysyłki, SLA.
- **Currency & language**: wspierane języki/waluty dla feedów.

## 4. Wzorzec wywołania (schemat ogólny)
```bash
POST https://<gateway>/router/rest
  app_key=<APP_KEY>
  method=aliexpress.solution.product.info.get
  session=<ACCESS_TOKEN>        # jeśli wymaga
  timestamp=2025-12-05 12:00:00
  sign_method=hmac
  sign=<SIGN>
  v=1.0
  format=json
  param1=value1
  param2=value2
```
- Niektóre metody używają `GET`, inne `POST` z `application/x-www-form-urlencoded` lub JSON (sprawdź w doc per metoda).
- `session` bywa równoważne `access_token` (nazwa pola zależy od metody/dokumentu).
- `timestamp` w strefie UTC lub lokalnej (zgodnie z doc). Zwykle format `yyyy-MM-dd HH:mm:ss`.

## 5. Paginacja, filtrowanie, sortowanie
- Typowe parametry: `page_no`, `page_size`, `sort` (np. `sale_price_asc`), filtry czasowe (`start_time`, `end_time`).
- Maksymalne `page_size` zależne od metody (często 50–200). 

## 6. Limity i retry
- Limit żądań per minutę/godzinę zależny od planu aplikacji; przy 429/503 stosuj **exponential backoff**.
- Dla metod wrażliwych na duży wolumen (product search) stosuj cache + delta updates po `last_modified`.

## 7. Best practices dla Okazje Plus
- **Token handling**: przechowuj `access_token` i `refresh_token` w bezpiecznym store, rotuj wg `expires_in`.
- **Signing**: zaimplementuj funkcję generującą `sign` na backendzie (Node/TS) z testami jednostkowymi.
- **Retry/backoff**: 429/500/503 → retry z rosnącym opóźnieniem; loguj `error_code` i `error_message` z odpowiedzi.
- **Localization**: wybieraj język/currency feedów (PL/EUR/USD) zależnie od widoku; mapuj kategorie do naszej taksonomii.
- **Price consistency**: używaj pola `sale_price` i `original_price`; zapisuj walutę zwróconą przez API.
- **Images**: wybieraj główny obraz + galerię; filtruj puste linki; min-width dla UI.
- **Tracking**: generuj linki z parametrami afiliacyjnymi (pid, tracking_id) zwróconymi przez metody trackingowe.
- **Rate-limit safety**: batchuj zapytania, stosuj ETag/If-Modified-Since jeśli metoda wspiera.
- **Wykorzystuj rozszerzone dostępy**: dla lepszego doboru i konwersji preferuj hot products/smart match; dla kart produktowych pobieraj poziom SKU; jeśli używamy oznaczeń zaufania sprzedawców, sięgaj po Xinghe License.

## 8. Checklist wdrożeniowy
- [ ] Uzyskaj `app_key` / `app_secret` w konsoli AE Open Service.
- [ ] Skonfiguruj redirect URI dla OAuth i przetestuj wymianę kod → `access_token`/`refresh_token`.
- [ ] Zaimplementuj generator `sign` + testy (porównaj z sample w portalu).
- [ ] Zaimplementuj klienta API (Node/TS) z globalnym retry + logging.
- [ ] Pokryj scenariusze: product search, product detail, tracking link generation, orders sync, logistics tracking.
- [ ] Dodaj webhook/callback listener (jeśli subskrybowane eventy są wymagane).
- [ ] Monitoruj quota i błędy (`error_code`, `sub_msg`).
- [ ] Zweryfikuj wykorzystanie uprawnień: Advanced (hot products, smart match), SKU Dimension (warianty), Xinghe License (oznaczenia sprzedawców), Affiliates Default (linki/kupony).

## 9. Odniesienia
- Portal dokumentacji: https://openservice.aliexpress.com/doc/api.htm
- Konsola aplikacji (App Console): dostęp po zalogowaniu
- Announcement/Status: https://openservice.aliexpress.com/announcement/index.htm

> Uwaga: Portal dokumentacji jest dynamiczny; dla pełnych opisów parametrów, przykładów i kodów błędów zaloguj się do konsoli deweloperskiej i otwórz stronę konkretnej metody (np. `docId=30115` dla OAuth/token, `docId=30116` dla signowania, `docId=30118` dla gateway).