# Przewodnik: Migracja z GA4 na Google Tag Manager

## Dlaczego GTM?

Google Tag Manager (GTM) znacznie ułatwia zarządzanie wszystkimi tagami śledzącymi (Analytics, Facebook Pixel, inne) bez modyfikacji kodu. Wszystkie zmiany odbywają się w interfejsie GTM.

## Krok 1: Stwórz kontener GTM

1. Przejdź do https://tagmanager.google.com
2. Utwórz nowe konto + kontener:
   - **Nazwa konta**: Okazje+
   - **Nazwa kontenera**: Okazje+ Website
   - **Typ kontenera**: Web
3. Skopiuj **Container ID** (format: `GTM-XXXXXX`)
4. Dodaj do `.env.local`:
   ```bash
   NEXT_PUBLIC_GTM_ID=GTM-XXXXXX
   ```

## Krok 2: Skonfiguruj Google Analytics 4 w GTM

### Dodaj tag GA4:
1. W GTM: **Tags** → **New**
2. **Tag Configuration** → **Google Analytics: GA4 Configuration**
3. **Measurement ID**: `G-FT6DRFR25D` (aktywny ID)
4. **Triggering**: All Pages
5. **Save** i nazwij: "GA4 - Config"

### Dodaj zmienne (opcjonalnie):
1. **Variables** → **User-Defined Variables** → **New**
2. Utwórz zmienne dla:
   - `userId` (dla zalogowanych użytkowników)
   - `dealId` / `productId` (dla custom events)
   - `searchQuery` (dla wyszukiwania)

## Krok 3: Dodaj Facebook Pixel do GTM

1. **Tags** → **New**
2. **Tag Configuration** → **Custom HTML**
3. Wklej kod:
   ```html
   <script>
   !function(f,b,e,v,n,t,s)
   {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
   n.callMethod.apply(n,arguments):n.queue.push(arguments)};
   if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
   n.queue=[];t=b.createElement(e);t.async=!0;
   t.src=v;s=b.getElementsByTagName(e)[0];
   s.parentNode.insertBefore(t,s)}(window, document,'script',
   'https://connect.facebook.net/en_US/fbevents.js');
   fbq('init', '{{FB_PIXEL_ID}}');
   fbq('track', 'PageView');
   </script>
   ```
4. Utwórz zmienną **Constant**: `FB_PIXEL_ID` = twój Facebook Pixel ID
5. **Triggering**: All Pages
6. **Save** i nazwij: "FB Pixel - Base Code"

## Krok 4: Skonfiguruj Custom Events

### Event: ViewContent (wyświetlenie produktu/okazji)

1. **Tags** → **New** → **Facebook Pixel**
2. **Pixel ID**: `{{FB_PIXEL_ID}}`
3. **Event**: ViewContent
4. **Object Properties**:
   ```javascript
   {
     "content_name": "{{Page Title}}",
     "content_category": "{{Deal/Product Category}}",
     "content_ids": ["{{Deal/Product ID}}"],
     "content_type": "product",
     "value": {{Price}},
     "currency": "PLN"
   }
   ```
5. **Trigger**: Utwórz Custom Event trigger dla `deal_view` / `product_view`

### Event: Search

1. **Tags** → **New** → **Facebook Pixel**
2. **Event**: Search
3. **Object Properties**:
   ```javascript
   {
     "search_string": "{{Search Query}}"
   }
   ```
4. **Trigger**: Custom Event `search_performed`

### Event: AddToCart

1. **Tags** → **New** → **Facebook Pixel**
2. **Event**: AddToCart
3. **Object Properties**:
   ```javascript
   {
     "content_name": "{{Product Name}}",
     "content_ids": ["{{Product ID}}"],
     "content_type": "product",
     "value": {{Price}},
     "currency": "PLN"
   }
   ```
4. **Trigger**: Custom Event `add_to_cart` / `add_to_wishlist`

### Event: Purchase (affiliate click)

1. **Tags** → **New** → **Facebook Pixel**
2. **Event**: Purchase
3. **Object Properties**:
   ```javascript
   {
     "content_name": "{{Product Name}}",
     "content_ids": ["{{Product ID}}"],
     "value": {{Commission Value}},
     "currency": "PLN"
   }
   ```
4. **Trigger**: Outbound link clicks do affiliate URLs

## Krok 5: Testowanie

1. W GTM: **Preview** (prawy górny róg)
2. Podaj URL: `http://localhost:9002` lub `https://okazjeplus.pl`
3. Sprawdź w **Tag Assistant**:
   - Czy GA4 odpala się na każdej stronie
   - Czy Facebook Pixel PageView działa
   - Czy custom events są wysyłane

