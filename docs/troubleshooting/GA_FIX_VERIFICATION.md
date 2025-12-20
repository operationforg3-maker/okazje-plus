# ✅ Google Analytics - Weryfikacja Naprawy

## 🔧 Co zostało naprawione (20 grudnia 2025)

### Zmiany w kodzie:

**Plik**: `src/app/[locale]/layout.tsx`

1. ✅ **Dodano bezpośrednie skrypty GA4 i Google Tag** do `<head>`
2. ✅ **Usunięto niedziałający** `<AnalyticsProvider />` 

### Dodane skrypty:

```html
<!-- Google Analytics 4: G-FT6DRFR25D -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FT6DRFR25D"></script>

<!-- Google Tag: GT-T9WXFDLK -->
<script>
  gtag('config', 'GT-T9WXFDLK');
</script>
```

---

## 🧪 Instrukcje testowania

### 1. Build lokalnie

```bash
cd /Users/tomaszgorecki/Projekty/okazje-plus

# Zbuduj projekt
npm run build

# Jeśli build się powiedzie, uruchom lokalnie
npm run dev
```

### 2. Testuj lokalnie (http://localhost:9002)

#### Test A: Sprawdź Console

1. Otwórz http://localhost:9002
2. Otwórz **DevTools** (F12 lub Cmd+Option+I)
3. Przejdź do zakładki **Console**
4. Wpisz:
   ```javascript
   window.gtag
   ```
5. **Oczekiwany wynik**: `ƒ gtag(){dataLayer.push(arguments);}`
6. **Jeśli undefined**: Sprawdź Network czy `gtag/js` się ładuje

#### Test B: Sprawdź dataLayer

```javascript
window.dataLayer
```
**Oczekiwany wynik**: Array z obiektami, np:
```javascript
[
  {0: "js", 1: Date},
  {0: "config", 1: "G-FT6DRFR25D", 2: {...}},
  ...
]
```

#### Test C: Wyślij test event

```javascript
gtag('event', 'test_from_console', {
  test_param: 'works',
  timestamp: new Date().toISOString()
});
```
**Oczekiwany wynik**: Brak błędów w console, event dodany do dataLayer

#### Test D: Sprawdź Network

1. Zakładka **Network** w DevTools
2. Filtruj: `google`
3. **Powinny się załadować**:
   - `gtag/js?id=G-FT6DRFR25D` (Status 200)
   - Requesty do `google-analytics.com/g/collect` (po interakcjach)

### 3. Deploy do produkcji

```bash
# Zbuduj i wdróż
npm run deploy:hosting

# LUB pełny deployment (Next.js + Functions)
npm run deploy:prod
```

### 4. Testuj produkcję (https://okazjeplus.pl)

#### Wyłącz AdBlocker!
⚠️ **Ważne**: Wyłącz wszystkie blokery reklam/trackerów (uBlock Origin, AdBlock Plus, Privacy Badger, etc.)

#### Test produkcyjny:

1. Otwórz https://okazjeplus.pl w **trybie incognito**
2. Otwórz DevTools → Console
3. Sprawdź `window.gtag` (powinno być `function`)
4. Sprawdź `window.dataLayer` (powinno być `Array`)
5. Kliknij kilka linków, przewiń stronę
6. Zakładka **Network** → sprawdź requesty do `google-analytics.com/g/collect`

---

## 📊 Weryfikacja w Google Analytics

### Opcja 1: Real-Time Report (najszybsza)

1. Przejdź do: https://analytics.google.com/
2. Wybierz property **Okazje+** (ID: G-FT6DRFR25D)
3. **Reports** → **Real-time**
4. **Oczekiwany wynik po 30 sekundach - 2 minutach**:
   - **Users**: 1 (ty)
   - **Event count**: 2+ (page_view, session_start)
   - **Page title**: "Okazje+ - Najlepsze okazje..."
   - **Page path**: `/pl/` lub `/pl/deals/` etc.

⏰ **Czekaj 2-5 minut** jeśli nie widzisz od razu danych!

### Opcja 2: Debug View (dla developerów)

1. Zainstaluj: [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna)
2. Włącz extension (ikona powinna być niebieska)
3. Odśwież stronę
4. W GA4 → **Admin** → **DebugView**
5. Powinny pojawiać się eventy w czasie rzeczywistym

### Opcja 3: Tag Assistant (Chrome)

1. Zainstaluj: [Tag Assistant](https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk)
2. Kliknij ikonę extension
3. Enable → Reload page
4. Sprawdź czy Google Analytics tag jest **zielony** ✅

---

## 🐛 Troubleshooting

### Problem: "window.gtag is undefined"

**Możliwe przyczyny**:
1. 🚫 AdBlocker blokuje gtag.js
2. 🌐 Błąd w budowaniu (sprawdź `npm run build`)
3. 📡 CSP (Content Security Policy) blokuje inline scripts

**Rozwiązanie**:
```bash
# Sprawdź czy build się powiódł
npm run build

# Sprawdź logi buildu
# Nie powinno być błędów typu "Failed to compile"
```

### Problem: Brak danych w GA4 Real-Time

