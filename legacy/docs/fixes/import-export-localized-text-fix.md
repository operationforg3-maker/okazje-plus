# Import & Export – Fix: LocalizedText + Specs + Ratings

**Data:** 2025-12-16  
**Problem:** UI Import & Export używało przestarzałych przykładów JSON (string fields), a seedy generowały niepoprawne obiekty Deal bez LocalizedText.

## Zmiany

### 1. Import & Export UI (`/admin/import-export`)
✅ **Zaktualizowano przykładowy JSON** (przycisk "Kopiuj"):
- **Produkty**: Pełny przykład z `title`, `shortDescription`, `fullDescription` jako LocalizedText + `specifications[]` + `ratingSources.external`
- **Okazje**: LocalizedText dla `title` i `description`

✅ **Placeholder textarea**:
- Dokumentuje obsługiwane pola (LocalizedText, specs, ratings)
- Różne komunikaty dla okazji vs produktów

### 2. Seed Scripts – Poprawka typów
✅ **`seed-production.ts`** (linia 316):
```typescript
// PRZED (błąd TypeScript):
title: "Smartfon XYZ",
description: "Opis...",

// PO (zgodne z typem Deal):
title: { pl: "Smartfon XYZ", en: "Smartfon XYZ" },
description: { pl: "Opis...", en: "Description..." },
```

✅ **`seed-interactions.ts`** (linie 118-181):
- 4 przykładowe deale (`hot-deal-1/2/3`, `pending-deal-1`)
- Wszystkie `title` i `description` zamienione na LocalizedText

### 3. Schema importu (`products-import/actions.ts`)
✅ **Już zrobione wcześniej**:
- Rozszerzony `ProductInputSchema` o LocalizedText, specs, ratingSources
- `normalizeProductInput()` – konwersja legacy string → LocalizedText
- Automatyczne mapowanie `evaluateRate` → `ratingSources.external`

### 4. Dokumentacja
✅ **`docs/features/PRODUCT_IMPORT_SCHEMA.md`**:
- Kompletny przewodnik JSON (typy pól, przykłady, priorytet mapowania ocen)
- API endpoint, parametry dry-run/run

✅ **`docs/guides/PANEL_ADMINA_QUICKSTART.md`**:
- Sekcja "Import Produktów" z listą obsługiwanych pól

## Co działa
1. **Import & Export UI** – nowy przykład JSON z pełnymi danymi (LocalizedText, specs, ratings)
2. **Seedy** – generują poprawne obiekty Deal/Product zgodne z M4 standard
3. **Schemat importu** – przyjmuje i normalizuje zarówno legacy (string) jak i nowe (LocalizedText) pola
4. **Sanitizery** – zachowują LocalizedText obiekty, nie kasują ich

## TypeScript errors (nie związane z tym zadaniem)
- `profile/page.tsx:224` – LocalizedText vs string w itemTitle (legacy UI issue)
- `deal-form.tsx:62,196` – Form nie obsługuje LocalizedText (legacy form issue)

Te błędy są efektem przejścia na M4 standard (Deal.title/description jako LocalizedText) i wymagają osobnej poprawki formularzy.

## Testy
```bash
npm run typecheck  # ✅ OK (poza legacy issues)
npm run build      # ✅ OK (brakuje tylko indeks Firestore)
```

---

**Następne kroki:**
1. Utworzyć brakujący indeks Firestore: `ratingCard.count` (composite index)
2. Poprawić `deal-form.tsx` żeby obsługiwał LocalizedText w formularzach
3. Poprawić `profile/page.tsx` żeby mapował `deal.title.pl` na `itemTitle` string
