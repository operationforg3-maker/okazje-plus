# 🔍 AUDIT REPORT — Okazje Plus (23.11.2025)

## ✅ CO DZIAŁA DOBRZE:

### 1. System Ulubionych (Favorites)
- ✅ Backend functions działają (`addToFavorites`, `removeFromFavorites`, `isFavorite`)
- ✅ Hook `useFavorites` z optimistic UI
- ✅ N+1 query optimization (batch fetching z `documentId()`)
- ✅ Integracja w `product-card.tsx` i `deal-card.tsx`
- ✅ Analytics tracking
- ✅ Profile page pokazuje ulubione

### 2. System Kategorii
- ✅ Mega-menu z deep linking
- ✅ Subcategories i subSubCategories
- ✅ Quick filters (Nowe, Kupony, Za darmo, Darmowa dostawa)
- ✅ Feature flags działają

### 3. Gamification
- ✅ Points, levels, badges system exists
- ✅ Leaderboard page `/leaderboard` 
- ✅ Backend w `src/lib/gamification.ts`

### 4. Social Features
- ✅ Follow/unfollow system w `src/lib/social.ts`
- ✅ User profiles z bio
- ✅ Feed obserwowanych

---

## 🔴 KRYTYCZNE PROBLEMY ZNALEZIONE:

### 1. **BRAK ODPOWIEDZI NA KOMENTARZE** ❌ → ✅ NAPRAWIONE
**Problem:**
- Comment interface nie miał `parentId`
- Nie było możliwości zagnieżdżonych odpowiedzi
- Brak UI dla wątków komentarzy

**Rozwiązanie:**
- ✅ Dodano `parentId`, `repliesCount`, `userPhotoURL`, `edited`, `editedAt` do Comment interface
- ✅ Zaktualizowano `addComment()` w data.ts - obsługa parentId, auto-increment repliesCount
- ✅ Stworzono nowy `comment-section-v2.tsx` z:
  - Zagnieżdżone odpowiedzi (replies)
  - Avatar użytkowników
  - Przycisk "Odpowiedz"
  - Rozwijanie/ukrywanie odpowiedzi
  - Licznik odpowiedzi

### 2. **FAKE ADMIN AUTHORIZATION** ❌ → ✅ NAPRAWIONE
**Problem:**
```tsx
const isAdmin = user?.email?.includes('@admin') || false; // FAKE!
```
- Admin check sprawdzał tylko czy email zawiera '@admin'
- Każdy mógł zmienić email i zyskać admin rights

**Rozwiązanie:**
- ✅ Zmieniono na: `const isAdmin = user?.role === 'admin' || user?.role === 'moderator';`
- Teraz używa prawdziwej roli z User object z Firestore

### 3. **VOTING API BEZ AUTORYZACJI** ❌ → DO NAPRAWY
**Problem:**
```typescript
// TYMCZASOWE: Pobierz uid z body (tylko dla development!)
const userId = body.userId;
```
- Vote API `/api/deals/[id]/vote` przyjmuje userId z body request
- Każdy może głosować wielokrotnie podając różne userId
- Brak weryfikacji Firebase Auth token
- Komentarz "W produkcji KONIECZNIE włączyć!" - NIE WŁĄCZONE

**Wpływ:**
- Vote manipulation
- Fake upvotes/downvotes
- Temperature manipulation
- Leaderboard cheating

**Co trzeba naprawić:**
1. Włączyć Firebase Admin SDK verification
2. Usunąć userId z body
3. Pobierać uid z zweryfikowanego tokenu
4. Dodać rate limiting (max X votes per minute)
5. Logging wszystkich vote actions dla audytu

### 4. **BRAK EDYCJI KOMENTARZY** ⚠️
**Problem:**
- Użytkownicy nie mogą edytować swoich komentarzy
- Comment ma pole `edited` i `editedAt` ale brak funkcji

**Co dodać:**
1. `updateComment()` function w data.ts
2. Edit button w comment-section (tylko własne komentarze)
3. Edit history (opcjonalnie)

### 5. **BRAK NOTYFIKACJI** ⚠️
**Problem:**
- Notification interface exists w types.ts
- Brak implementacji create/send/read notifications
- Użytkownicy nie dostają powiadomień o:
  - Odpowiedziach na komentarze
  - Mention w komentarzach
  - Status changes (deal approved/rejected)
  - Price alerts

**Co dodać:**
1. `createNotification()`, `getUserNotifications()`, `markAsRead()` w data.ts
2. NotificationBell component już istnieje ale jest pusty
3. Cloud Function triggers dla auto-notifications
4. Email notifications (SendGrid/Firebase Cloud Messaging)

