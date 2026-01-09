# System Głosowania - Kompletny Przewodnik Debugowania

## Status: ✅ Działający

Endpoint `/api/deals/[id]/vote` zwraca prawidłowe JSON z kodami statusu:
- **401 Unauthorized** - Brak prawidłowego tokenu Firebase
- **404 Not Found** - Deal nie istnieje w bazie
- **429 Rate Limited** - Zbyt wiele głosów w ciągu minuty
- **200 OK** - Głos został zarejestrowany
- **500 Internal Error** - Błąd serwera (sprawdź logi!)

## Architektura

### Frontend (Client-side)
```
src/components/deal-card.tsx
src/app/[locale]/deals/[id]/deal-detail-client.tsx
    ↓
    firebaseUser.getIdToken()  ← pobiera token Firebase Auth
    ↓
    fetch('/api/deals/[id]/vote', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
```

### Backend (Server-side)
```
src/app/api/deals/[id]/vote/route.ts
    ↓ 
    [1] Parsowanie JSON body
    ↓
    [2] Weryfikacja tokenu Firebase (adminAuth.verifyIdToken)
    ↓
    [3] Rate limiting (max 10 głosów/minutę)
    ↓
    [4] Pre-check: czy deal istnieje
    ↓
    [5] Transakcja Firestore
        - Get deal data
        - Get vote data
        - Calculate changes
        - Update deal.temperature
        - Update deal.voteCount
        - Set/update vote document
    ↓
    [6] Zwrot JSON Response
```

### Firestore Schema
```
/deals/{dealId}
  - temperature: number
  - voteCount: number
  - ... inne pola

/deals/{dealId}/votes/{userId}
  - vote: 1 | -1  (up vote lub down vote)
  - createdAt: ISO timestamp
  - userId: string
```

## Błędy i Ich Rozwiązania

### ❌ "Unexpected end of JSON input"
**Przyczyna**: Endpoint zwraca puste body lub nievalidny JSON
**Status HTTP**: Zazwyczaj 500

**Rozwiązanie**:
```bash
# 1. Sprawdź czy endpoint zwraca JSON
curl -v -X POST https://okazjeplus.pl/api/deals/test-123/vote \
  -H "Authorization: Bearer invalid" \
  -H "Content-Type: application/json" \
  -d '{"action":"up"}'

# Powinien zwrócić:
# < HTTP/2 401
# {"success":false,"message":"..."}

# 2. Sprawdź logi w Cloud Logging
gcloud logging read --limit=20 --project=okazje-plus

# 3. Sprawdź czy deal ID jest prawidłowy
# Okazje muszą mieć status: "approved"
```

### ❌ "Rate limit exceeded"
**Przyczyna**: Użytkownik głosuje zbyt szybko
**Status HTTP**: 429

```typescript
// Kod implementuje limit: 10 głosów na minutę per user
// Resetuje się po 60 sekundach
```

**Rozwiązanie**: Czekaj 1 minutę przed następnym głosem

### ❌ "Deal not found"
**Przyczyna**: Deal ID nie istnieje lub nie ma statusu "approved"
**Status HTTP**: 404

**Rozwiązanie**:
```bash
# Sprawdź czy deal istnieje
firebase firestore:query /deals \
  --project=okazje-plus \
  --filters='status == approved'
```

### ❌ "Unauthorized - musisz być zalogowany"
**Przyczyna**: Brak tokenu lub token jest nieprawidłowy
**Status HTTP**: 401

**Rozwiązanie**:
```typescript
// W komponencie:
const firebaseUser = auth.currentUser;  // Sprawdź czy user jest zalogowany
if (!firebaseUser) {
  // Zaloguj się w Firebase Auth
  return;
}
const token = await firebaseUser.getIdToken();  // Pobierz token
console.log('Token:', token);  // Debug: sprawdź w konsoli
```

## Testing

### 1. Test automatyczny (na produkcji)
```bash
# Uruchom test diagnostyczny
./test-voting-system.sh

# Sprawdza:
# - Health check
# - Vote system health
# - Endpoint connectivity
```

### 2. Test manualny (lokalne)
```bash
# Terminal 1: Uruchom dev serwer
npm run dev

# Terminal 2: Test vote endpoint
curl -X POST http://localhost:9002/api/deals/test-123/vote \
  -H "Authorization: Bearer invalid" \
  -H "Content-Type: application/json" \
  -d '{"action":"up"}'
```

