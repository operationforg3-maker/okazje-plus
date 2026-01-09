# Głosowanie - Debugging Guide

## Problem: React Error #418 (Hydration Error)

**Symptom:**
```
Uncaught Error: Minified React error #418
```

**Przyczyna:** Mismatch między HTML na serwerze a tym co renderuje klient (SSR vs CSR).

**Sprawdzenie:**
1. Otwórz Browser Console (F12)
2. Poszukaj błędu z pełnym stacktrace
3. Sprawdź czy błąd pojawia się przy załadowaniu czy po kliknięciu

**Rozwiązanie:**
```typescript
// ❌ ŹRÓDLE: localStorage bez sprawdzenia
useEffect(() => {
  const item = localStorage.getItem('key'); // Server nie ma dostępu!
}, []);

// ✅ NAPRAWIENIE: sprawdź czy JS jest na kliencie
useEffect(() => {
  if (typeof window !== 'undefined') {
    const item = localStorage.getItem('key');
  }
}, []);

// Lub użyj isMounted pattern
const [isMounted, setIsMounted] = useState(false);
useEffect(() => {
  setIsMounted(true);
}, []);
if (!isMounted) return null;
```

**Pliki do sprawdzenia:**
- `src/components/deal-comparison-tool.tsx`
- `src/components/deal-card.tsx`
- Każdy komponent używający `localStorage`

---

## Problem: Vote Endpoint Returns 500

**Symptom:**
```
POST https://okazjeplus.pl/api/deals/[dealId]/vote 500 (Internal Server Error)
SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input
```

**Przyczyna:** Endpoint zwraca pusty response lub nie JSON.

**Debugowanie:**

1. **Sprawdź Health Check:**
```bash
curl -s https://okazjeplus.pl/api/health/vote | jq
```

2. **Sprawdź status Firebase Admin SDK:**
```bash
curl -s https://okazjeplus.pl/api/health?detailed=true | jq '.checks.firebaseAdmin'
```

3. **Sprawdź konsole/logi:**
```bash
# Dev: sprawdź terminal gdzie uruchamiasz `npm run dev`
# Prod: sprawdź Cloud Functions logs lub App Hosting logs
gcloud functions logs read --limit 50
```

---

## Problem: Firestore Index Error

**Symptom:**
```
"error": "The query requires an index. You can create it here: ..."
```

**Przyczyna:** Query wymaga composite index, a go brakuje.

**Sprawdzenie:**
```bash
# Pokaż wszystkie istniejące indeksy
gcloud firestore indexes composite list --project=okazje-plus

# Pokaż szczegóły konkretnego indeksu
gcloud firestore indexes composite describe CICAgLjRyYIK --project=okazje-plus
```

**Rozwiązanie - Automatyczne:**
Jeśli Firestore Console pokazuje link do stworzenia indeksu, kliknij go i poczekaj.

**Rozwiązanie - Manualne:**
```bash
# Stwórz index przez gcloud
gcloud firestore indexes composite create \
  --collection-group=deals \
  --query-scope=COLLECTION \
  --field-config=field-path=status,order=ASCENDING \
  --field-config=field-path=voteCount,order=DESCENDING \
  --field-config=field-path=__name__,order=ASCENDING \
  --project=okazje-plus
```

**Sprawdzenie statusu:**
```bash
gcloud firestore indexes composite list --project=okazje-plus | grep -i votecount
```
Status powinien być `READY` (building = czeka na budowanie).

---

## Problem: Token Verification Failed

**Symptom:**
```
401 Unauthorized - Token verification failed
```

**Przyczyna:** Firebase Admin SDK nie może zweryfikować tokenu.

**Sprawdzenie:**

1. **Token istnieje?**
```bash
# W Chrome DevTools Console:
auth.currentUser.getIdToken().then(t => console.log(t))
```

2. **Firebase Admin SDK działa?**
```bash
curl -s https://okazjeplus.pl/api/health?detailed=true | jq '.checks.firebaseAdmin'
```

3. **Service account skonfigurowany?**
```bash
# Production (App Hosting):
env | grep GOOGLE_APPLICATION_CREDENTIALS

# Local dev:
ls -la serviceAccountKey.json
```

**Rozwiązanie:**
```bash
# Dev: upewnij się że serviceAccountKey.json istnieje
# Prod: przebuduj (token powinien się odnowić w App Hosting)

# Force redeploy:
firebase deploy
```

---

## Problem: Vote Count Mismatch

**Symptom:**
```
Mismatch: voteCount=5, votes docs=3
```

**Przyczyna:** Baza danych ma niezgodne dane (voteCount nie równa się liczbie docs).

**Debugowanie:**
```bash
# Sprawdzisz w Firebase Console:
# 1. Firestore > deals > [dealId] > voteCount field
# 2. Firestore > deals > [dealId] > votes subcollection > liczba dokumentów
# Powinne być sobie równe
```

**Naprawienie:**
```javascript
// W Firebase Console, Terminal, lub Cloud Functions:
// Synchronizuj voteCount z liczbą dokumentów w votes subcollection

const dealRef = db.collection('deals').doc(dealId);
const votes = await dealRef.collection('votes').get();
await dealRef.update({ voteCount: votes.size });
```

---

## Monitoring Workflow

**Codziennie sprawdzaj:**

1. **Status dashboard:**
```bash
# Otwórz w przeglądarce
https://okazjeplus.pl/admin/system-health
```

2. **Vote system test:**
```bash
curl -s https://okazjeplus.pl/api/health/vote | jq '.status'
```

3. **General health:**
```bash
curl -s https://okazjeplus.pl/api/health | jq '.status'
```

**Alert conditions:**
```
🔴 CRITICAL:
- status !== 'ok'
- firebaseAdmin.status === 'error'
- consistency.status === 'error'

⚠️ WARNING:
- responseTime > 3000ms
- index errors
- voteCount mismatches
```

---

## Quick Fix Checklist

Gdy coś nie działa:

- [ ] Sprawdzisz `/api/health` - czy firestore/Firebase Admin OK?
- [ ] Sprawdzisz `/api/health/vote` - czy system głosowania OK?
- [ ] Sprawdzisz browser console - czy React error?
- [ ] Przebuduj aplikację - `npm run build` (dev) lub `firebase deploy` (prod)
- [ ] Sprawdzisz logi - `npm run dev` terminal
- [ ] Sprawdzisz tokenów - czy user jest zalogowany?
- [ ] Sprawdzisz rate limiting - czy user nie głosował zbyt dużo?

---

## Pliki Odpowiadające za Głosowanie

**Frontend:**
- `src/components/deal-card.tsx` - Vote button + logic
- `src/app/[locale]/deals/[id]/deal-detail-client.tsx` - Vote details page
- `src/components/vote-controls.tsx` - Reusable vote component

**Backend:**
- `src/app/api/deals/[id]/vote/route.ts` - Vote endpoint (POST)
- `src/app/api/health/vote/route.ts` - Vote health check
- `src/lib/firebase-admin.ts` - Token verification (Admin SDK)

**Database:**
- Collection: `deals`
- Fields: `voteCount` (int), `temperature` (int)
- Subcollection: `deals/{id}/votes`
- Each vote doc: `{ vote: 1|-1, userId, createdAt }`

---

## Zasoby

- [React Hydration Errors](https://react.dev/errors/418)
- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- Health endpoints:
  - `GET /api/health`
  - `GET /api/health?detailed=true`
  - `GET /api/health/vote`
