# 🛡️ System Moderacji - Dokumentacja

**Data:** 8 styczeń 2026  
**Status:** ✅ Kompletny  
**Wersja:** 1.0

## 📋 Przegląd

System moderacji w Okazje Plus umożliwia adminom i moderatorom zarządzanie treścią, użytkownikami i zgłoszeniami. Wszystkie akcje są logowane dla celów audytu.

## 🎯 Funkcje

### 1. Moderacja Deals & Products

**Endpoint:** `/api/admin/moderation`

**Pojedyncza akcja:**
```bash
POST /api/admin/moderation
Authorization: Bearer <token>

{
  "itemId": "deal_123",
  "itemType": "deal",  # lub "product"
  "action": "approve"  # lub "reject"
}
```

**Bulk akcje:**
```bash
POST /api/admin/moderation/bulk
Authorization: Bearer <token>

{
  "items": [
    { "id": "deal_123", "type": "deal" },
    { "id": "deal_456", "type": "deal" }
  ],
  "action": "approve",  # approve | reject | delete | change-status
  "status": "draft"     # opcjonalne, dla action='change-status'
}
```

**Pobierz wszystkie IDs:**
```bash
GET /api/admin/moderation/get-all-ids?type=deal
Authorization: Bearer <token>
```

### 2. Zarządzanie Użytkownikami

**Endpoint:** `/api/admin/users/[userId]/moderate`

**Akcje na użytkowniku:**
```bash
POST /api/admin/users/user_123/moderate
Authorization: Bearer <token>

{
  "action": "ban",  # ban | suspend | unsuspend | change-role | warn
  "reason": "Spam and offensive content",
  "duration": 7,  # opcjonalnie, dni dla suspension
  "role": "moderator"  # opcjonalnie, dla change-role
}
```

**Historia moderacji użytkownika:**
```bash
GET /api/admin/users/user_123/moderate
Authorization: Bearer <token>
```

**Dostępne akcje:**
- `ban` - Permanentny ban (wyłącza Firebase Auth)
- `suspend` - Czasowe zawieszenie (wymaga `duration`)
- `unsuspend` - Odwiesza konto
- `change-role` - Zmienia rolę (user/moderator/admin)
- `warn` - Ostrzeżenie (dodaje do `warnings` array)

**Ochrony:**
- ❌ Nie można moderować samego siebie
- ❌ Nie można banować adminów
- ✅ Wszystkie akcje logowane w `moderation_log`

### 3. Moderacja Komentarzy

**Endpoint:** `/api/admin/comments/moderate`

**Pojedyncza akcja:**
```bash
POST /api/admin/comments/moderate
Authorization: Bearer <token>

{
  "commentId": "comment_123",
  "parentType": "deal",  # lub "product"
  "parentId": "deal_456",
  "action": "delete",  # approve | reject | delete | mark-spam
  "reason": "Spam content"  # opcjonalnie
}
```

**Pobierz zgłoszone komentarze:**
```bash
GET /api/admin/comments/moderate?limit=50
Authorization: Bearer <token>
```

**Zwraca:** Komentarze z `reportCount > 0`, posortowane malejąco.

**Efekty mark-spam:**
- Status komentarza → 'spam'
- Reputacja autora: -10 punktów
- `spamCount` autora: +1

### 4. System Zgłoszeń (Reports)

**Endpoint:** `/api/admin/reports`

**Pobierz zgłoszenia:**
```bash
GET /api/admin/reports?status=pending&type=spam&limit=100
Authorization: Bearer <token>
```

**Query params:**
- `status` - pending | resolved | rejected (default: pending)
- `type` - spam | duplicate | incorrect_info | offensive | expired | other
- `limit` - max liczba wyników (default: 100)

**Obsłuż zgłoszenie:**
```bash
POST /api/admin/reports
Authorization: Bearer <token>

{
  "reportId": "report_123",
  "action": "delete-target",  # approve | reject | delete-target | ignore
  "moderatorNotes": "Confirmed spam, content removed"  # opcjonalnie
}
```

**Akcje:**
- `approve` - Akceptuje zgłoszenie (nie usuwa treści)
- `reject` - Odrzuca zgłoszenie (błędne zgłoszenie)
- `delete-target` - Usuwa zgłoszoną treść
- `ignore` - Ignoruje zgłoszenie

**Nagrody:**
- Za potwierdzone zgłoszenie (`delete-target`): +5 reputation

### 5. Logi Moderacji

**Endpoint:** `/api/admin/moderation-logs`

**Pobierz logi:**
```bash
GET /api/admin/moderation-logs?limit=100&targetType=deal&action=approve
Authorization: Bearer <token>
```

**Query params:**
- `limit` - max liczba wyników (default: 100)
- `targetType` - deal | product | comment | user | report
- `moderatorId` - filtruj po moderatorze
- `action` - filtruj po akcji
- `startDate` - data początku (ISO string)
- `endDate` - data końca (ISO string)

**Zwraca:**
```json
{
  "success": true,
  "logs": [...],
  "stats": {
    "total": 150,
    "byAction": { "approve": 100, "reject": 50 },
    "byTargetType": { "deal": 120, "product": 30 },
    "byModerator": { "user_123": 150 }
  }
}
```

## 🎨 UI Panel Admina

**Lokalizacja:** `/[locale]/admin/moderation`