4. Sprawdź w **Facebook Events Manager**:
   - Test Events → wprowadź swoje IP
   - Wykonaj akcje na stronie
   - Sprawdź czy eventy są odbierane

## Krok 6: Publikacja

1. W GTM: **Submit** (prawy górny róg)
2. Wpisz **Version Name**: "Initial setup - GA4 + FB Pixel"
3. **Description**: "Migrated from hardcoded scripts to GTM"
4. **Publish**

## Krok 7: Deploy do produkcji

```bash
# Dodaj GTM_ID do .env.local
echo "NEXT_PUBLIC_GTM_ID=GTM-XXXXXX" >> .env.local

# Rebuild i deploy
npm run build
npm run deploy:prod
```

## Krok 8: Weryfikacja w produkcji

1. Otwórz https://okazjeplus.pl
2. Użyj **Google Tag Assistant** extension
3. Sprawdź czy GTM container się ładuje
4. Zweryfikuj w **Real-Time** w GA4 czy dane wpływają
5. Zweryfikuj w **Facebook Events Manager** czy events są odbierane

## Triggery do stworzenia

| Nazwa Triggera | Typ | Warunek |
|----------------|-----|---------|
| All Pages | Page View | All pages |
| Deal View | Custom Event | Event = `deal_view` |
| Product View | Custom Event | Event = `product_view` |
| Search | Custom Event | Event = `search_performed` |
| Add to Cart | Custom Event | Event = `add_to_cart` |
| Outbound Links | Click - All Elements | Click URL contains affiliate domains |
| Vote Up/Down | Custom Event | Event = `vote_cast` |
| Comment Posted | Custom Event | Event = `comment_posted` |

## Custom Events do dodania w kodzie

W pliku `src/lib/analytics.ts` już masz funkcje GTM-ready:

```typescript
// Istniejące funkcje już wysyłają do dataLayer!
trackDealView(dealId, dealTitle)
trackProductView(productId, productName)
trackSearch(query, resultsCount)
trackVote(itemId, itemType, voteType)
```

Sprawdź czy wszystkie wywołania są na miejscu.

## Zalety GTM vs Hardcoded

✅ Zarządzanie tagami bez deploymentu kodu
✅ Łatwe A/B testing różnych pixeli
✅ Debug mode i preview
✅ Version control dla tagów
✅ Łatwe dodawanie nowych narzędzi (LinkedIn Insight, Twitter Pixel, etc.)
✅ Built-in zmienne (Page URL, Referrer, etc.)

## Troubleshooting

### GTM nie ładuje się
- Sprawdź czy `NEXT_PUBLIC_GTM_ID` jest w `.env.local`
- Rebuild aplikacji: `npm run build`
- Sprawdź w DevTools czy GTM script jest w `<head>`

### GA4 nie odbiera danych
- W GTM Preview sprawdź czy tag odpala się (powinien być zielony)
- Sprawdź measurement ID: `G-FT6DRFR25D`
- Poczekaj 24-48h na pełne dane w GA4

### Facebook Pixel nie działa
- Sprawdź czy FB Pixel ID jest poprawny
- Sprawdź w Facebook Events Manager → Test Events
- Użyj Facebook Pixel Helper extension

### Custom Events nie wysyłają się
- Sprawdź czy `window.dataLayer.push()` jest wywołany
- Sprawdź Console w GTM Preview
- Upewnij się że trigger pasuje do nazwy eventu

## Migracja z istniejącego GA4

Stary kod GA4 w `layout.tsx` był:
```javascript
gtag('config', 'G-FT6DRFR25D');
```

Nowy GTM automatycznie zarządza tym po skonfigurowaniu tagu GA4 w kontenerze. Stary kod można usunąć po wdrożeniu GTM.

## Następne kroki

1. ✅ Skonfiguruj GTM (ten przewodnik)
2. ⬜ Dodaj Google Search Console verification
3. ⬜ Dodaj Bing Webmaster Tools verification
4. ⬜ Prześlij sitemap.xml do obu narzędzi
5. ⬜ Skonfiguruj Facebook Custom Conversions
6. ⬜ Utwórz Facebook Custom Audiences dla retargetingu
7. ⬜ Dodaj LinkedIn Insight Tag (opcjonalnie)
8. ⬜ Dodaj Twitter Pixel (opcjonalnie)

---

**Czas implementacji**: ~2-3 godziny
**Poziom trudności**: Średni
**Korzyści**: Ogromne - pełna kontrola nad tracking bez zmian w kodzie
