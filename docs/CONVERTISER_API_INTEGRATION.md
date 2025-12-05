# Convertiser API Integration Guide

**Źródło:** https://docs.convertiser.com/  
**Data dokumentacji:** 2025-12-05  
**Typ API:** RESTful (JSON over HTTPS)

## 📋 Spis treści
1. [Wprowadzenie](#wprowadzenie)
2. [Autentykacja](#autentykacja)
3. [Konwencje API](#konwencje-api)
4. [Dostępne Interfejsy API](#dostępne-interfejsy-api)
5. [Przypadki użycia dla Okazje Plus](#przypadki-użycia-dla-okazje-plus)
6. [Limity i ograniczenia](#limity-i-ograniczenia)

---

## Wprowadzenie

**Convertiser** to platforma afiliacyjna oferująca skoordynowany dostęp do wielu ofert marketingowych za pośrednictwem REST API.

### Podstawowe cechy
- ✅ REST API z JSON
- ✅ HTTPS obowiązkowy (HTTP nie wspierany)
- ✅ Token-based authentication
- ✅ Obsługa paginacji, filtrowania, sortowania
- ✅ ISO 8601 format dla timestampów
- ✅ Rate limiting z 429 status

### Base URL
```
https://api.convertiser.com/
```

---

## Autentykacja

### Token-based Authentication

Wszystkie requesty wymagają nagłówka `Authorization`:

```bash
curl -H "Authorization: Token your-personal-secret-token-here" \
     https://api.convertiser.com/publisher/websites/
```

### Generowanie Token API

1. Zaloguj się na konto Convertiser
2. Przejdź do sekcji ustawień API
3. Wygeneruj nowy personal API token
4. Przechowuj token w bezpiecznym miejscu (SECRET_KEY)

### Błędy autentykacji

| Status | Znaczenie |
|--------|-----------|
| 401 | Brak ważnego API key |
| 403 | Brak uprawnień do zasobu |

---

## Konwencje API

### HTTP Metody

| Metoda | Zastosowanie |
|--------|-------------|
| **GET** | Pobieranie zasobów |
| **POST** | Tworzenie zasobów / wyszukiwanie |
| **PUT** | Pełna zamiana zasobu |
| **PATCH** | Częściowa aktualizacja |
| **DELETE** | Usuwanie zasobu |
| **HEAD** | Pobieranie tylko nagłówków |
| **OPTIONS** | Opis zasobu |

### Formaty danych

```json
{
  "id": "resource-uuid",
  "status": "approved",
  "created_at": "2025-12-05T10:30:00Z",
  "field": null
}
```

**Reguły:**
- Alle dane w **JSON**
- Puste pola zwracane jako `null` (nie omijane)
- Timestampy w formacie **ISO 8601**: `YYYY-MM-DDTHH:MM:SSZ`
- URLs muszą się kończyć `/` (inaczej redirect 301)

### HTTP Odpowiedzi

| Status | Znaczenie |
|--------|-----------|
| 200 | OK - Sukces |
| 201 | Created - Nowy zasób stworzony |
| 204 | No Content - Operacja OK, bez zwracanej zawartości |
| 301 | Moved Permanently - Zasób przeniesiony |
| 400 | Bad Request - Błąd w parametrach |
| 401 | Unauthorized - Brak/niewłaściwy token |
| 404 | Not Found - Zasób nie istnieje |
| 409 | Conflict - Konflikt wersji/idempotencji |
| 429 | Too Many Requests - Rate limit exceed. (Exponential backoff) |
| 5xx | Server Error - Błąd serwera Convertiser |

### Paginacja

Listy zasobów obsługują paginację:

```bash
GET /publisher/websites/?page=2&page_size=50
```

**Parametry:**
- `page` - Numer strony (default: 1)
- `page_size` - Ilość elementów na stronę (default: 20)

### Filtrowanie i Sortowanie

```bash
# Filtrowanie
GET /publisher/websites/?status=approved&country=PL

# Sortowanie (- dla descending)
GET /publisher/websites/?ordering=-created_at
```

### Reprezentacje zasobów

**Summary** (listy):
```bash
GET /publisher/websites/
```
Zwraca podstawowe atrybuty (optymizacja wydajności)

**Detailed** (pojedyncze zasoby):
```bash
GET /publisher/websites/{uuid}/
```
Zwraca wszystkie dostępne atrybuty zasobu

---

## Dostępne Interfejsy API

### 1. 📱 Offer API
**Cel:** Zarządzanie dostępnymi ofertami marketingowymi i celami konwersji

#### Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/publisher/offers/find/` | Finder ofert (z filtrami) |
| GET | `/publisher/offers/` | Lista wszystkich ofert |
| GET | `/publisher/offers/{uuid}/` | Szczegóły oferty |
| PUT | `/publisher/offers/{uuid}/tracking_link/` | Generuj link trackingowy |
| GET | `/publisher/offers/detect/` | Autodetect oferty |
| GET | `/publisher/goals/find/` | Finder celów konwersji |

#### Przypadki użycia
- Pobieranie dostępnych ofert dla uživatela
- Generowanie trackingowych linków afiliacyjnych
- Filtrowanie ofert po kategorii, kraju, statusie

---

### 2. 📦 Products API
**Cel:** Zarządzanie produktami i szablonami eksportu katalogów

#### Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| POST | `/publisher/products/` | Wyszukaj produkty |
| POST | `/publisher/products/v2/` | Wyszukaj produkty (v2) |
| PUT | `/publisher/products/{id}/tracking_link/` | Generuj link produktu |
| POST | `/publisher/products/stats/` | Statystyki produktów |
| GET | `/publisher/products/export_templates/` | Lista szablonów eksportu |
| POST | `/publisher/products/export_templates/` | Utwórz szablon eksportu |
| GET | `/publisher/products/export_templates/fields/` | Pola do eksportu |
| GET | `/publisher/products/export_templates/{uuid}/` | Szczegóły szablonu |
| PUT | `/publisher/products/export_templates/{uuid}/` | Aktualizuj szablon |
| PATCH | `/publisher/products/export_templates/{uuid}/` | Częściowa aktualizacja |
| DELETE | `/publisher/products/export_templates/{uuid}/` | Usuń szablon |

#### Przypadki użycia
- Wyszukiwanie produktów po atrybutach
- Generowanie linków trackingowych dla produktów
- Eksport katalogów produktów w różnych formatach

---

### 3. 🌐 Website API
**Cel:** Zarządzanie witrynami afiliacyjnymi

#### Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/publisher/websites/` | Lista witryn |
| POST | `/publisher/websites/` | Utwórz witrynę |
| GET | `/publisher/websites/{uuid}/` | Szczegóły witryny |
| PUT | `/publisher/websites/{uuid}/` | Aktualizuj witrynę |
| PATCH | `/publisher/websites/{uuid}/` | Częściowa aktualizacja |
| DELETE | `/publisher/websites/{uuid}/` | Usuń witrynę |
| GET | `/publisher/websites/find/` | Finder witryn |
| GET | `/publisher/websites/{uuid}/get_verification/` | Status weryfikacji |
| PUT | `/publisher/websites/{uuid}/verify/` | Weryfikuj witrynę |
| PUT | `/publisher/websites/{uuid}/restore/` | Przywróć witrynę |

#### Właściwości witryny
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Moja strona okazji",
  "url": "https://example.com",
  "category": "deals",
  "status": "approved",
  "verification_status": "verified",
  "created_at": "2025-12-05T10:00:00Z",
  "updated_at": "2025-12-05T10:00:00Z"
}
```

---

### 4. 📊 Analytics API
**Cel:** Tworzenie i zarządzanie raportami analytics

#### Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/publisher/reports/` | Lista raportów |
| POST | `/publisher/reports/` | Utwórz raport |
| GET | `/publisher/reports/system-configs/` | System report configs |
| GET | `/publisher/reports/system-configs/{slug}/` | Szczegóły config |
| GET | `/publisher/reports/user-configs/` | User report configs |
| POST | `/publisher/reports/user-configs/` | Utwórz custom config |
| GET | `/publisher/reports/user-configs/{uuid}/` | Szczegóły custom config |
| PUT | `/publisher/reports/user-configs/{uuid}/` | Aktualizuj config |
| PATCH | `/publisher/reports/user-configs/{uuid}/` | Częściowa aktualizacja |
| DELETE | `/publisher/reports/user-configs/{uuid}/` | Usuń config |

#### Dostępne metryki
- Conversions (konwersje)
- CPC (cost per click)
- Click-through rate (CTR)
- Revenue
- Commission

---

### 5. 💰 Billing API
**Cel:** Zarządzanie finansami, transakcjami, płatniościami

#### Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/publisher/billing_accounts/` | Lista kont billingowych |
| GET | `/publisher/billing_accounts/unified_balance/` | Saldo ujednolicone |
| GET | `/publisher/billing_accounts/{currency__code}/` | Konto dla waluty |
| GET | `/publisher/transactions/` | Historia transakcji |
| POST | `/publisher/transactions/withdrawal/` | Wznowienie wypłaty |
| GET | `/publisher/transactions/{id}/` | Szczegóły transakcji |
| GET | `/publisher/invoices/` | Lista faktur |
| GET | `/publisher/invoices/{uuid}/` | Szczegóły faktury |
| GET | `/publisher/invoices/stats/` | Statystyki faktur |
| GET | `/publisher/payment_account/` | Dane konta płatniczego |
| PUT | `/publisher/payment_account/` | Aktualizuj konto |
| PATCH | `/publisher/payment_account/` | Częściowa aktualizacja |
| GET | `/publisher/payment_status/` | Status płatności |
| POST | `/publisher/shared_tracking/try/` | Test shared tracking |
| GET | `/publisher/subaccounts/find/` | Finder subkont |

#### Obiekty finansowe
```json
{
  "id": "TXN123",
  "type": "commission",
  "amount": 50.00,
  "currency": "PLN",
  "status": "completed",
  "date": "2025-12-05T10:00:00Z"
}
```

---

### 6. 🎛️ Platform API (System Info)
**Cel:** Informacje systemowe i konfiguracja platformy

#### Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/system/company_info/` | Info o firmie |
| GET | `/system/countries/` | Lista krajów |
| GET | `/system/currencies/` | Dostępne waluty |
| GET | `/system/languages/` | Dostępne języki |
| GET | `/system/timezones/` | Strefy czasowe |
| GET | `/system/geoip/` | Geolokalizacja IP |
| GET | `/system/offer_categories/` | Kategorie ofert |
| GET | `/system/website_categories/` | Kategorie witryn |
| GET | `/system/payout_methods/` | Metody wypłat |
| GET | `/system/payment_threshold/` | Min. próg wpłaty |
| GET | `/system/products/feed_languages/` | Języki feedów |
| GET | `/system/tracking_domain/` | Domena trackingu |
| GET | `/system/tracking_parameters/` | Parametry trackingu |
| GET | `/system/referral_system/` | System referrali |

#### Przykład: Pobieranie waług
```bash
GET /system/currencies/

[
  {"code": "PLN", "name": "Polish Zloty", "symbol": "zł"},
  {"code": "EUR", "name": "Euro", "symbol": "€"},
  {"code": "USD", "name": "US Dollar", "symbol": "$"}
]
```

---

### 7. 🧩 Widget API
**Cel:** Zarządzanie widgetami (Adslots, Black Friday, Payday Loans)

Zawiera systemy dla:
- **Adslots** - Sloty reklamowe
- **Black Friday** - Oferty Black Friday
- **Black Friday Legacy** - Legacy system
- **Payday Loans** - Oferty pożyczek

---

## Przypadki użycia dla Okazje Plus

### ✅ 1. Integracja linków afiliacyjnych

```javascript
// Generowanie linkę trackingowego dla produktu
const generateTrackingLink = async (productId) => {
  const response = await fetch(
    `https://api.convertiser.com/publisher/products/${productId}/tracking_link/`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Token ${CONVERTISER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // parametry trackingowe
      })
    }
  );
  return response.json();
};
```

### ✅ 2. Pobieranie dostępnych ofert

```javascript
// Wyszukiwanie ofert z filtrami
const searchOffers = async (filters) => {
  const query = new URLSearchParams(filters);
  const response = await fetch(
    `https://api.convertiser.com/publisher/offers/find/?${query}`,
    {
      headers: { 'Authorization': `Token ${CONVERTISER_API_KEY}` }
    }
  );
  return response.json();
};

