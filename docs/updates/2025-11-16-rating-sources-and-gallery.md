## 2025-11-16 Rozdzielenie źródeł ocen + galeria obrazów z AliExpress

Wprowadzono nowe pola w dokumencie `Product`:

### Nowe pola
1. `ratingSources` – obiekt zawierający rozdzielone źródła ocen:
   - `editorial`: ocena redakcji (średnia, count – zwykle 1, updatedAt)
   - `users`: agregowana ocena użytkowników (średnia, count, updatedAt)
   - `external`: ocena z zewnętrznego źródła (np. AliExpress) – średnia, count (zamówienia lub liczba recenzji jeśli dostępna), source, updatedAt
2. `gallery` – tablica `ProductImageEntry` maks. 10 pozycji pozyskanych z importu AliExpress.

### Kompatybilność
Dotychczasowe pole `ratingCard` pozostaje i nadal jest aktualizowane. Logika:
- Przy imporcie z AliExpress ustawiamy `ratingCard` na wartość zewnętrzną oraz `ratingSources.external`.
- Przy dodawaniu/aktualizacji ocen użytkowników (kolekcja `products/{id}/ratings`) aktualizujemy zarówno `ratingCard` jak i `ratingSources.users`.
- Docelowo komponenty UI zaczęły korzystać z `ratingSources` dla wyświetlania podziału; `ratingCard` pełni rolę fallbacku.

### Migracja istniejących dokumentów
Nie jest wymagana natychmiastowa migracja. Dla starszych dokumentów bez `ratingSources`:
- UI pokaże wartości z `ratingCard`.
- Po pierwszej nowej ocenie użytkownika pola `ratingSources.users.*` zostaną utworzone automatycznie.

Opcjonalna migracja (skrypt):
Można uruchomić jednorazowy skrypt, który:
1. Pobierze wszystkie produkty.
2. Jeśli brak `ratingSources` ustawi `ratingSources.external.average = ratingCard.average` oraz `external.count = ratingCard.count` z `source = 'legacy'`.

### Import obrazów
Import z AliExpress zbiera do 10 obrazów (jeśli dostępne) i zapisuje w `gallery` wraz z metadanymi:
```ts
{
  id: 'img_0',
  type: 'url',
  src: 'https://...jpg',
  isPrimary: true,
  source: 'aliexpress',
  addedAt: ISOString
}
```

Pierwszy obraz nadal trafia do pola `image` (thumbnail główny). Pozostałe dostępne jako galeria rozszerzona.

### Następne kroki (opcjonalne)
- Dodanie UI do edycji oceny redakcyjnej w panelu admina.
- Wyświetlenie pełnej galerii na stronie produktu (aktualnie tylko miniatura).
- Wzbogacenie źródła external o rozróżnienie liczby recenzji vs zamówień jeśli API dostarczy.

Autor zmian: AI Assistant