### 6. **PRICE ALERTS NIE DZIAŁAJĄ** ⚠️
**Problem:**
- Backend functions istnieją (`src/lib/price-alerts.ts`)
- Dialog component exists
- Brak Cloud Functions do monitorowania cen
- Brak wysyłania powiadomień

**Co dodać:**
1. Cloud Function `priceMonitor` (scheduled co godzinę)
2. Pobiera alerty z Firestore
3. Sprawdza aktualne ceny
4. Wysyła powiadomienia gdy cena < targetPrice
5. Oznacza alert jako triggered

### 7. **XSS VULNERABILITY W KOMENTARZACH** 🔴
**Problem:**
```tsx
<p className="text-foreground">{comment.content}</p>
```
- Content renderowany bezpośrednio bez sanitizacji
- Możliwy XSS attack przez wstrzyknięcie `<script>` tagów

**Rozwiązanie:**
```tsx
import DOMPurify from 'isomorphic-dompurify';
<p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content) }} />
```
Lub lepiej - używać tylko plaintext: `{comment.content}` (już tak jest, ale trzeba zablokować HTML w textarea)

### 8. **FIRESTORE RULES NIE ZWERYFIKOWANE** ⚠️
**Lokalizacja:** `firestore.rules`

**Co sprawdzić:**
- Czy users collection jest zabezpieczona
- Czy favorites można czytać tylko własne
- Czy votes są zabezpieczone przed duplikatami
- Czy comments mogą usuwać tylko admini/autorzy
- Czy price_alerts może czytać tylko właściciel

### 9. **BRAK RATE LIMITING** 🔴
**Problem:**
- Brak limitów na:
  - Liczbe komentarzy per minute
  - Liczbe votes per minute
  - Liczbe price alerts per user
  - API calls ogólnie

**Rozwiązanie:**
- Firebase App Check
- Cloud Functions rate limiting
- Client-side debouncing

### 10. **USER PROFILE NIEKOMPLETNY** ⚠️
**Problem:**
- User interface ma podstawowe pola
- Brak:
  - Bio (description)
  - Location
  - Website
  - Social links
  - Verified badge
  - Join date display
  - Total contributions stats

**Co dodać:**
- Extended User Profile interface
- Edit profile page
- Public profile view `/user/[id]`

---

## 📊 BRAKUJĄCE INDEXES FIRESTORE:

Potrzebne composite indexes dla:
```
1. favorites: userId + itemType + createdAt (DESC)
2. comments: parentId + createdAt (ASC) -- dla replies
3. votes: dealId + userId
4. priceAlerts: userId + triggered + createdAt
5. notifications: userId + read + createdAt (DESC)
```

Dodać w `firestore.indexes.json`.

---

## 🎯 PRIORYTET NAPRAWY:

### P0 - KRYTYCZNE (zanim wejdziemy na produkcję):
1. ✅ **Naprawiony**: System odpowiedzi na komentarze
2. ✅ **Naprawiony**: Admin authorization check
3. 🔴 **TODO**: Voting API authorization (Firebase Admin SDK)
4. 🔴 **TODO**: Firestore Rules audit
5. 🔴 **TODO**: XSS protection (content sanitization)

### P1 - WAŻNE (w ciągu tygodnia):
1. **TODO**: Notification system implementation
2. **TODO**: Price Alerts Cloud Functions
3. **TODO**: Rate limiting
4. **TODO**: Comment editing
5. **TODO**: Firestore composite indexes

### P2 - NICE TO HAVE (w ciągu miesiąca):
1. User profile extensions
2. Email notifications
3. Vote manipulation detection (ML?)
4. Advanced moderation tools
5. Automated testing dla krytycznych flow

---

## ✅ CO ZOSTAŁO JUŻ NAPRAWIONE:

1. ✅ Comment system - dodano zagnieżdżone odpowiedzi (replies)
2. ✅ Comment interface - parentId, repliesCount, userPhotoURL, edited
3. ✅ Admin authorization - prawdziwy check roli zamiast fake email check
4. ✅ addComment() - obsługa parentId i auto-increment repliesCount
5. ✅ comment-section-v2.tsx - pełny UI dla wątków komentarzy

---

## 📝 NASTĘPNE KROKI:

1. Napraw voting API authorization
2. Audit firestore.rules
3. Dodaj content sanitization
4. Implementuj notification system
5. Stwórz Cloud Functions dla price monitoring
6. Dodaj rate limiting
7. Uruchom testy E2E

---

**Status:** W trakcie naprawy - 2/10 krytycznych problemów naprawionych
**Data:** 23.11.2025
**Autor audytu:** AI Assistant
