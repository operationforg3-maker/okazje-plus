# 🔧 Troubleshooting: Google Analytics i Google Tag nie działają

## 📋 Status aktualny (20 grudnia 2025)

### Twoje ID:
- **Google Analytics 4**: `G-FT6DRFR25D` ✅ (poprawne)
- **Google Tag**: `GT-T9WXFDLK` ✅ (poprawne)

### ❌ Problemy zidentyfikowane:

1. **BRAK zmiennej środowiskowej `NEXT_PUBLIC_GTM_ID`** w `.env.local`
2. **GoogleTagManager component zwraca `null`** gdy brak GTM_ID
3. **Hardcoded GA4 ID** w `src/lib/analytics.ts` nie jest używane
4. **Brak właściwej integracji** między GTM a GA4

---

## 🔍 Dlaczego nic nie działa?

### Problem #1: GTM nie ładuje się

**Lokalizacja**: `src/components/analytics/google-tag-manager.tsx`

```tsx
export function GoogleTagManager() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;  // ← UNDEFINED!
  
  if (!gtmId) return null;  // ← Kończy się tutaj - nic nie ładuje
  
  // ... reszta kodu nigdy się nie wykonuje
}
```

**Efekt**: Komponent renderuje `null`, więc żaden script GA/GTM nie jest dodawany do strony.

### Problem #2: Hardcoded GA4 nie jest używane

**Lokalizacja**: `src/lib/analytics.ts`

```typescript
export const GA_TRACKING_ID = 'G-FT6DRFR25D';  // ← Jest zdefiniowane
// ALE nigdzie nie jest ładowane!
```

Funkcje jak `trackEvent()`, `trackVote()` etc. wywołują `window.gtag()`, ale gtag.js **nigdy nie jest załadowane**, bo:
- GTM component zwraca `null` (brak GTM_ID)
- Brak bezpośredniego script'a GA4 w layout.tsx

---

## ✅ Rozwiązanie (2 opcje)

### **OPCJA A: Szybka naprawa - dodaj bezpośrednio GA4** (5 minut)

Jeśli chcesz tylko Google Analytics 4 bez GTM:

#### Krok 1: Dodaj script GA4 do layout.tsx

**Plik**: `src/app/[locale]/layout.tsx`

Dodaj przed zamknięciem `</head>`:

```tsx
<head>
  {/* ... istniejące tagi ... */}
  
  {/* Google Analytics 4 */}
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-FT6DRFR25D"></script>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-FT6DRFR25D', {
          page_path: window.location.pathname,
        });
      `,
    }}
  />
  
  {/* Google Tag (jeśli używasz) */}
  <script async src="https://www.googletagmanager.com/gtag/js?id=GT-T9WXFDLK"></script>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        gtag('config', 'GT-T9WXFDLK');
      `,
    }}
  />
</head>
```

#### Krok 2: Usuń niedziałający AnalyticsProvider

W tym samym pliku `src/app/[locale]/layout.tsx`, **usuń** linię:

```tsx
<AnalyticsProvider />  // ← USUŃ to
```

#### Krok 3: Rebuild i deploy

```bash
npm run build
npm run deploy:hosting  # lub deploy:prod
```

#### Krok 4: Weryfikacja

1. Otwórz https://okazjeplus.pl
2. Otwórz DevTools → Console
3. Wpisz: `window.gtag`
4. Powinno zwrócić: `ƒ gtag(){dataLayer.push(arguments);}`
5. Sprawdź w GA4 Real-Time czy widzisz ruch (czekaj 5-10 minut)

---

### **OPCJA B: Profesjonalna konfiguracja - użyj GTM** (30 minut)

Jeśli chcesz pełną kontrolę nad wszystkimi tagami (GA4, Facebook Pixel, etc.):

#### Krok 1: Utwórz kontener GTM

1. Przejdź do: https://tagmanager.google.com
2. Utwórz konto: **Okazje+**
3. Utwórz kontener: **Okazje+ Website** (typ: Web)
4. Skopiuj **Container ID** (format: `GTM-XXXXXX`)

#### Krok 2: Dodaj GTM_ID do .env.local

```bash
cd /Users/tomaszgorecki/Projekty/okazje-plus

# Dodaj do .env.local
echo "NEXT_PUBLIC_GTM_ID=GTM-XXXXXX" >> .env.local  # Zamień GTM-XXXXXX na swoje ID
```

#### Krok 3: Skonfiguruj GA4 w GTM