**Zakładki:**
1. **Okazje** - Pending deals z bulk actions
2. **Produkty** - Pending products z bulk actions
3. **Komentarze** - Zgłoszone komentarze (w budowie UI)
4. **Zgłoszenia** - User reports (w budowie UI)
5. **Użytkownicy** - User management (w budowie UI)
6. **Zatwierdzone** - Historia zatwierdzonych (7 dni)
7. **Odrzucone** - Historia odrzuconych (7 dni)

**Bulk actions:**
- Zaznacz widoczne
- Zaznacz wszystkie w bazie (pobiera IDs z API)
- Zatwierdź
- Odrzuć
- Zmień status (draft/pending)
- Usuń

## 🔒 Uprawnienia

**Role:**
- `admin` - Pełen dostęp (wszystkie funkcje)
- `moderator` - Moderacja treści (deals/products/comments/reports)
- `user` - Brak dostępu do panelu admina

**Sprawdzanie uprawnień:**
```typescript
// W endpointach API
const moderatorDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
const moderatorData = moderatorDoc.data();
const isAdmin = decodedToken.admin === true || moderatorData?.role === 'admin';
const isAdminOrMod = 
  decodedToken.admin === true || 
  decodedToken.moderator === true ||
  moderatorData?.role === 'admin' ||
  moderatorData?.role === 'moderator';
```

## 📊 Struktura Firestore

### moderation_log (kolekcja)
```typescript
{
  action: string,           // approve, reject, ban, etc.
  targetType: string,       // deal, product, comment, user, report
  targetId: string,
  parentType?: string,      // dla komentarzy
  parentId?: string,
  moderatorId: string,
  moderatorEmail: string,
  reason?: string,
  duration?: number,
  role?: string,
  timestamp: string,        // ISO
  metadata?: object
}
```

### users (rozszerzone pola moderacji)
```typescript
{
  status: 'active' | 'banned' | 'suspended',
  role: 'user' | 'moderator' | 'admin',
  
  // Ban
  bannedAt?: string,
  bannedBy?: string,
  banReason?: string,
  
  // Suspension
  suspendedAt?: string,
  suspendedBy?: string,
  suspendedUntil?: string,
  suspensionReason?: string,
  
  // Warnings
  warnings?: Array<{
    issuedAt: string,
    issuedBy: string,
    reason: string
  }>,
  warningCount?: number,
  
  // Stats
  reputation?: number,
  spamCount?: number,
  helpfulReportsCount?: number
}
```

### reports (kolekcja)
```typescript
{
  reportedBy: string,       // user ID
  targetType: string,       // deal, product, comment, user
  targetId: string,
  parentType?: string,      // dla komentarzy
  parentId?: string,
  reportType: 'spam' | 'duplicate' | 'incorrect_info' | 'offensive' | 'expired' | 'other',
  description?: string,
  status: 'pending' | 'resolved' | 'rejected',
  createdAt: string,
  
  // Gdy resolved
  resolvedBy?: string,
  resolvedAt?: string,
  resolution?: string,      // approve, reject, delete-target, ignore
  moderatorNotes?: string,
  
  updatedAt: string
}
```

## 🧪 Przykłady Użycia

### Ban użytkownika (7 dni)
```bash
curl -X POST https://okazje-plus.web.app/api/admin/users/spam_user_123/moderate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "suspend",
    "reason": "Spamming deals with fake discounts",
    "duration": 7
  }'
```

### Bulk approve pending deals
```bash
curl -X POST https://okazje-plus.web.app/api/admin/moderation/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "deal_1", "type": "deal"},
      {"id": "deal_2", "type": "deal"}
    ],
    "action": "approve"
  }'
```

### Obsłuż spam report
```bash
curl -X POST https://okazje-plus.web.app/api/admin/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "report_123",
    "action": "delete-target",
    "moderatorNotes": "Confirmed spam. User warned."
  }'
```

### Pobierz logi admina
```bash
curl -X GET "https://okazje-plus.web.app/api/admin/moderation-logs?moderatorId=admin_123&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

## ⚠️ Znane Ograniczenia

1. **UI niekompletne** - Zakładki Comments/Reports/Users w panelu admina mają tylko API test buttons (pełny UI planned)
2. **Firestore Rules** - Trzeba zaktualizować `firestore.rules` o dostęp do `reports` i `moderation_log`
3. **Indexes** - Potrzebne composite indexes dla `moderation_log` queries (auto-sugerowane przez Firestore)
4. **Email notifications** - Nie wysyłamy maili do zbanowanych użytkowników (feature planned)
5. **Auto-unsuspend** - Brak Cloud Function do automatycznego unsuspend po upływie `suspendedUntil` (manual unsuspend required)

## 🚀 Następne Kroki

- [ ] Zbudować pełne UI dla Comments/Reports/Users tabs
- [ ] Dodać email notifications dla suspensji/banów
- [ ] Cloud Function dla auto-unsuspend
- [ ] Zaktualizować firestore.rules
- [ ] Dodać composite indexes do firestore.indexes.json
- [ ] Testy E2E dla moderacji
- [ ] Dashboard ze statystykami moderacji

## 📝 Changelog

**2026-01-08** - v1.0
- ✅ API endpointy dla user moderation
- ✅ API endpointy dla comment moderation
- ✅ API endpointy dla reports
- ✅ Centralny moderation_log
- ✅ Rozszerzony UI panel (basic tabs)
- ✅ Dokumentacja

---

**Kontakt:** admin@okazje-plus.pl  
**Dokumentacja:** `/docs/moderation/MODERATION_SYSTEM.md`
