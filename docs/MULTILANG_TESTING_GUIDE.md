# Quick Start: Testing Multi-Language System

## ✅ System Jest Gotowy!

Wielojęzyczność działa **automatycznie** dla:
- ✅ **Nowych produktów** (bulk import) → tłumaczenia PL/EN/DE
- ✅ **Interfejsu** → zmiana języka przez LanguageSwitcher
- ✅ **URL routing** → `/`, `/en/`, `/de/`

---

## 🧪 Test 1: Automatyczne Tłumaczenie Produktów

### Krok 1: Bulk Import
1. **Zaloguj się** jako admin
2. **Otwórz**: `/admin/bulk-import`
3. **Kliknij**: "Skonfiguruj i Generuj Podgląd"
4. **Wybierz kategorię** i liczbę produktów (np. 5)
5. **Kliknij**: "Generuj Podgląd"

### Krok 2: Sprawdź Logi (w przeglądarce Console)
Szukaj komunikatów:
```
[Bulk Preview] 🌍 Translating product to EN, DE...
[Bulk Preview] 📦 Adding product to results: [nazwa produktu]
[Bulk Preview] Complete: X/Y products passed quality filter
```

### Krok 3: Commituj do Bazy
1. **Zaznacz produkty** (checkboxy)
2. **Kliknij**: "Commituj do Bazy"
3. **Poczekaj** na sukces

