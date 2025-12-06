# Automatyczne wyświetlanie kategorii w mega menu

## Jak to działa?

Mega menu **automatycznie** wyświetla wszystkie kategorie, podkategorie i sub-subkategorie zapisane w Firestore — **nie wymaga** żadnej dodatkowej konfiguracji w kodzie.

### Mechanizm:

1. **Funkcja `getCategories()`** (`src/lib/data.ts`):
   - Ładuje wszystkie dokumenty z kolekcji `categories`
   - Dla każdej kategorii ładuje podkategorie z:
     - Embedded array `subcategories` w dokumencie głównym (legacy)
     - Subkolekcji `categories/{categoryId}/subcategories` (nowy sposób)
   - **Dla każdej podkategorii ładuje sub-subkategorie** (poziom 3) z:
     - Embedded array `subcategories` w dokumencie podkategorii
     - Subkolekcji `categories/{categoryId}/subcategories/{subcategoryId}/subcategories`

2. **Mega menu** (`src/components/layout/mega-menu.tsx`):
   - Renderuje listę kategorii dynamicznie z wartości zwróconej przez `getCategories()`
   - Dla każdej podkategorii sprawdza `subcategory.subcategories?.length`
   - Jeśli istnieją sub-subkategorie, renderuje je jako dodatkową siatkę poniżej podkategorii

### Co się stanie po dodaniu nowego produktu z nowymi kategoriami?

**WAŻNE:** Produkt **NIE tworzy** automatycznie kategorii!

#### Prawidłowy proces:

1. **Najpierw utwórz strukturę kategorii** w Firestore:
   ```
   categories/{mainCategorySlug}/
     - name: "Nazwa kategorii"
     - slug: "main-category-slug"
     - sortOrder: 10
     - subcategories: [...]  // lub pusta tablica
   
   categories/{mainCategorySlug}/subcategories/{subCategorySlug}/
     - name: "Nazwa podkategorii"
     - slug: "sub-category-slug"
     - sortOrder: 10
     - subcategories: [...]  // tablica sub-subkategorii lub pusta
   ```

2. **Potem dodaj produkt** z odpowiednimi slugami:
   ```typescript
   {
     mainCategorySlug: "main-category-slug",
     subCategorySlug: "sub-category-slug",
     subSubCategorySlug: "sub-sub-category-slug"  // opcjonalne
   }
   ```

3. Mega menu **automatycznie** wyświetli nową kategorię przy następnym odświeżeniu strony.

### Przykład struktury Firestore:

```
categories/
  elektronika/
    - name: "Elektronika"
    - slug: "elektronika"
    - sortOrder: 10
    - icon: "💡"
    
    subcategories/
      smartfony/
        - name: "Smartfony"
        - slug: "smartfony"
        - sortOrder: 10
        - subcategories: [
            { name: "iPhone", slug: "iphone" },
            { name: "Samsung", slug: "samsung" }
          ]
      
      laptopy/
        - name: "Laptopy"
        - slug: "laptopy"
        - sortOrder: 20
```

### Narzędzie do seedowania

Użyj skryptu `npm run seed` aby automatycznie wygenerować przykładową strukturę kategorii 3-poziomowych z produktami.

### Admin UI

Panel `/admin/navigation` pozwala na:
- Dodawanie kafelków promocyjnych do kategorii
- Przypinanie ID produktów/okazji
- **NIE** zarządza strukturą kategorii (wymaga dodania osobnej strony `/admin/categories`)

## Troubleshooting

**Problem:** Nowa kategoria nie pojawia się w menu
**Rozwiązanie:** 
1. Sprawdź strukturę w Firestore Console
2. Upewnij się, że dokument ma pole `name` i `slug`
3. Odśwież stronę (menu ładuje dane przy każdym otwarciu)

**Problem:** Sub-subkategorie nie są widoczne
**Rozwiązanie:**
- Sprawdź, czy podkategoria ma pole `subcategories` (array) lub subkolekcję
- Upewnij się, że każda sub-subkategoria ma `name` i `slug`
