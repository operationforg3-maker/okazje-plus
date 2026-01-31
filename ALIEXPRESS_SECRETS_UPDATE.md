# AliExpress Secrets - Aktualizacja konfiguracji
**Data**: 30 stycznia 2026  
**Status**: ✅ ZAKOŃCZONE - Wszystkie secrety zaktualizowane

## ✅ Zaktualizowane Google Cloud Secrets

| Secret Name | Wartość | Status | Wersja |
|------------|---------|--------|--------|
| `ALIEXPRESS_APP_KEY` | `526032` | ✅ Bez zmian | - |
| `ALIEXPRESS_APP_SECRET` | `r4h4or9ZlZYPCjsllrqLXufzwx0iToUV` | ✅ Bez zmian | - |
| `ALIEXPRESS_API_BASE` | `https://openapi.aliexpress.com/gateway.do` | ✅ Zaktualizowano | v10 |
| `ALIEXPRESS_API_ENDPOINT` | `https://openapi.aliexpress.com/gateway.do` | ✅ Utworzono | v1 |
| `ALIEXPRESS_AFFILIATE_ID` | `Okazje Plus` | ✅ Zaktualizowano | v9 |
| `ALIEXPRESS_TRACKING_ID` | `Okazje Plus` | ✅ Utworzono | v1 |
| `ALIEXPRESS_REGION` | `eu` | ✅ Utworzono | v1 |

**Sprawdź aktualny stan:**
```bash
gcloud secrets list --filter="name:ALIEXPRESS" --format="table(name)"
```

## ✅ Zaktualizowane pliki projektu

### 1. `.env.local` - Lokalne zmienne środowiskowe
```env
ALIEXPRESS_APP_KEY=526032
ALIEXPRESS_APP_SECRET=r4h4or9ZlZYPCjsllrqLXufzwx0iToUV
ALIEXPRESS_API_ENDPOINT=https://openapi.aliexpress.com/gateway.do
ALIEXPRESS_AFFILIATE_ID=Okazje Plus
ALIEXPRESS_TRACKING_ID=Okazje Plus
ALIEXPRESS_REGION=eu
```

### 2. `apphosting.yaml` - Cloud Run Runtime config
Dodano nowe secrety:
- `ALIEXPRESS_API_ENDPOINT`
- `ALIEXPRESS_TRACKING_ID`
- `ALIEXPRESS_REGION`

Wszystkie secrety są dostępne podczas RUNTIME dla Next.js App Hosting.

### 3. `src/integrations/aliexpress/types.ts`
Zaktualizowano interfejs `AliExpressClientConfig`:
```typescript
export interface AliExpressClientConfig {
  appKey: string;
  appSecret: string;
  apiEndpoint?: string;
  apiVersion?: string;
  timeout?: number;
  rateLimitPerMinute?: number;
  affiliateId?: string;      // NOWE
  trackingId?: string;        // NOWE
  region?: string;            // NOWE
}
```

### 4. `src/integrations/aliexpress/client.ts`

**Funkcja `createAliExpressClient()`:**
```typescript
const config: AliExpressClientConfig = {
  appKey: appKey || '',
  appSecret: appSecret || '',
  apiEndpoint: process.env.ALIEXPRESS_API_ENDPOINT,
  affiliateId: process.env.ALIEXPRESS_AFFILIATE_ID || process.env.ALIEXPRESS_TRACKING_ID,
  trackingId: process.env.ALIEXPRESS_TRACKING_ID || process.env.ALIEXPRESS_AFFILIATE_ID,
  region: process.env.ALIEXPRESS_REGION,
  rateLimitPerMinute: process.env.ALIEXPRESS_RATE_LIMIT 
    ? parseInt(process.env.ALIEXPRESS_RATE_LIMIT, 10) 
    : undefined
};
```

**Metoda `searchProducts()`:**
Dodano tracking_id do parametrów API:
```typescript
if (this.config.trackingId || this.config.affiliateId) {
  topApiParams.tracking_id = this.config.trackingId || this.config.affiliateId;
}
```

**Metoda `getProductDetails()`:**
Dodano tracking_id do parametrów API:
```typescript
if (this.config.trackingId || this.config.affiliateId) {
  baseParams.tracking_id = this.config.trackingId || this.config.affiliateId;
}
```