### Krok 4: Sprawdź w Firestore
1. **Otwórz**: [Firebase Console](https://console.firebase.google.com)
2. **Firestore Database** → `products`
3. **Wybierz dowolny produkt**
4. **Sprawdź pole**: `translations`

**Powinno wyglądać tak:**
```json
{
  "name": "Słuchawki bezprzewodowe Bluetooth",
  "description": "Premium jakość dźwięku...",
  "translations": {
    "en": {
      "name": "Wireless Bluetooth Headphones",
      "description": "Premium sound quality...",
      "seoKeywords": ["bluetooth headphones", "wireless", "audio"]
    },
    "de": {
      "name": "Kabellose Bluetooth-Kopfhörer",
      "description": "Premium-Klangqualität...",
      "seoKeywords": ["bluetooth kopfhörer", "kabellos", "audio"]
    }
  }
}
```

---

## 🌍 Test 2: Zmiana Języka Interfejsu

### Krok 1: Domyślny Język (Polski)
1. **Otwórz**: `https://twoja-domena.com/`
2. **Sprawdź URL**: Powinno być `/` (bez `/pl/`)
3. **Sprawdź**: Wyszukiwarka ma placeholder "Szukaj produktów, marek, kategorii..."

### Krok 2: Zmiana na Angielski
1. **Kliknij**: Ikonę 🌍 (LanguageSwitcher) w górnym prawym rogu
2. **Wybierz**: 🇬🇧 English
3. **Sprawdź URL**: Zmienił się na `/en/`
4. **Sprawdź**: Wyszukiwarka ma placeholder "Search products, brands, categories..."

### Krok 3: Zmiana na Niemiecki
1. **Kliknij**: 🌍 → 🇩🇪 Deutsch
2. **Sprawdź URL**: `/de/`
3. **Sprawdź**: Wyszukiwarka ma "Produkte, Marken, Kategorien suchen..."

### Krok 4: Nawigacja Między Stronami
1. **Będąc na** `/en/`
2. **Kliknij** jakiś link (np. produkt)
3. **Sprawdź**: URL pozostaje `/en/products/123` (język zachowany)

---

## 🔍 Test 3: Wyświetlanie Tłumaczeń Produktów

### Krok 1: Otwórz Produkt (Polski)
1. **URL**: `/products/[product-id]`
2. **Sprawdź**: Nazwa i opis po polsku

### Krok 2: Zmień Język na Angielski
1. **Kliknij**: 🌍 → 🇬🇧 English
2. **URL**: `/en/products/[product-id]`
3. **Sprawdź**: Nazwa i opis po angielsku (jeśli tłumaczenia są w bazie)

**Uwaga**: Obecnie produkty wyświetlają polskie nazwy. Aby pokazać tłumaczenia, trzeba użyć helpera:

```typescript
// W komponencie produktu
import { getProductName, getProductDescription } from '@/lib/i18n-content';
import { useLocale } from 'next-intl';

const locale = useLocale();
const name = getProductName(product, locale as 'pl' | 'en' | 'de');
const desc = getProductDescription(product, locale as 'pl' | 'en' | 'de');
```

---

## 📊 Gdzie Sprawdzić Czy Działa?

### 1. Logi Serwera (Produkcja)
```bash
gcloud logging read 'resource.type=cloud_run_revision AND jsonPayload.message=~"Translating product"' \
  --limit 10 --project okazje-plus --format json
```

**Szukaj:**
- `[Bulk Preview] 🌍 Translating product to EN, DE...`
- `Product translation completed`

### 2. Logi Przeglądarki (Dev)
Otwórz **DevTools Console** podczas bulk import:
```
[Bulk Preview] Starting AI enrichment for 10 products...
[Bulk Preview] Quality score: 85 for "Smartfon..."
[Bulk Preview] 🌍 Translating product to EN, DE...
[Bulk Preview] 📦 Adding product to results: ...
```

### 3. Firestore Database
```
Firebase Console → Firestore → products → [any product] → translations
```

Powinny być pola `en` i `de` z tłumaczeniami.

### 4. Network Tab (DevTools)
1. **Otwórz**: DevTools → Network
2. **Wykonaj**: Bulk Import Preview
3. **Znajdź**: Request do `/api/admin/bulk-import/preview`
4. **Sprawdź Response**:
```json
{
  "ok": true,
  "products": [{
    "_aiMetadata": {
      "translations": {
        "en": { "name": "...", "description": "..." },
        "de": { "name": "...", "description": "..." }
      }
    }
  }]
}
```

---

## ❌ Troubleshooting

### Problem: Brak tłumaczeń w produktach
**Przyczyna**: AI flow failuje (klucz API, timeout)

**Rozwiązanie**:
1. Sprawdź logi: `gcloud logging read` (jak wyżej)
2. Szukaj błędów: `"AI product translation failed"`
3. Sprawdź klucz: `GOOGLE_GENAI_API_KEY` w secrets
4. Jeśli failuje → używa fallbacku: `[EN] Polish Title`

### Problem: Interfejs nadal po polsku po zmianie języka
**Przyczyna**: Komponent nie używa `useTranslations`

**Rozwiązanie**:
Większość komponentów jeszcze nie zmigrowana. To jest **progressive migration**.
Obecnie zmigrano:
- ✅ search-bar.tsx
- 🔄 Inne komponenty w kolejce

### Problem: URL nie zmienia się przy zmianie języka
**Przyczyna**: LanguageSwitcher może nie być widoczny

**Rozwiązanie**:
1. Odśwież stronę (`Cmd+R`)
2. Sprawdź czy widzisz ikonę 🌍 w headerze
3. Jeśli nie → middleware może nie działać (rzadkie)

### Problem: `/en/` pokazuje 404
**Przyczyna**: Middleware nie działa lub źle skonfigurowany

**Rozwiązanie**:
1. Sprawdź `src/middleware.ts` czy istnieje
2. Sprawdź `next.config.ts` czy ma `withNextIntl()`
3. Restart dev server: `npm run dev`

---

## 🎯 Kolejne Kroki (Opcjonalne)

### Priorytet 1: Migracja Komponentów
Lista komponentów do zmigrowania na `useTranslations()`:
- [ ] Navbar links
- [ ] Footer
- [ ] Product cards
- [ ] Deal cards
- [ ] Homepage hero
- [ ] Login/Auth forms

**Jak migrować**:
1. Dodaj `useTranslations('section')`
2. Zamień hardcoded tekst na `t('key')`
3. Dodaj klucze do `messages/*.json`

### Priorytet 2: Produkty na Frontendzie
Użyj tłumaczeń z bazy:
```typescript
import { getProductName } from '@/lib/i18n-content';
import { useLocale } from 'next-intl';

const ProductCard = ({ product }) => {
  const locale = useLocale();
  return <h3>{getProductName(product, locale as any)}</h3>;
};
```

### Priorytet 3: SEO
- Dodaj `hreflang` tags
- Language-specific sitemaps
- Translated meta descriptions

---

## 📝 Podsumowanie

**Co działa automatycznie:**
- ✅ Tłumaczenie nowych produktów (PL → EN, DE) w bulk import
- ✅ Zmiana języka interfejsu przez LanguageSwitcher
- ✅ URL routing z prefiksem `/en/`, `/de/`
- ✅ Auto-detekcja języka z przeglądarki

**Co wymaga dodatkowej pracy:**
- 🔄 Migracja wszystkich komponentów na `useTranslations()`
- 🔄 Wyświetlanie tłumaczeń produktów z bazy na frontendzie
- 🔄 SEO tags (hreflang, etc.)

**Status:** ✅ **System gotowy do użycia!**

---

**Pytania?** Sprawdź:
- `docs/i18n-content-translation.md` - Phase 1 (Content)
- `docs/i18n-phase2-routing.md` - Phase 2 (Routing)
- `.github/copilot-instructions.md` - Ogólne zasady
