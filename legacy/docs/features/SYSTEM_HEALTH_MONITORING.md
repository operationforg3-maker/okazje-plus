# System Health Monitoring - 11 grudnia 2025

## Cel
Implementacja systemu monitoringu stanu aplikacji na produkcji, który pozwala na:
1. Sprawdzenie stanu wszystkich kluczowych systemów
2. Diagnozowanie problemów z głosowaniem
3. Monitoring wydajności w czasie rzeczywistym
4. Automatyczne testy na live

## Zaimplementowane Endpointy

### 1. `/api/health` - Ogólny Stan Systemu
**Metoda:** GET  
**Parametry:**
- `?detailed=true` - pełne informacje z Firebase Admin

**Sprawdza:**
- ✅ Firestore connectivity (próba pobrania deals)
- ✅ Categories (liczba kategorii w bazie)
- ✅ Environment variables (Firebase, Gemini, Site URL)
- ✅ Firebase Admin SDK (tylko detailed mode)
- ✅ Response time (performance)

**Przykład użycia:**
```bash
# Podstawowy check
curl https://okazjeplus.pl/api/health

# Szczegółowy check
curl https://okazjeplus.pl/api/health?detailed=true
```

**Przykładowa odpowiedź:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-11T09:00:00.000Z",
  "checks": {
    "firestore": {
      "status": "ok",
      "message": "Connected, found 1 deal(s)"
    },
    "categories": {
      "status": "ok",
      "count": 15
    },
    "environment": {
      "status": "ok",
      "variables": {
        "firebaseConfig": true,
        "geminiKey": true,
        "siteUrl": true
      }
    },
    "firebaseAdmin": {
      "status": "ok",
      "message": "Firebase Admin SDK operational"
    }
  },
  "performance": {
    "responseTime": "234ms",
    "status": "ok"
  }
}
```

**Status codes:**
- `200` - wszystko OK
- `207` - degraded (niektóre systemy mają problemy)
- `500` - error (krytyczne błędy)

### 2. `/api/health/vote` - Status Systemu Głosowania
**Metoda:** GET

**Sprawdza:**
- ✅ Przykładowa okazja z głosami (voteCount, temperature)
- ✅ Subcollection `/votes/` (liczba dokumentów)
- ✅ Spójność danych (voteCount vs liczba docs)
- ✅ Firebase Admin SDK (wymagany do weryfikacji tokenów)
- ✅ Endpoint accessibility info

**Przykład użycia:**
```bash
curl https://okazjeplus.pl/api/health/vote
```

**Przykładowa odpowiedź:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-11T09:00:00.000Z",
  "checks": {
    "sampleDeal": {
      "status": "ok",
      "dealId": "abc123",
      "voteCount": 5,
      "temperature": 5
    },
    "votesSubcollection": {
      "status": "ok",
      "count": 5,
      "message": "Found 5 vote document(s)"
    },
    "consistency": {
      "status": "ok",
      "message": "Vote count matches subcollection size"
    },
    "firebaseAdmin": {
      "status": "ok",
      "message": "Firebase Admin SDK loaded (required for token verification)"
    },
    "voteEndpoint": {
      "status": "info",
      "url": "https://okazjeplus.pl/api/deals/[id]/vote",
      "method": "POST",
      "requiredHeaders": ["Authorization: Bearer <token>", "Content-Type: application/json"],
      "requiredBody": { "action": "up | down | remove" }
    }
  },
  "performance": {
    "responseTime": "156ms"
  }
}
```

## Admin Dashboard - System Health

**URL:** `/admin/system-health`  
**Wymaga:** Admin role

**Funkcje:**
- 📊 Real-time monitoring wszystkich systemów
- 🔄 Auto-refresh co 30 sekund
- 🎯 Wizualizacja statusów (OK/Warning/Error)
- 📈 Performance metrics
- ⚡ Szybkie linki do raw endpoints
- 🔍 Szczegółowe informacje o każdym checku

**Jak używać:**
1. Zaloguj się jako admin
2. Przejdź do `/admin/system-health`
3. Dashboard automatycznie sprawdzi wszystkie systemy
4. Kliknij "Odśwież" aby uruchomić ponownie
5. Zobacz szczegóły każdego checku

## Naprawy Wprowadzone

### 1. Voting System Error Logging
**Plik:** `src/app/api/deals/[id]/vote/route.ts`

