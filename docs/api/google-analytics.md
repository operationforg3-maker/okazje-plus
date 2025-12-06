# Google Analytics 4 - Integracja

## Status
✅ **Aktywne** - Tracking ID: `G-4M4NQB0PQD`

## Konfiguracja

Google Analytics 4 jest zintegrowane z aplikacją poprzez:

1. **Script w layoutcie** (`src/app/layout.tsx`)
   - Automatyczne śledzenie pageviews
   - Inicjalizacja gtag.js

2. **Helper functions** (`src/lib/analytics.ts`)
   - Typowe funkcje trackingowe
   - Automatyczne sprawdzanie dostępności GA

## Dostępne funkcje trackingowe

### Podstawowe eventy

```typescript
import { trackEvent, trackPageView } from '@/lib/analytics';

// Custom event
trackEvent('button_click', { button_name: 'add_deal' });

// Pageview (rzadko potrzebne - Next.js robi to automatycznie)
trackPageView('/deals/123');
```

### Specyficzne dla Okazje Plus

```typescript
import {
  trackVote,
  trackItemView,
  trackOutboundClick,
  trackComment,
  trackSearch,
  trackAddContent,
  trackShare,
  trackCategoryFilter,
} from '@/lib/analytics';

// Głosowanie
trackVote('deal', dealId, 'up'); // lub 'down'
trackVote('product', productId, 'down');

// Wyświetlenie szczegółów
trackItemView('deal', dealId, 'elektronika');
trackItemView('product', productId);

// Kliknięcie w link zewnętrzny (Go to Deal)
trackOutboundClick('deal', dealId, 'https://example.com/deal', 85);

// Komentarz
trackComment('deal', dealId);

// Wyszukiwanie
trackSearch('macbook pro', 15); // searchTerm, resultsCount

// Dodanie treści
trackAddContent('deal', 'elektronika');

// Udostępnienie
trackShare('deal', dealId, 'facebook');

// Filtrowanie kategorii
trackCategoryFilter('elektronika', 'smartfony');
```

### Użytkownik

```typescript
import { trackLogin, trackSignUp } from '@/lib/analytics';

// Po zalogowaniu
trackLogin('google'); // 'email', 'facebook', etc.

// Po rejestracji
trackSignUp('google');
```

### Błędy

```typescript
import { trackError } from '@/lib/analytics';

trackError('api_error', 'Failed to fetch deals');
```

## Gdzie już dodane

### ✅ Zaimplementowane

1. **VoteControls** (`src/components/vote-controls.tsx`)
   - `trackVote()` po oddaniu głosu

2. **AutocompleteSearch** (`src/components/autocomplete-search.tsx`)
   - `trackSearch()` po wysłaniu formularza

### 🔄 Do dodania

1. **Deal/Product Pages** - `trackItemView()` przy ładowaniu
2. **Comment Section** - `trackComment()` po dodaniu komentarza
3. **Outbound Links** - `trackOutboundClick()` w przyciskach "Go to Deal"
4. **Auth Forms** - `trackLogin()` i `trackSignUp()` w LoginForm
5. **Add Deal/Product Forms** - `trackAddContent()` po wysłaniu
6. **Share Buttons** - `trackShare()` gdy użytkownik udostępnia
7. **Category Filters** - `trackCategoryFilter()` w MegaMenu

## Przykład użycia w komponencie

```typescript
'use client';

import { useEffect } from 'react';
import { trackItemView } from '@/lib/analytics';

export default function DealPage({ deal }: { deal: Deal }) {
  useEffect(() => {
    // Track pageview when component mounts
    trackItemView('deal', deal.id, deal.mainCategorySlug);
  }, [deal.id, deal.mainCategorySlug]);

  const handleGoToDeal = () => {
    trackOutboundClick('deal', deal.id, deal.link, deal.temperature);
    window.open(deal.link, '_blank');
  };

  return (
    <div>
      <h1>{deal.title}</h1>
      <button onClick={handleGoToDeal}>Go to Deal</button>
    </div>
  );
}
```

## Dashboard Analytics

Panel admina pokazuje status integracji:

- **`/admin/analytics`** - Status GA4, link do konsoli
- **`/admin/settings`** (tab: Integracje) - Measurement ID

## Konsola Google Analytics

Dane dostępne w: https://analytics.google.com/analytics/web/#/p491578768/reports/intelligenthome

## Environment Variables

Nie są potrzebne - Tracking ID jest hardcoded w `src/app/layout.tsx` i `src/lib/analytics.ts`.

Jeśli w przyszłości chcesz go ukryć:

```bash
# .env.local
NEXT_PUBLIC_GA_TRACKING_ID=G-4M4NQB0PQD
```

Wtedy w `layout.tsx` i `analytics.ts` użyj:
```typescript
const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
```

## Testowanie

W development mode otwórz Console w przeglądarce:

```javascript
// Sprawdź czy gtag jest dostępny
window.gtag

// Zobacz wszystkie eventy
window.dataLayer

// Wyślij testowy event
gtag('event', 'test_event', { test_param: 'test_value' });
```

W GA4 Real-Time reports zobaczysz eventy w ciągu kilku sekund.