### 3. Test integracyjny (Browser Console)
```javascript
// Otwórz /admin/system-health i sprawdź dashboard

// Lub ręcznie w konsoli:
fetch('/api/health').then(r => r.json()).then(console.log);
fetch('/api/health/vote').then(r => r.json()).then(console.log);
```

## Monitoring

### Health Check Endpoints
```
GET /api/health
  - Firestore connectivity
  - Categories count
  - Environment variables
  - Performance metrics

GET /api/health/vote
  - Firebase Admin SDK
  - Sample deal with votes
  - Vote subcollection structure
  - Endpoint schema
```

### Admin Dashboard
```
https://okazjeplus.pl/admin/system-health
  - Real-time health checks
  - Auto-refresh every 30s
  - Status badges (OK/warning/error)
```

### Firestore Rules
```
/deals/{dealId}/votes/{userId}
  - allow read: if true  (każdy może czytać głosy)
  - allow create, update, delete: if isSignedIn() && request.auth.uid == userId
                                  (tylko właściciel głosu)
```

## Firestore Indexes

### Wymagane indexy
```
Collection: deals
Fields:
  - status (ASC)
  - voteCount (DESC)
  - __name__ (ASC)
```

**Status**: ✅ READY (Index ID: CICAgLjRyYIK)

```bash
# Sprawdź status indexów
gcloud firestore indexes composite list --project=okazje-plus

# Deploy nowe indexy
firebase deploy --only firestore:indexes
```

## Kody Statusu HTTP

| Status | Znaczenie | Akcja |
|--------|-----------|-------|
| 200 | ✓ Sukces | Głos zarejestrowany |
| 400 | ✗ Bad Request | Sprawdź body (action: up\|down\|remove) |
| 401 | ✗ Unauthorized | Zaloguj się / sprawdź token |
| 404 | ✗ Not Found | Deal nie istnieje |
| 429 | ⏱ Rate Limited | Czekaj 1 minutę |
| 500 | ✗ Server Error | Sprawdź logi Firebase |

## Logi Debugowania

### Serwer wypisuje:
```
Vote logged: user=abc123, deal=dealId123, action=up, newVote=1, duration=45ms
Vote response for dealId123: {"success":true,"temperature":125,"voteCount":3,"userVote":1}
```

### Klient wypisuje (console.log):
```
Vote response error: {
  status: 500,
  statusText: "Internal Server Error",
  responseBody: "...",
  contentType: "application/json"
}
```

## Troubleshooting Checklist

- [ ] User jest zalogowany (`auth.currentUser !== null`)
- [ ] Token jest prawidłowy (`firebaseUser.getIdToken()` się powiodła)
- [ ] Deal istnieje i ma status "approved"
- [ ] Endpoint zwraca JSON (`Content-Type: application/json`)
- [ ] Rate limit nie został przekroczony (< 10 głosów/min)
- [ ] Firestore Rules pozwalają na write do votes
- [ ] Firestore index jest READY
- [ ] Firebase Admin SDK jest załadowany
- [ ] Brak CSS/JS hydration errors w konsoli

## Przydatne Komendy

```bash
# Sprawdź logi serwera
gcloud logging read --limit=50 --project=okazje-plus --format=json | jq '.[] | select(.jsonPayload.message | contains("Vote"))'

# Sprawdź Firestore connector
gcloud firestore indexes composite describe CICAgLjRyYIK --project=okazje-plus

# Monitor real-time
gcloud logging read --limit=10 --follow --project=okazje-plus

# Sprawdź deal w bazie
firebase firestore:query /deals \
  --limit=5 \
  --project=okazje-plus
```

## Performance Metrics

Expected response times:
- Token verification: 5-10ms
- Deal pre-check: 10-20ms
- Firestore transaction: 20-50ms
- **Total**: < 100ms

## Ostatnie Zmiany (Commit: 0b5a646)

- ✅ Dodano error handling dla JSON parse
- ✅ Dodano pre-check dla deal existence
- ✅ Poprawiono logging (duration, status)
- ✅ Wyraźna `Content-Type: application/json` header
- ✅ Comprehensive error messages

## Kontakt / Support

Jeśli testy nie przechodzą:
1. Sprawdź logi: `gcloud logging read --project=okazje-plus`
2. Uruchom test: `./test-voting-system.sh`
3. Sprawdź admin panel: `/admin/system-health`
4. Czytaj ten przewodnik od "Błędy i Ich Rozwiązania"