// Użycie
const offers = await searchOffers({
  category: 'electronics',
  country: 'PL',
  status: 'active'
});
```

### ✅ 3. Raportowanie konwersji

```javascript
// Tworzenie raportu konwersji
const createReport = async (reportConfig) => {
  const response = await fetch(
    'https://api.convertiser.com/publisher/reports/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${CONVERTISER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportConfig)
    }
  );
  return response.json();
};
```

### ✅ 4. Zarządzanie witrynami

```javascript
// Rejestracja nowej witryny (Okazje Plus)
const registerWebsite = async () => {
  const response = await fetch(
    'https://api.convertiser.com/publisher/websites/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${CONVERTISER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Okazje Plus',
        url: 'https://okazjeplus.pl',
        category: 'deals',
        description: 'Polish deals aggregator'
      })
    }
  );
  return response.json();
};
```

### ✅ 5. Pobieranie statystyk finansowych

```javascript
// Pobranie salda konta
const getBalance = async (currency = 'PLN') => {
  const response = await fetch(
    `https://api.convertiser.com/publisher/billing_accounts/${currency}/`,
    {
      headers: { 'Authorization': `Token ${CONVERTISER_API_KEY}` }
    }
  );
  return response.json();
};

// Historia transakcji
const getTransactions = async (page = 1) => {
  const response = await fetch(
    `https://api.convertiser.com/publisher/transactions/?page=${page}&page_size=50`,
    {
      headers: { 'Authorization': `Token ${CONVERTISER_API_KEY}` }
    }
  );
  return response.json();
};
```

---

## Limity i ograniczenia

### Rate Limiting

| Limit | Wartość |
|-------|---------|
| Requests per minute | 60 |
| Requests per hour | 3000 |

**Odpowiedź przy limit exceed:**
```
HTTP 429 Too Many Requests
Retry-After: 60
```

**Strategia:** Exponential backoff (wait 1s, 2s, 4s, 8s...)

### Size Limits

- Max request body: 10 MB
- Max response body: 50 MB
- Timeout: 30 sekund

### Idempotency

Przy POST/PUT/PATCH używaj pola `_version` aby uniknąć duplikatów:

```bash
curl -X POST https://api.convertiser.com/publisher/websites/ \
  -H "Authorization: Token xxx" \
  -H "Content-Type: application/json" \
  -d '{"title": "Site", "_version": "1"}'
