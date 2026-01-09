Aktualizacja (2025-11-10): System komentarzy i UX

Co zmieniono

- Real-time comments count
  - Hook `useCommentsCount` teraz korzysta z `onSnapshot` zamiast jednorazowego `getCountFromServer()`.
  - Hook zwraca: `{ count, loading, increment, decrement }`.
    - `count` = baza (snapshot.size) + `optimisticDelta` (lokalny, optymistyczny przyrost)
    - `increment()` i `decrement()` służą do optymistycznego podbijania/liczenia w UI.

- Optymistyczne UI przy dodawaniu komentarzy
  - `CommentSection` wstawia tymczasowy (lokalny) wpis natychmiast po kliknięciu "Dodaj komentarz" i wywołuje `increment()` na hooku licznika.
  - Po sukcesie requestu komponent pobiera z serwera ograniczoną listę komentarzy (limit 50) i synchronizuje stan.
  - W razie błędu wykonuje rollback: `decrement()` i ponowne pobranie listy z serwera.

- Paginacja / limitowanie wyników
  - `getComments(collectionName, docId, limitCount)` (domyślnie 20) — teraz wspiera limitowanie wyników.
  - Zaimplementowano prostą kontrolę liczby wyników; jeśli chcesz cursor-based pagination (startAfter / next page), dokoptuję to w osobnym PR.

- Testy (test-service)
  - `testCommentsCount` używa `collectionGroup('comments')` aby znaleźć przykładowe komentarze w dowolnej subkolekcji (deals/*/comments lub products/*/comments) i poprawnie porównuje `commentsCount` z rzeczywistą liczbą dokumentów w subkolekcji.
  - Dzięki temu test nie iteruje ręcznie po wszystkich dokumentach i jest bardziej odporny na strukturę danych.

Dlaczego to zrobiliśmy

- Poprawa UX: licznik komentarzy aktualizuje się natychmiast (optymistyczne UI), a jednocześnie jest synchronizowany z bazą (real-time snapshot), co minimalizuje "flicker" i opóźnienia.
- Skalowalność: pobieranie jedynie ograniczonej liczby komentarzy zamiast całej subkolekcji zmniejsza obciążenie i przyspiesza renderowanie.
- Testy: `collectionGroup` pozwala pisać testy, które sprawdzają rzeczywiste subkolekcje bez nadmiernego skanowania bazy.

Jak testować manualnie

1. Uruchom aplikację lokalnie:

```bash
npm run dev
```

2. Otwórz stronę produktu `/products/<id>` i zakładkę "Opinie".
3. Dodaj komentarz jako zalogowany użytkownik.
   - Powinieneś zobaczyć komentarz natychmiast (tymczasowy) i licznik zwiększony o 1 optymistycznie.
4. Po chwili snapshot Firestore zsynchronizuje się i optymistyczny delta zostanie zresetowany — licznik będzie pochodzić z bazy.
5. W profilu (`/profile`) sprawdź sekcję komentarzy — powinny pojawić się Twoje komentarze z kontekstem (tytuł produktu/okazji).

Implementacja w kodzie (przykłady)

- `useCommentsCount` (API):

```ts
const { count, loading, increment, decrement } = useCommentsCount('products', productId, initialCount);
```

- Optymistyczny push w `CommentSection` (schemat):

```ts
// lokalny placeholder
setComments(prev => [tempComment, ...prev]);
commentsCount.increment(1);

// await addComment(...)
// po sukcesie: fetchComments(); // synchronizacja
// po błędzie: commentsCount.decrement(1); fetchComments();
```

Dalsze kroki i sugestie

- Dodanie cursor-based pagination do `getComments()` i UI (infinite scroll lub "Pokaż więcej").
- E2E test Playwright: dodać scenariusz opisany powyżej, walidujący optymistyczny bump i późniejszą synchronizację.
- Opcjonalnie: cache serwera (Redis) by jeszcze szybciej obsługiwać częste odczyty liczników (REDIS_URL).

Pliki zmodyfikowane w repozytorium

- `src/hooks/use-comments-count.ts` — real-time + optimistic delta
- `src/components/comment-section.tsx` — optimistic add + rollback
- `src/lib/data.ts` — `getComments(..., limitCount)`
- `src/lib/test-service.ts` — `collectionGroup('comments')` w teście
- `src/app/profile/page.tsx` — pobieranie użytkownika komentarzy przez `collectionGroup`

Jeśli chcesz, przygotuję:
- e2e test Playwright (scenariusz add -> optimistic count -> final sync)
- cursor-based pagination + UI
- dokumentację API dla hooka `useCommentsCount` w formie JSDoc
