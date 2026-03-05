# Pakiet do App Review (Meta) — publikacja postów na stronie Facebook

## Cel
Uzyskanie skutecznych uprawnień do publikacji postów na stronie Facebook `Okazje Plus` (`pageId: 895877533605655`) przez Graph API.

## Wymagane uprawnienia
- `pages_manage_posts`
- `pages_read_engagement`
- `pages_show_list`

## Krótki opis use-case (do wklejenia w App Review)
Aplikacja `Okazje Plus` służy do publikacji okazji produktowych. Administrator w panelu administracyjnym zatwierdza treść i uruchamia publikację na stronie Facebook marki. Publikacja odbywa się serwerowo przez Graph API endpoint `/{page-id}/feed`.

Uprawnienia są używane wyłącznie do:
1. odczytu listy stron (`/me/accounts`) dla wybranego administratora,
2. publikacji zatwierdzonego posta na stronie marki,
3. odczytu podstawowego statusu publikacji.

Aplikacja nie publikuje na profilach prywatnych użytkowników i nie wykonuje działań poza stroną firmową.

## Zakres danych
- Dane wejściowe: treść posta (tekst, opcjonalnie link), `pageId`, page access token
- Dane wyjściowe: `post_id` i status publikacji
- Brak przetwarzania danych wrażliwych użytkowników

## Kroki testowe dla reviewera (do wklejenia)
1. Zaloguj się kontem testowym dostarczonym do review.
2. Otwórz Graph API Explorer dla app `786622767812848`.
3. Wygeneruj User Token z uprawnieniami:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
4. Wykonaj `GET /me/accounts` i wybierz stronę `Okazje Plus`.
5. Skopiuj `access_token` strony (page token).
6. Wykonaj publikację testową:
   - `POST /895877533605655/feed`
   - body: `message=Test publikacji Okazje Plus`
7. Oczekiwany wynik: odpowiedź JSON zawierająca `id` nowego posta.

## Komendy weryfikacyjne (CLI)
```bash
# 1) Pobierz strony i page token
curl -sS "https://graph.facebook.com/v19.0/me/accounts?access_token=USER_TOKEN"

# 2) Opublikuj post
curl -sS -X POST "https://graph.facebook.com/v19.0/895877533605655/feed" \
  -d "message=Test publikacji Okazje Plus" \
  -d "access_token=PAGE_TOKEN"
```

## Checklist nagrania do App Review (video)
1. Widoczny App ID: `786622767812848`.
2. Pokazanie zaznaczonych scope w Graph API Explorer.
3. `GET /me/accounts` z wynikiem zawierającym stronę `Okazje Plus`.
4. `POST /895877533605655/feed` i odpowiedź z `id` posta.
5. Potwierdzenie w UI strony Facebook, że post został opublikowany.

## Najczęstsze przyczyny błędu (#200)
- Brak skutecznego `Advanced Access` dla `pages_manage_posts` i `pages_read_engagement`.
- Token wygenerowany przed zmianą ról/uprawnień.
- Konto generujące token nie ma pełnego `Facebook access / Full control` do strony.
- Test wykonywany kontem spoza ról aplikacji przy trybie `Development`.

## Kontrola końcowa po wdrożeniu uprawnień
1. Wygenerować nowy user token.
2. Pobrać nowy page token przez `GET /me/accounts`.
3. Powtórzyć `POST /feed`.
4. Zapisać token do konfiguracji panelu admina i zweryfikować publikację z panelu.

## Bezpieczeństwo
- Nie przechowywać tokenów w kodzie źródłowym.
- Tokeny po testach rotować/unieważniać.
- Publikację wykonywać wyłącznie po stronie serwera.