```

---

## Best Practices

### ✅ DO

- ✅ Przechowywać token w `SECRET_KEY` lub Environment Variable
- ✅ Używać exponential backoff przy 429 responses
- ✅ Cache'ować dane (system config, currencies, etc.)
- ✅ Używać paginacji dla dużych list
- ✅ Logować wszystkie API calls dla debugowania
- ✅ Implementować retry logic z timeouts

### ❌ DON'T

- ❌ Nie umieszczać tokenu w kodzie źródłowym
- ❌ Nie używać HTTP (tylko HTTPS)
- ❌ Nie ignorować statusów 4xx/5xx
- ❌ Nie wysyłać żądań bez slash na końcu URL'a
- ❌ Nie przechowywać poufnych danych lokalnie
- ❌ Nie robić synchronicznych requestów z UI

---

## Wdrażanie w Okazje Plus

### 1. Environment Setup
```bash
# .env.local
CONVERTISER_API_KEY=your-secret-token
CONVERTISER_API_BASE_URL=https://api.convertiser.com
```

### 2. API Client Setup
```typescript
// src/integrations/convertiser/client.ts
export class ConvertiserClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CONVERTISER_API_KEY || '';
    this.baseUrl = process.env.CONVERTISER_API_BASE_URL || 'https://api.convertiser.com';
  }

  async request(method: string, path: string, data?: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });

    if (response.status === 429) {
      // Implementuj exponential backoff
      throw new RateLimitError('API rate limit exceeded');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}
```

### 3. Integracja z Admin Panel
```typescript
// src/app/[locale]/admin/settings/convertiser.tsx
// Panel do zarządzania integracją Convertiser
```

---

## Przydatne linki

- 📖 [Dokumentacja Convertiser](https://docs.convertiser.com/)
- 🔑 [Generowanie API Token](https://convertiser.com/account/api/)
- 📊 [Dashboard Convertiser](https://convertiser.com/dashboard/)

---

**Ostatnia aktualizacja:** 2025-12-05  
**API Wersja:** Current (bez version pinning)