W Google Tag Manager:

1. **Tags** → **New**
2. **Tag Configuration** → **Google Analytics: GA4 Configuration**
3. **Measurement ID**: `G-FT6DRFR25D`
4. **Triggering**: **All Pages**
5. **Save** (nazwa: "GA4 - Configuration")

#### Krok 4: (Opcjonalnie) Dodaj Google Tag

Jeśli `GT-T9WXFDLK` to osobny tag:

1. **Tags** → **New**
2. **Tag Configuration** → **Google Analytics: Google Tag**
3. **Tag ID**: `GT-T9WXFDLK`
4. **Triggering**: **All Pages**
5. **Save** (nazwa: "Google Tag - Configuration")

#### Krok 5: Testuj w Preview

1. W GTM: **Preview** (prawy górny róg)
2. Wpisz: `http://localhost:9002`
3. Sprawdź czy tagi odpalam się (zielone checkmarki)

#### Krok 6: Publish

1. **Submit** → **Version Name**: "Initial GA4 + Google Tag Setup"
2. **Publish**

#### Krok 7: Deploy

```bash
npm run build
npm run deploy:hosting  # lub deploy:prod
```

#### Krok 8: Weryfikacja produkcji

1. Otwórz https://okazjeplus.pl
2. Sprawdź DevTools → Network → filtruj "google"
3. Powinny ładować się:
   - `gtm.js?id=GTM-XXXXXX`
   - Requesty do `google-analytics.com/g/collect`
4. Sprawdź GA4 Real-Time

---

## 🧪 Testowanie działania

### Test 1: Czy gtag() jest dostępne?

```javascript
// W konsoli przeglądarki:
typeof window.gtag
// Powinno zwrócić: "function"
```

### Test 2: Czy dataLayer działa?

```javascript
window.dataLayer
// Powinno zwrócić: Array z objektami
```

### Test 3: Wyślij test event

```javascript
gtag('event', 'test_event', {
  test_param: 'test_value'
});
// Sprawdź w GA4 → DebugView czy event się pojawił
```

### Test 4: Czy tracking kodowy działa?

```javascript
// W konsoli na stronie okazje:
import { trackEvent } from '@/lib/analytics';
trackEvent('manual_test', { source: 'console' });
```

---

## 🎯 Które rozwiązanie wybrać?

| Aspekt | Opcja A (Bezpośrednie GA4) | Opcja B (GTM) |
|--------|---------------------------|---------------|
| **Czas setup** | 5 minut | 30 minut |
| **Prostota** | ✅ Bardzo proste | ⚠️ Wymaga nauki GTM |
| **Elastyczność** | ❌ Każda zmiana = redeploy | ✅ Zmiany bez deploymentu |
| **Obsługa wielu tagów** | ❌ Trzeba ręcznie dodawać | ✅ Wszystko w GTM |
| **Debugging** | ⚠️ Tylko console.log | ✅ GTM Preview mode |
| **Zalecane dla** | Szybki start | Długoterminowa produkcja |

**Rekomendacja**: Zacznij od **Opcji A** żeby szybko odblokować GA4, potem zmigruj na **Opcję B** gdy będziesz dodawać Facebook Pixel, LinkedIn, etc.

---

## 📊 Co powinieneś zobaczyć w GA4?

Po poprawnej konfiguracji (po ~5-10 minutach):

### Real-Time Report
- **Users**: Aktywni użytkownicy (ty podczas testowania)
- **Event count**: Events jak `page_view`, `session_start`
- **Page title**: Tytuły odwiedzonych stron
- **Page path**: URL'e typu `/pl/`, `/pl/deals/`, etc.

### Events (Debug View - tylko w trybie debug)
Aby włączyć:
```javascript
gtag('config', 'G-FT6DRFR25D', {
  debug_mode: true
});
```

### Popularne eventy (jeśli używasz funkcji z analytics.ts):
- `vote` (z parametrami: `content_type`, `item_id`, `vote_type`)
- `view_item` (wyświetlenie deala/produktu)
- `search` (wyszukiwanie)
- `click` (outbound links)
- `comment` (dodanie komentarza)

---

## 🐛 Typowe problemy

### Problem: "gtag is not defined"

**Przyczyna**: Script GA4/GTM nie załadował się

**Rozwiązanie**:
1. Sprawdź Network tab czy `gtag/js` lub `gtm.js` się ładuje
2. Sprawdź czy nie blokuje AdBlock
3. Sprawdź czy zmienne env są dostępne: `console.log(process.env.NEXT_PUBLIC_GTM_ID)`