Dodano szczegółowe logowanie błędów:
- Console logs z stack trace
- Detailed error info (dealId, message, code)
- Development mode: zwraca error details w response

### 2. React Hydration Fix
**Plik:** `src/components/deal-comparison-tool.tsx`

Naprawiono błąd hydration (#418):
- Dodano `typeof window !== 'undefined'` przed localStorage
- Zależność od `isMounted` w useEffect
- Proper client-only rendering

### 3. Better Error Handling
Wszystkie endpointy zwracają:
- Structured JSON responses
- Proper HTTP status codes
- Detailed error messages (gdy możliwe)

## Monitoring w Produkcji

### Szybki Test Wszystkich Systemów
```bash
# 1. Ogólny health check
curl https://okazjeplus.pl/api/health | jq

# 2. System głosowania
curl https://okazjeplus.pl/api/health/vote | jq

# 3. Wszystko razem (detailed)
curl https://okazjeplus.pl/api/health?detailed=true | jq
```

### Continuous Monitoring Setup
Możesz skonfigurować external monitoring (np. UptimeRobot, Pingdom):
- URL: `https://okazjeplus.pl/api/health`
- Interval: 5 minutes
- Expected: status 200
- Alert when: status !== 200

### Slack/Discord Webhook Integration (opcjonalne)
Dodaj webhook notification gdy status != 'ok':
```typescript
if (results.status !== 'ok') {
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `⚠️ Health check failed: ${results.status}`,
      details: results
    })
  });
}
```

## Troubleshooting Guide

### Problem: Vote endpoint zwraca 500
**Sprawdź:**
1. `/api/health/vote` - status firebaseAdmin
2. Logi serwera (Cloud Functions logs)
3. Console errors w przeglądarce
4. Token validity (może wygasł)

**Rozwiązanie:**
```bash
# Sprawdź Firebase Admin
curl https://okazjeplus.pl/api/health?detailed=true | jq '.checks.firebaseAdmin'

# Jeśli error - sprawdź GOOGLE_APPLICATION_CREDENTIALS
# lub service account configuration
```

### Problem: React Hydration Error
**Objaw:** `Minified React error #418`

**Sprawdź:**
- Czy komponenty używają localStorage bez `typeof window`
- Czy są różnice między SSR a CSR (daty, random values)
- Browser console dla full error message

**Rozwiązanie:**
- Dodaj `suppressHydrationWarning` dla elementów z dynamiczną zawartością
- Użyj `isMounted` pattern dla client-only features

### Problem: Degraded Status
**Znaczenie:** Niektóre systemy działają, inne mają problemy

**Akcja:**
1. Zobacz które checky mają status 'error' lub 'warning'
2. Sprawdź logi dla tych systemów
3. Napraw priorytetowo (firestore > firebaseAdmin > environment)

## Kluczowe Metryki

**Response Time:**
- ✅ OK: < 1000ms
- ⚠️ Warning: 1000-3000ms
- 🔴 Slow: > 3000ms

**System Status:**
- `ok` - wszystko działa
- `warning` - drobne problemy, system działa
- `degraded` - niektóre funkcje nie działają
- `error` - krytyczne błędy

## Pliki Zmienione/Dodane
- ✅ `src/app/api/health/route.ts` - główny health check
- ✅ `src/app/api/health/vote/route.ts` - voting system check
- ✅ `src/app/[locale]/admin/system-health/page.tsx` - admin dashboard
- ✅ `src/app/api/deals/[id]/vote/route.ts` - lepsze logowanie
- ✅ `src/components/deal-comparison-tool.tsx` - hydration fix

## Następne Kroki (Opcjonalne)

1. **Redis dla Rate Limiting** - zamiast in-memory Map
2. **Metrics Export** - Prometheus/Grafana integration
3. **Alert System** - email/SMS przy critical errors
4. **Performance Monitoring** - Firebase Performance
5. **Error Tracking** - Sentry integration

## Bezpieczeństwo
- ⚠️ Health endpoints są **public** (no auth required)
- ✅ Nie zwracają sensitive data (klucze, hasła)
- ✅ Admin dashboard wymaga auth + admin role
- ℹ️ W production można dodać basic auth dla /api/health

---

**Status:** ✅ Fully Implemented  
**Data:** 11 grudnia 2025  
**Testowane:** Local + Production ready
