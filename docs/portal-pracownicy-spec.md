# Specyfikacja Narzędzia dla Pracowników Portalu Okazje+

## 1. Cel
Portal afiliacyjny oparty o produkty AliExpress, łączący automatyzację (import, audyt) z interwencją człowieka (moderacja, decyzje publikacji). GenAI wzbogaca dane (opisy, kategorie, duplikaty), ale publikacja = decyzja ludzka.

## 2. Stos technologiczny
- **Firestore**: products, deals, users, categories, comments, import_logs, system_reports, ai_jobs
- **Cloud Functions**: enrichment, auto-fill kategorii, audyt pokrycia, soft duplicate detection
- **Firebase Storage**: galerie obrazów (manualne i importowane)
- **Cloud Scheduler**: okresowe wywołania audytów / reanaliz
- **Next.js App Router**: frontend + część API operacyjnych
- **GenAI (Gemini / Genkit)**: flows: `enrichProduct`, `expandCategory`, `detectSoftDuplicate`, `generateSeoDescription`

## 3. Role i moderacja
| Rola | Uprawnienia |
|------|-------------|
| user | Publiczne przeglądanie, komentarze |
| pracownik | Panel admina, moderacja, import ręczny, auto-fill kategorii |
| admin | Wszystko + zarządzanie rolami, strukturą kategorii |

Statusy dokumentów: `draft` → `approved` / `rejected`. Wszystko nowe = `draft`.

## 4. Kategorie
- Kolekcja `categories`: hierarchia przez `parentId` + `level` (1/2/3) i `path: string[]`.
- Import struktury z pliku .txt (wcięcia → drzewo).
- AI sugeruje brakujące gałęzie (np. "Drony" w Elektronika) → propozycja do zatwierdzenia.
- Pola AI: `ai.missingCoverage: boolean`, `ai.recommendedExpansionQueries: string[]`.

## 5. Tryby importu
### Tryb 1 – Ręczny (`/admin/import`)
1. Wyszukiwanie produktów (fraza, cena, rating). 
2. Selekcja → lista kandydatów.
3. Akcja „🤖 Zasugeruj i Wzbogać”: AI generuje SEO opisy, sugeruje kategorię, sprawdza soft duplikaty.
4. Rewizja pracownika (edycja opisów, zatwierdzenie kategorii, ignorowanie duplikatu).
5. Walidacja + zapis (status: draft). Log w `import_logs`.

### Tryb 2 – Auto wypełnianie kategorii (`/admin/categories`)
1. Klik "🤖 Wypełnij kategorię" przy docelowej kategorii.
2. AI generuje zestaw zapytań (frazy semantyczne).
3. Pobranie top N wyników / agregacja / deduplikacja.
4. Wzbogacenie dla każdego produktu.
5. Batch zapis (draft) + import_log.
6. Przejście do moderacji.

## 6. Wzbogacanie (AI)
Dla produktu:
- `seo.metaTitle`, `seo.metaDescription`, `seo.keywords[]`
- `description` / `longDescription` (optymalizacja językowa, styl, H2/H3)
- Sugerowana kategoria (`ai.suggestedCategoryPath: string[]`) + pewność
- Soft duplikat: `ai.softDuplicateOf`, `ai.softDuplicateScore`
- Flagi: `ai.flags[]` (np. `enrichment_failed`, `duplicate_suspected`)

## 7. Duplikaty
- Soft (embedding similarity ≥ threshold, np. 0.82): ostrzeżenie.
- Twardy (metadata.originalId już w bazie): blokada importu.

## 8. Galerie obrazów
- Import: wszystkie zdjęcia (filtr jakości). Zapisywane w `gallery` jako `{id,type:'url',src,isPrimary?,source:'aliexpress'}`.
- Manualne: upload → Storage → `{type:'storage'}`.
- Pracownik może ustawić `image` jako główne (`isPrimary`).
- AI może zasugerować ALT (opcjonalnie `gallery.alt`).

## 9. Audyt pokrycia kategorii
- Cloud Function co X h: liczy liczbę produktów w każdej `path`.
- Jeśli `< MIN` (np. 5) → raport w `system_reports` + `ai.missingCoverage = true`.
- Panel pokazuje listę braków → akcja auto-fill.

## 10. Logi i raporty
### import_logs
```
{ id, mode: 'manual'|'auto_fill', categoryTarget?, totalRequested, importedCount,
  skipped: [{originalId, reason}], softDuplicates: [{originalId, matchedId, score}],
  startedAt, finishedAt, durationMs, invokedBy, aiUsed }
```
### system_reports
```
{ id, type: 'coverage'|'quality', createdAt, summary, details: [{categoryId, currentCount, requiredMin, deficit, suggestedQueries?}], resolved?, resolvedAt?, triggeredBy }
```
### ai_jobs (opcjonalnie)
```
{ id, kind, status:'pending'|'running'|'completed'|'failed', inputRef, outputRef?, progress?, startedAt, finishedAt, error? }
```

## 11. Reguły biznesowe
| Reguła | Wartość |
|--------|---------|
| MIN produktów poziom 3 | 5 |
| MAX auto-fill batch | 25 |
| Soft duplicate threshold | 0.82 |
| Retry AI enrichment | 2 próby |
| Required przed approve | name, price, image, description≥50, kategoria pełna |
| SEO metaTitle | ≤65 znaków |
| SEO metaDescription | ≤160 znaków |

## 12. Backlog implementacyjny (kolejność)
1. Rozszerzenie typów (Product, Category, ImportLog, SystemReport, AIJob)
2. Cloud Function `enrichProductBatch`
3. UI rewizji enrichmentu (tryb 1)
4. Soft duplicate detection (embedding store)
5. Auto-fill function + UI hook w `/admin/categories`
6. Audyt + raporty + scheduler
7. Galeria UI (upload / reorder / primary)
8. Moderation history (audit trail)

## 13. Indeksy Firestore (propozycja)
```
products: status+mainCategorySlug+subCategorySlug, metadata.source+metadata.originalId, moderation.submittedAt
categories: parentId+level
system_reports: type+createdAt
import_logs: mode+createdAt
```

## 14. Firestore Rules (fragment – do rozszerzenia)
```
match /products/{productId} {
  allow update: if isAdmin() || (isModerator() &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'description','longDescription','seo','gallery','image','status','moderation','ai'
    ])
  );
}
```

## 15. Otwarte kwestie
- Draft kategorii (status dla category?)
- Limit równoległych zadań AI
- Wersjonowanie SEO (aiVersion vs manual override)
- Mechanizm wycofania enrichmentu

---
Dokument jest podstawą do wdrożeń – kolejne kroki: rozszerzenie typów, funkcje Cloud.