### Problem: Brak danych w GA4 Real-Time

**Możliwe przyczyny**:
1. ⏰ Czekaj 5-10 minut (nie jest instant)
2. 🔒 AdBlock/Privacy Badger blokuje requesty
3. 🌐 Testuj w trybie incognito
4. 📡 Sprawdź Network tab czy są requesty do `google-analytics.com/g/collect`
5. ✅ Sprawdź czy property ID się zgadza: `G-FT6DRFR25D`

### Problem: GTM ładuje się ale GA4 nie działa

**Debugowanie**:
1. W GTM: włącz **Preview mode**
2. Otwórz swoją stronę
3. Sprawdź czy tag GA4 odpala się (zielony checkmark)
4. Jeśli czerwony X - sprawdź konfigurację tagu
5. Sprawdź **Errors** w GTM Preview

### Problem: Eventy custom nie wysyłają się

**Lokalizacja**: `src/lib/analytics.ts`

```typescript
export const trackVote = (type, itemId, voteType) => {
  if (!isGAAvailable()) {  // ← Sprawdź co zwraca
    console.warn('Google Analytics nie jest dostępne');
    return;
  }
  // ...
}
```

**Debugowanie**:
1. W konsoli: `window.gtag` - powinno być `function`
2. Dodaj `console.log()` w funkcji `trackVote` etc.
3. Sprawdź Network tab podczas wykonywania akcji

---

## 📝 Checklist wdrożenia

### Przed deployment:

- [ ] Wybrano opcję (A lub B)
- [ ] Dodano script GA4 **LUB** skonfigurowano GTM
- [ ] Jeśli GTM: dodano `NEXT_PUBLIC_GTM_ID` do `.env.local`
- [ ] Jeśli GTM: skonfigurowano tag GA4 w kontenerze
- [ ] Zbudowano projekt: `npm run build` (bez błędów)
- [ ] Przetestowano lokalnie: `npm run dev`

### Po deployment:

- [ ] Otwarto stronę produkcyjną w przeglądarce
- [ ] Sprawdzono DevTools → Console (brak błędów)
- [ ] Sprawdzono DevTools → Network (ładują się skrypty GA/GTM)
- [ ] Zweryfikowano `typeof window.gtag === 'function'`
- [ ] Poczekano 5-10 minut
- [ ] Sprawdzono GA4 → Real-Time (widoczny ruch)
- [ ] Kliknięto kilka linków i sprawdzono eventy

### Po 24 godzinach:

- [ ] Sprawdzono GA4 → Reports → Acquisition
- [ ] Sprawdzono GA4 → Reports → Engagement
- [ ] Sprawdzono czy custom eventy (`vote`, `view_item`) są widoczne
- [ ] Zweryfikowano źródła ruchu

---

## 🚀 Następne kroki po naprawie GA4

1. **Google Search Console**
   - Dodaj property dla `https://okazjeplus.pl`
   - Zweryfikuj właściciela (użyj GA4 verification method)
   - Prześlij sitemap: `https://okazjeplus.pl/sitemap.xml`

2. **Facebook Pixel** (jeśli używasz)
   - Dodaj do GTM (instrukcje w `GTM_SETUP_GUIDE.md`)
   - Skonfiguruj Custom Conversions

3. **Enhanced Measurement**
   - W GA4 → Admin → Data Streams → Web → Enhanced Measurement
   - Włącz: Scrolls, Outbound clicks, Site search, Video engagement, File downloads

4. **Custom Dimensions**
   - W GA4 → Admin → Custom Definitions
   - Dodaj: `user_role`, `content_type`, `category_slug`

5. **Conversions**
   - Oznacz kluczowe eventy jako conversions:
     - `outbound_click` (kliknięcia w affiliate links)
     - `add_to_cart` (dodanie do koszyka)
     - `share` (udostępnienie)

---

## 📚 Dokumentacja

- **GA4 Measurement Protocol**: https://developers.google.com/analytics/devguides/collection/protocol/ga4
- **GTM Setup**: `/docs/guides/GTM_SETUP_GUIDE.md`
- **Analytics API**: `/docs/api/google-analytics.md`
- **Existing analytics code**: `/src/lib/analytics.ts`

---

**Utworzono**: 20 grudnia 2025  
**Ostatnia aktualizacja**: 20 grudnia 2025  
**Status**: 🔴 Wymaga natychmiastowej naprawy
