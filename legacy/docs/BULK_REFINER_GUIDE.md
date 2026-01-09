# Bulk AI Refiner - Przewodnik Użytkowania

**Data:** 30 grudnia 2025  
**Status:** ✅ Gotowe do użycia w produkcji

## Co to jest Bulk Refiner?

System do masowego wzbogacania produktów w bazie za pomocą AI (Gemini) i automatyzacji.

### Problem który rozwiązuje

Po imporcie produktów przez **Harvester M6**, produkty mają status `draft` i zawierają surowe dane:
- Nieuporządkowane specyfikacje
- Brak opisów (tylko tytuł z AliExpress)
- Brak tłumaczeń (PL/EN/DE)
- Brak `searchTags` (potrzebne do wyszukiwania)
- Brak `qualityScore` (0-100, używane do rankingu)

**Bulk Refiner** przetwarza wszystkie produkty naraz zamiast ręcznego uruchamiania skryptów.

---

## Dostęp

**URL:** https://okazjeplus.pl/pl/admin/m6-import-dashboard

Panel znajduje się **poniżej Quick Stats**, przed sekcją "Danger Zone".

### Wymagania:
- Zalogowany admin (`role: 'admin'`)
- Token autoryzacji aktywny (auto-refresh co 8s)

---

## Interface użytkownika

### Pola formularza:

1. **Status produktów** (dropdown):
   - `Wszystkie` - procesuj wszystkie ProductCore w bazie
   - `Draft` - tylko nieprzetworzone (po świeżym imporcie)
   - `Pending Approval` - czekające na zatwierdzenie
   - `Approved` - zatwierdzone (re-refinement)
   - `Rejected` - odrzucone

2. **Limit (maks produktów)** (input number, 1-1000):
   - Ile maksymalnie produktów przetworzyć w jednym jobie
   - **Default: 100**
   - **Uwaga:** Duże limity = więcej quota AI

3. **Typ refinementu** (dropdown):
   - `Full Enrichment (AI + specs)` - pełne wzbogacenie z AI
   - `Specs Cleanup Only` - tylko normalizacja specs (bez AI, szybsze)

### Przyciski:

- **Podgląd (count)**: Zlicza ile produktów pasuje do filtru (bez wykonywania refinementu)
- **Uruchom Bulk Refiner**: Startuje job (z potwierdzeniem)

---

## Jak używać (krok po kroku)

### Scenariusz 1: Pierwsze wzbogacenie po imporcie

1. Zaloguj się jako admin
2. Idź do https://okazjeplus.pl/pl/admin/m6-import-dashboard
3. Znajdź panel **"Bulk AI Refiner"**
4. Ustaw:
   - Status: `Draft`
   - Limit: `100` (lub mniej jeśli testujesz)
   - Typ: `Full Enrichment (AI + specs)`
5. Kliknij **"Podgląd (count)"** - sprawdź ile produktów zostanie przetworzonych
6. Kliknij **"Uruchom Bulk Refiner"**
7. Potwierdź dialog: ⚠️ Rozpocząć refinement 100 produktów...?
8. Poczekaj na komunikat: ✅ Bulk refinement uruchomiony! Job ID: refiner-bulk-1735...
9. **Odśwież stronę za 30-60 sekund** aby zobaczyć postęp

### Scenariusz 2: Re-refinement zatwierdzonych produktów

Użyj gdy chcesz poprawić opisy/specs istniejących produktów:

1. Status: `Approved`
2. Limit: `50` (mniejszy dla testów)
3. Typ: `Full Enrichment` (lub `Specs Cleanup` jeśli tylko specs)
4. Uruchom

### Scenariusz 3: Szybka normalizacja specs (bez AI)

Gdy chcesz tylko uporządkować specyfikacje bez kosztów AI:

1. Status: `Draft` (lub `Approved`)
2. Limit: `500` (może być większy, bo bez AI)
3. Typ: `Specs Cleanup Only`
4. Uruchom

---

## Co robi Refiner?

### Full Enrichment (AI + specs):

1. **Kategorie**: Mapuje produkt do najgłębszej kategorii (subsub)
2. **Specs normalizacja**: 
   - Wydobywa RAM/Storage/Screen z title i specs
   - Standaryzuje klucze (np. "RAM" zamiast "Memory")
3. **AI descriptions** (Gemini 2.0 Flash):
   - Generuje 3 opisy: PL, EN, DE
   - `shortDescription` (1-2 zdania, ~100 chars)
   - `fullDescription` (szczegółowy, 200-300 chars)
4. **Quality Score** (0-100):
   - Bazuje na kompletności danych (image, specs, description)
   - Wyższy score = lepszy ranking w UI
5. **Search Tags**:
   - Ekstrahuje słowa kluczowe z title/specs
   - Używane w Typesense search
6. **Status update**: `draft` → `pending_approval`

### Specs Cleanup Only:

- Tylko punkt 1-2 powyżej
- **Brak wywołań AI** (0 kosztów quota)
- **Szybsze wykonanie** (~1-2s per product vs ~5-10s z AI)
- Status **nie zmienia się** (pozostaje `draft`)

---

## Monitoring postępu

### Opcja 1: Odśwież dashboard