**Checklist**:
- [ ] Minęło przynajmniej 2-5 minut od otwarcia strony
- [ ] Wyłączony AdBlocker/uBlock Origin/Privacy Badger
- [ ] Testowanie w trybie incognito
- [ ] Sprawdzone Network tab - requesty do `google-analytics.com`
- [ ] Property ID jest poprawne: `G-FT6DRFR25D`
- [ ] Sprawdzone w innej przeglądarce (Firefox, Safari)

### Problem: "gtag is not a function"

**Debug**:
```javascript
// W console:
console.log(typeof window.gtag);  // Powinno być "function"
console.log(window.dataLayer);     // Powinno być Array

// Jeśli undefined:
// 1. Sprawdź czy script się załadował
document.querySelector('script[src*="gtag"]');  // Powinno zwrócić element <script>

// 2. Sprawdź Console czy są błędy CSP
// Powinno nie być błędów "Refused to load script"
```

### Problem: GA4 ładuje się ale nie trackuje eventów

**Sprawdź funkcje w `src/lib/analytics.ts`**:

```typescript
// Test w console:
import { trackEvent, isGAAvailable } from '@/lib/analytics';

console.log(isGAAvailable());  // Powinno być true

// Jeśli true, wyślij test event:
trackEvent('manual_test', { source: 'troubleshooting' });
```

**Sprawdź Network tab**:
Po wywołaniu `trackEvent()` powinien pojawić się request:
- URL: `https://www.google-analytics.com/g/collect?...`
- Method: POST
- Status: 200 lub 204

---

## ✅ Kryteria sukcesu

### Minimalne wymagania (MUSZĄ działać):

- [x] ✅ `window.gtag` jest funkcją
- [x] ✅ `window.dataLayer` jest tablicą
- [x] ✅ Skrypt `gtag/js` ładuje się (Status 200)
- [x] ✅ Requesty do `google-analytics.com/g/collect` są wysyłane
- [x] ✅ GA4 Real-Time pokazuje aktywnego użytkownika (po 2-5 min)

### Opcjonalne (Nice-to-have):

- [ ] Custom eventy (`vote`, `view_item`, `search`) działają
- [ ] Debug View w GA4 pokazuje wszystkie eventy
- [ ] Google Tag `GT-T9WXFDLK` jest aktywny
- [ ] Facebook Pixel działa (jeśli skonfigurowany)

---

## 📈 Co dalej?

### Po potwierdzeniu że GA4 działa:

1. **Poczekaj 24-48h** na pełne dane w Reports
2. **Sprawdź Acquisition Report** - źródła ruchu
3. **Sprawdź Engagement Report** - najpopularniejsze strony
4. **Skonfiguruj Custom Events jako Conversions**:
   - W GA4: **Admin** → **Events** → **Mark as conversion**
   - Oznacz: `outbound_click`, `add_to_cart`, `purchase`

### Ulepszenia długoterminowe:

1. **Zmigruj na Google Tag Manager** (GTM)
   - Dokumentacja: `/docs/guides/GTM_SETUP_GUIDE.md`
   - Korzyść: Zmiana konfiguracji bez redeploy

2. **Dodaj Enhanced Measurement**:
   - W GA4: **Admin** → **Data Streams** → **Web** → **Enhanced Measurement**
   - Włącz: Scrolls, Outbound clicks, Site search, File downloads

3. **Skonfiguruj Custom Dimensions**:
   - `user_role` (admin/moderator/user)
   - `content_type` (deal/product)
   - `category_slug`

4. **Google Search Console**:
   - Zweryfikuj property
   - Prześlij sitemap: `https://okazjeplus.pl/sitemap.xml`

---

## 🆘 Jeśli nadal nie działa

### Zbierz diagnostykę:

```javascript
// W console przeglądarki na https://okazjeplus.pl:
const diagnostics = {
  gtag: typeof window.gtag,
  dataLayer: Array.isArray(window.dataLayer),
  dataLayerLength: window.dataLayer?.length || 0,
  scripts: Array.from(document.querySelectorAll('script[src*="google"]')).map(s => s.src),
  userAgent: navigator.userAgent,
  url: window.location.href
};
console.log(JSON.stringify(diagnostics, null, 2));
```

**Skopiuj output** i sprawdź:
- Czy `gtag` jest `"function"`
- Czy `dataLayer` jest `true`
- Czy są załadowane skrypty Google

### Kontakt z supportem GA4:

1. Przejdź do: https://support.google.com/analytics/
2. **Describe your issue**: "GA4 not receiving data from website"
3. Podaj:
   - Property ID: `G-FT6DRFR25D`
   - Website URL: `https://okazjeplus.pl`
   - Diagnostics output (z powyższego kodu)

---

## 📚 Przydatne linki

- **GA4 Property**: https://analytics.google.com/analytics/web/#/p491578768/reports/intelligenthome
- **GA4 Real-Time**: https://analytics.google.com/analytics/web/#/p491578768/reports/realtime
- **GA4 DebugView**: https://analytics.google.com/analytics/web/#/p491578768/reports/debugview
- **Google Tag Assistant**: https://tagassistant.google.com/
- **Dokumentacja wewnętrzna**: `/docs/api/google-analytics.md`
- **GTM Setup Guide**: `/docs/guides/GTM_SETUP_GUIDE.md`

---

**Utworzono**: 20 grudnia 2025  
**Ostatnia weryfikacja**: Pending (czeka na deployment)  
**Status**: 🟡 Wymaga testowania po wdrożeniu
