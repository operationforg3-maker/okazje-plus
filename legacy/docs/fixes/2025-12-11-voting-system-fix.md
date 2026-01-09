# Naprawa systemu głosowania - 11 grudnia 2025

## Problem
System głosowania nie działał z powodu braku autoryzacji w requestach do API endpoint `/api/deals/[id]/vote`.

## Przyczyna
Komponenty `deal-card.tsx` i `deal-detail-client.tsx` wysyłały zapytania do API bez tokenu autoryzacyjnego Bearer w nagłówku `Authorization`. API endpoint wymagał weryfikacji tokenu Firebase Auth przez Admin SDK, ale otrzymywał jedynie `userId` w body, co powodowało błąd 401 Unauthorized.

## Rozwiązanie

### 1. Naprawiono autoryzację w `deal-card.tsx`
```typescript
// PRZED - nieprawidłowe (brak tokenu)
const response = await fetch(`/api/deals/${deal.id}/vote`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action,
    userId: user.uid // ❌ Niezabezpieczone
  }),
});

// PO - prawidłowe (z tokenem Bearer)
const firebaseUser = auth.currentUser;
if (!firebaseUser) {
  throw new Error('Sesja wygasła - zaloguj się ponownie');
}
const token = await firebaseUser.getIdToken();

const response = await fetch(`/api/deals/${deal.id}/vote`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // ✅ Zabezpieczone
  },
  body: JSON.stringify({ action }),
});
```

### 2. Naprawiono autoryzację w `deal-detail-client.tsx`
Identyczne zmiany jak w `deal-card.tsx` - dodano pobieranie tokenu i wysyłanie w nagłówku Authorization.

### 3. Dodano import `auth` z Firebase
Oba komponenty wymagały dostępu do `auth.currentUser` do pobrania tokenu:
```typescript
import { auth } from '@/lib/firebase';
```

## Architektura systemu głosowania

### Komponenty klienckie
- `src/components/deal-card.tsx` - głosowanie na kartach okazji
- `src/app/[locale]/deals/[id]/deal-detail-client.tsx` - głosowanie na stronie szczegółów
- `src/components/vote-controls.tsx` - generyczny komponent głosowania (już prawidłowy)

### API Endpoint
- `src/app/api/deals/[id]/vote/route.ts`
  - Weryfikuje token Firebase Auth przez Admin SDK
  - Używa transakcji Firestore dla spójności
  - Obsługuje akcje: `up`, `down`, `remove`
  - Implementuje rate limiting (10 głosów/minutę)
  - Zapewnia idempotencję (powtórny ten sam głos = brak zmian)

### Schemat przepływu
```
1. User clicks vote button (↑/↓)
2. Component fetches Firebase Auth token via getIdToken()
3. Component sends POST to /api/deals/[id]/vote with Bearer token
4. API verifies token via adminAuth.verifyIdToken()
5. API executes Firestore transaction:
   - Get deal & user's existing vote
   - Calculate temperature & voteCount changes
   - Update deal counters with increment()
   - Set/update/delete vote document
6. API returns updated values
7. Component updates UI with server response
```

## Bezpieczeństwo

### ✅ Zaimplementowane zabezpieczenia
- **Token verification** - każde żądanie weryfikowane przez Firebase Admin SDK
- **Rate limiting** - max 10 głosów/minutę na użytkownika
- **Transakcje Firestore** - spójność danych temperatura/voteCount
- **Idempotencja** - powtórne głosy nie powodują duplikatów
- **Firestore Rules** - dodatkowa warstwa zabezpieczeń w bazie danych

### ⚠️ Uwagi bezpieczeństwa
- Token jest krótkotrwały (1h) i wymaga odnowienia
- Rate limiting w pamięci - w produkcji zalecany Redis
- Należy monitorować logi dla wykrywania abuse

## Testing

### Test manualny
1. Zaloguj się na konto użytkownika
2. Otwórz stronę z okazjami: http://localhost:9002
3. Kliknij przycisk głosowania (↑ lub ↓) na karcie okazji
4. Sprawdź czy:
   - Licznik temperatury się zaktualizował
   - Licznik głosów się zmienił
   - Toast pokazał sukces
   - Ponowne kliknięcie tego samego głosu nie powoduje zmian (idempotencja)
   - Zmiana głosu (↑→↓ lub ↓→↑) działa poprawnie
5. Odśwież stronę i sprawdź czy głos został zapisany

### Test automatyczny
System testowy w `src/lib/test-service.ts` zawiera `testVotingSystem()` który weryfikuje:
- Czy deals z głosami mają prawidłową temperature
- Czy voteCount jest synchronizowany

Uruchom: 
```bash
# Via UI
http://localhost:9002/admin → zakładka "Testy" → "Uruchom Testy"

# Via API
curl -X POST http://localhost:9002/api/admin/tests/run \
  -H "Authorization: Bearer <admin-token>"
```

## Pliki zmienione
- `src/components/deal-card.tsx` - dodano autoryzację z tokenem
- `src/app/[locale]/deals/[id]/deal-detail-client.tsx` - dodano autoryzację z tokenem
- `docs/fixes/2025-12-11-voting-system-fix.md` - ta dokumentacja

## Related
- API dokumentacja: `src/app/api/deals/[id]/vote/route.ts` (komentarze w kodzie)
- Vote Controls (wzorcowy komponent): `src/components/vote-controls.tsx`
- Test systemu: `src/lib/test-service.ts` → `testVotingSystem()`
- Firestore Rules: `firestore.rules` (zabezpieczenia bazy)

## Wersja
- Data: 11 grudnia 2025
- Commit: (następny commit po tej naprawie)
- Status: ✅ Naprawione i przetestowane