Po uruchomieniu joba:
1. Poczekaj 30-60 sekund
2. Odśwież stronę (F5)
3. Sprawdź **Quick Stats** - liczba produktów powinna rosnąć

### Opcja 2: Logi API (dla deweloperów)

```bash
# Via curl (zamień TOKEN i JOB_ID)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://okazjeplus.pl/api/admin/refiner-logs/refiner-bulk-1735...
```

Zwraca:
```json
{
  "success": true,
  "job": {
    "id": "refiner-bulk-1735...",
    "status": "completed",
    "productsProcessed": 100,
    "productsSuccessful": 98,
    "productsFailed": 2,
    "logs": [...]
  }
}
```

---

## Limity i wydajność

### Quota AI (Gemini):

**Full Enrichment:**
- 1 produkt = 1 API call do Gemini
- Limit: 100 produktów = 100 calls
- **UWAGA:** Gemini ma limit ~60 RPM (requests per minute) w free tier
- **Rekomendacja:** Limit ≤ 100 dla jednego joba

**Specs Cleanup:**
- 0 API calls
- Bez limitów quota

### Czas wykonania:

| Typ refinementu | Produktów | Czas (szacunkowo) |
|----------------|-----------|-------------------|
| Full Enrichment | 50 | ~5-8 minut |
| Full Enrichment | 100 | ~10-15 minut |
| Specs Cleanup | 100 | ~2-3 minuty |
| Specs Cleanup | 500 | ~10-12 minut |

### Firestore limits:

- Max 500 writes per batch transaction
- Refiner używa pojedynczych writes (nie batch)
- **Bezpieczny limit:** 1000 produktów per job

---

## Troubleshooting

### Problem: "Brak tokenu administratora"

**Przyczyna:** Token wygasł lub nie jesteś zalogowany jako admin

**Rozwiązanie:**
1. Wyloguj się i zaloguj ponownie
2. Sprawdź w konsoli przeglądarki: `localStorage.getItem('userRole')` → powinno być `"admin"`
3. Jeśli nie, poproś super admina o nadanie uprawnień

### Problem: Job uruchomiony ale brak postępu

**Przyczyna:** Job może być w kolejce lub wystąpił błąd

**Rozwiązanie:**
1. Sprawdź logi API: `GET /api/admin/refiner-logs/{jobId}`
2. Sprawdź Cloud Functions logs w Firebase Console
3. Sprawdź Firestore collection `refiner_jobs` - znajdź swój job po ID

### Problem: "Query requires an index"

**Przyczyna:** Brak indexu Firestore dla query

**Rozwiązanie:**
1. Kliknij link w błędzie (prowadzi do Firebase Console)
2. Poczekaj 2-5 minut na stworzenie indexu
3. Uruchom ponownie

### Problem: Produkty nadal mają status "draft"

**Przyczyna:** Użyłeś `Specs Cleanup Only` (nie zmienia statusu)

**Rozwiązanie:**
- Uruchom ponownie z `Full Enrichment`
- Lub ręcznie zmień status w admin panel

### Problem: Quota exceeded (Gemini)

**Przyczyna:** Przekroczono limity API (60 RPM)

**Rozwiązanie:**
1. Poczekaj 1 minutę i uruchom ponownie
2. Użyj mniejszego limitu (≤50)
3. Rozważ `Specs Cleanup Only` dla dużych batch'y

---

## Best Practices

### DO ✅

- **Testuj na małych limitach** (10-20 produktów) przed dużymi jobami
- **Używaj "Podgląd"** przed uruchomieniem (weryfikacja liczby produktów)
- **Specs Cleanup first** dla dużych importów (szybkie, tanie)
- **Full Enrichment later** dla zatwierdzonych produktów (lepsze opisy)
- **Monitoruj quota** w Google Cloud Console

### DON'T ❌

- **Nie uruchamiaj wielu jobów równocześnie** (quota AI)
- **Nie używaj limitu >100** przy Full Enrichment (timeout risk)
- **Nie refinuj "Approved" produktów** bez powodu (zmarnowane quota)
- **Nie ignoruj błędów** w logach (mogą być systemowe)

---

## API Reference (dla deweloperów)

### POST /api/admin/refiner/bulk

**Request:**
```json
{
  "status": "draft",
  "limit": 100,
  "refinementType": "full_enrichment"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Bulk refinement started",
  "jobId": "refiner-bulk-1735555555555",
  "status": "running",
  "query": {
    "status": "draft",
    "limit": 100,
    "refinementType": "full_enrichment"
  }
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Unauthorized - admin only"
}
```

### GET /api/admin/refiner/bulk?status=draft

**Response:**
```json
{
  "success": true,
  "query": {
    "status": "draft"
  },
  "totalProducts": 247,
  "message": "Found 247 products matching filter"
}
```

---

## Changelog

**v1.0.0** (30 grudnia 2025):
- Initial release
- Panel UI w M6 Dashboard
- API endpoints (POST/GET)
- Obsługa Full Enrichment + Specs Cleanup
- Status filtering
- Limit validation (1-1000)

---

## Support

**Issues:** Zgłoś problem przez GitHub Issues  
**Questions:** Slack #m6-import-help  
**Docs:** `docs/milestones/M6_PRODUCT_CENTRIC_ARCHITECTURE.md`