## 🔍 Weryfikacja zmian

### Test lokalny
```bash
npx tsx test-aliexpress.ts
```

**Obecny wynik:**
- ✅ Konfiguracja jest poprawna
- ✅ `tracking_id: "Okazje Plus"` jest przekazywany w requestach
- ✅ Endpoint jest poprawny: `https://openapi.aliexpress.com/gateway.do`
- ❌ API zwraca 404 HTML - **klucze API są nieaktywne**

### Sprawdzenie secretów w Google Cloud
```bash
# Lista wszystkich secretów
gcloud secrets list --filter="name:ALIEXPRESS"

# Wartość konkretnego secretu
gcloud secrets versions access latest --secret=ALIEXPRESS_AFFILIATE_ID
```

### Sprawdzenie w App Hosting (po deploy)
Po wdrożeniu aplikacji, secrety będą dostępne jako zmienne środowiskowe w Cloud Run runtime.

## 📝 Dodatkowe informacje

### Cel tracking_id/affiliate_id
- **Cel**: Śledzenie prowizji z programu partnerskiego AliExpress
- **Wartość**: "Okazje Plus" (nazwa aplikacji)
- **Użycie**: Dodawany do wszystkich zapytań API AliExpress
- **Format**: String, może zawierać spacje

### Różnica między ALIEXPRESS_API_BASE i ALIEXPRESS_API_ENDPOINT
- **ALIEXPRESS_API_BASE**: Starsze pole (legacy)
- **ALIEXPRESS_API_ENDPOINT**: Nowe pole (zgodne z kodem)
- **Oba**: Ustawione na `https://openapi.aliexpress.com/gateway.do` dla spójności

### Region
- **ALIEXPRESS_REGION**: `eu`
- **Cel**: Wskazuje region API (Europe)
- **Opcje**: `eu`, `us`, `sg`

## ⚠️ Znane problemy

### Problem: API zwraca 404 HTML
**Status**: Nierozwiązany  
**Przyczyna**: Klucze API (APP_KEY/APP_SECRET) są prawdopodobnie:
- Nieaktywne
- Nieważne
- Nie mają dostępu do Affiliate API

**Rozwiązanie**:
1. Zaloguj się do AliExpress Developer Console: https://open.aliexpress.com/
2. Sprawdź status aplikacji
3. Zweryfikuj uprawnienia (Affiliate API)
4. Wygeneruj nowe klucze jeśli potrzeba
5. Zaktualizuj secrety:
   ```bash
   echo -n "NOWY_APP_KEY" | gcloud secrets versions add ALIEXPRESS_APP_KEY --data-file=-
   echo -n "NOWY_APP_SECRET" | gcloud secrets versions add ALIEXPRESS_APP_SECRET --data-file=-
   ```

## 🚀 Następne kroki

1. **Sprawdź klucze API w AliExpress Developer Console**
   - Status aplikacji (Active/Inactive)
   - Uprawnienia Affiliate API
   - Limit requestów

2. **Po otrzymaniu aktywnych kluczy:**
   - Zaktualizuj `.env.local` lokalnie
   - Zaktualizuj Google Cloud Secrets
   - Przetestuj ponownie: `npx tsx test-aliexpress.ts`

3. **Deploy zaktualizowanej konfiguracji:**
   ```bash
   # Deploy Next.js + nowe secrety
   npm run deploy:hosting
   
   # Alternatywnie: full deploy
   npm run deploy:prod
   ```

4. **Weryfikacja po deploy:**
   - Sprawdź logi Cloud Run
   - Testuj import produktów w Admin UI
   - Sprawdź czy tracking_id jest poprawnie przekazywany

## 📚 Dokumentacja

- **AliExpress Developer Console**: https://open.aliexpress.com/
- **TOP API Documentation**: https://developers.aliexpress.com/en/doc.htm?docId=45801
- **Affiliate API Guide**: https://portals.aliexpress.com/help_center/index.htm
- **Raport testów API**: [ALIEXPRESS_API_TEST_REPORT.md](./ALIEXPRESS_API_TEST_REPORT.md)

---
**Autor**: GitHub Copilot  
**Status aktualizacji**: ZAKOŃCZONA  
**Data**: 30 stycznia 2026
