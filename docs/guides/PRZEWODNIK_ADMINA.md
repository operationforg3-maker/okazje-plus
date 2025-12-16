# 🛡️ Przewodnik Administratora - Okazje Plus

Kompleksowy przewodnik dla administratorów i moderatorów platformy Okazje Plus.

## 🔐 Dostęp do panelu admina

### Wymagania
- Role: `admin` lub `moderator` w Firestore (`users/{uid}`)
- Dostęp przez: `/admin` (automatyczne przekierowanie jeśli nie masz uprawnień)

### Role i uprawnienia
- **Admin**: Pełny dostęp do wszystkich funkcji
- **Moderator**: Dostęp do moderacji treści, statystyk podstawowych
- **User**: Brak dostępu do panelu admina

## 📊 Dashboard - Przegląd

### Główne metryki (`/admin`)
- **Total Deals**: Wszystkie okazje (approved/pending/draft/rejected)
- **Total Products**: Wszystkie produkty w katalogu
- **Total Users**: Zarejestrowani użytkownicy
- **Total Comments**: Komentarze we wszystkich okazjach/produktach

### Karty statystyczne
- **Hot Deals**: Okazje z temperaturą > 300
- **Pending Deals**: Czekające na moderację
- **Top Products**: Produkty z oceną > 4.5
- **Active Users**: Użytkownicy z > 5 postami

### Quick Actions
- Przejdź do moderacji deals
- Przejdź do moderacji produktów
- Zobacz szczegółowe statystyki
- Import z AliExpress

## 🎯 Moderacja Okazji (`/admin/deals`)

### Lista okazji
- Filtrowanie według statusu:
  - ✅ **Approved**: Zatwierdzone i widoczne publicznie
  - ⏳ **Pending**: Czekające na weryfikację
  - 📝 **Draft**: Szkice (nie ukończone)
  - ❌ **Rejected**: Odrzucone

### Akcje moderacyjne
**Dla pojedynczej okazji:**
1. Kliknij na okazję aby zobaczyć szczegóły
2. Dostępne akcje:
   - ✅ **Approve** - zatwierdź i opublikuj
   - ❌ **Reject** - odrzuć z powodem
   - 📝 **Edit** - edytuj szczegóły
   - 🗑️ **Delete** - usuń permanentnie (ostrożnie!)

**Bulk actions:**
- Zaznacz wiele okazji (checkboxy)
- Wybierz akcję z dropdown
- Potwierdź operację

### Weryfikacja okazji - checklist
- [ ] Tytuł jest jasny i opisowy
- [ ] Link prowadzi do prawdziwej oferty
- [ ] Cena jest aktualna i poprawna
- [ ] Kategoria i tagi są właściwe
- [ ] Zdjęcie jest wysokiej jakości
- [ ] Brak spamu/clickbaitu
- [ ] Kod rabatowy działa (jeśli podano)

### Powody odrzucenia (templates)
- "Link nie działa lub wygasł"
- "Cena nieprawidłowa lub wprowadza w błąd"
- "Spam lub clickbait"
- "Duplikat istniejącej okazji"
- "Nieodpowiednia kategoria"
- "Niskiej jakości treść"

## 📦 Moderacja Produktów (`/admin/products`)

### Lista produktów
Podobnie jak deals, filtry według statusu:
- Approved / Pending / Draft / Rejected

### Weryfikacja produktów - checklist
- [ ] Tytuł i opis są kompletne
- [ ] Kategoria główna i podkategoria poprawne
- [ ] Cena aktualna
- [ ] Zdjęcia wysokiej jakości
- [ ] Specyfikacja techniczna uzupełniona
- [ ] Link do sklepu poprawny
- [ ] Brak duplikatów

### AI-powered suggestions
System AI automatycznie:
- Normalizuje tytuły (usuwa noise)
- Dopasowuje kategorie
- Ekstraktuje cechy produktu
- Generuje tagi SEO

**Weryfikacja AI:**
- Sprawdź pole `aiAnalysis` w szczegółach produktu
- Zaakceptuj lub popraw sugestie AI
- AI uczy się na podstawie Twoich decyzji

## 📈 Statystyki (`/admin/stats`)

### Główne metryki
**Przegląd platformy:**
- Produkty: Total / Approved / Pending / Draft / Rejected
- Okazje: Total / Approved / Pending / Draft / Rejected
- Użytkownicy: Total / Aktywni (>5 postów)
- Komentarze, wyświetlenia, ulubione

**Ciekawostki:**
- Hot deals (temperatura > 300)
- Top rated products (rating > 4.5)
- Produkty z rabatem
- Średnia cena produktu/okazji
- Najaktywniejszi użytkownicy

**Aktywność czasowa:**
- Okazje dzisiaj
- Okazje ostatni tydzień
- Okazje ostatni miesiąc

**Źródła produktów:**
- Z AliExpress (import API)
- Ręcznie dodane
- AI-enriched

### Eksport danych
- CSV export z filtrami
- JSON bulk export
- Integracja z Google Sheets (opcjonalnie)

## 📊 Analityka (`/admin/analytics`)

### Google Analytics 4
- **Tracking ID**: G-FT6DRFR25D
- **Property ID**: 491578768
- Link do konsoli GA4: [analytics.google.com](https://analytics.google.com/analytics/web/#/p491578768)

### Metryki w panelu
1. **Overview**:
   - Total Views (wyświetlenia stron)
   - Total Clicks (kliknięcia w linki okazji)
   - Unique Users (unikalne userId)
   - Unique Sessions (sesje)
   - Total Shares (udostępnienia)
   - Avg Conversion Rate (clicks/views * 100)

2. **Wykres dzienny**: Views by day w wybranym zakresie (7/14/30 dni)

3. **Top listy**:
   - Top 5 deals (po views i clicks)
   - Top 5 products (po views i clicks)

### Zakładki dodatkowe
1. **Urządzenia**: Desktop (45%) / Mobile (50%) / Tablet (5%)
2. **Źródła ruchu**: Direct / Google Search / Social / Referral / Email
3. **Najpopularniejsze strony**: Top 10 z szacowanymi views
4. **Konwersje**: 
   - Deal clicks (główny cel)
   - Social shares
   - Skonfigurowane eventy GA4

### Custom eventy GA4 (już skonfigurowane)
```javascript
// page_view - automatycznie
// deal_click - kliknięcia w linki okazji
// product_view - wyświetlenia produktów
// share - udostępnienia społecznościowe
// search - wyszukiwania
// user_engagement - zaangażowanie
```

## 🛠️ Import z AliExpress (`/admin/import/aliexpress`)

### Konfiguracja API
**Wymagane zmienne środowiskowe:**
```bash
ALIEXPRESS_APP_KEY=your_app_key
ALIEXPRESS_APP_SECRET=your_app_secret
ALIEXPRESS_TRACKING_ID=your_tracking_id
```

### Wyszukiwanie produktów
1. Wpisz keyword (np. "laptop")
2. Wybierz kategorię (opcjonalnie)
3. Ustaw filtry: cena min/max, rating min, liczba zamówień
4. Kliknij "Szukaj"

### Bulk import
1. Zaznacz produkty do importu (max 50 na raz)
2. Kliknij "Import zaznaczonych"
3. System:
   - Pobiera szczegóły z API
   - Przetwarza przez AI (normalizacja, kategorie)
   - Tworzy produkty w statusie `pending`
4. Przejdź do moderacji produktów i zatwierdź

### Monitoring importu
- Status: Firebase Functions logs
- Błędy: Cloud Functions console
- Rate limiting: 60 requests/minute (AliExpress limit)

### Best practices
- Importuj małe partie (10-20 produktów)
- Weryfikuj kategorie po imporcie
- Sprawdzaj duplikaty przed zatwierdzeniem
- Uzupełnij polskie opisy jeśli AI nie wystarczy

## 💬 Moderacja Forum (`/admin/forum/moderation`)

### Kolejka moderacji
**Filtry:**
- **Oczekujące**: Wątki/posty ze statusem `pending` lub `draft`
- **Zgłoszone**: Elementy z reportCount > 0
- **Wszystkie**: Pełna lista

### Akcje dla wątków
- ✅ **Zatwierdź** - status `approved`, widoczny publicznie
- ❌ **Odrzuć** - status `rejected`, ukryty
- 🚨 **Spam** - status `spam`, ukryty + flag
- 📌 **Przypnij** - isPinned = true (sticky thread)
- 🔓 **Odepnij** - isPinned = false
- 🔒 **Zablokuj** - isLocked = true (no new replies)
- 🔓 **Odblokuj** - isLocked = false
- 🗑️ **Usuń** - soft delete (status `deleted`)

### Akcje dla postów
- ✅ **Zatwierdź**
- ❌ **Odrzuć**
- 🚨 **Spam**
- 🗑️ **Usuń** - soft delete

### Pole powodu (reason)
- Opcjonalne, ale zalecane
- Wyświetlane użytkownikowi (jeśli odrzucenie)
- Zapisywane w `moderation_log` collection

### Moderation log
Audyt wszystkich akcji moderacyjnych:
```typescript
{
  action: 'approve' | 'reject' | 'delete' | 'pin' | 'lock',
  targetType: 'thread' | 'post',
  targetId: string,
  moderatorUid: string,
  moderatorEmail: string,
  reason: string | null,
  timestamp: ISO string
}
```

Dostęp: Firestore console → `moderation_log` collection

## 👥 Zarządzanie użytkownikami

### Zmiana roli użytkownika
**Przez Firestore console:**
1. Otwórz `users/{uid}`
2. Edytuj pole `role`:
   - `user` - zwykły użytkownik
   - `moderator` - moderator treści
   - `admin` - pełny dostęp
3. Zapisz - zmiana natychmiastowa

**Przez Admin SDK (Cloud Functions):**
```typescript
await adminDb.collection('users').doc(uid).update({
  role: 'moderator'
});
```

### Blokowanie użytkowników
1. W Firestore: `users/{uid}` → dodaj pole `banned: true`
2. Użytkownik nie będzie mógł dodawać treści
3. Istniejące treści pozostają (możesz je moderować osobno)

### Statystyki użytkownika
**W profilu użytkownika (`/profile/{uid}`):**
- Total points
- Reputation level
- Badges earned
- Contribution count (deals + reviews + comments)
- Activity timeline

**W Firestore:**
- `user_points/{uid}` - szczegółowy breakdown punktów
- `user_badges/{uid}/{badgeId}` - zdobyte odznaki
- `point_transactions/{uid}` - historia transakcji

## 🎮 Gamification Management

### Poziomy reputacji (read-only)
Zdefiniowane w `src/lib/gamification.ts`:
```typescript
REPUTATION_LEVELS = [
  { name: 'Nowicjusz', minPoints: 0, color: '#9ca3af' },
  { name: 'Czytelnik', minPoints: 100, color: '#60a5fa' },
  { name: 'Uczestnik', minPoints: 300, color: '#34d399' },
  { name: 'Entuzjasta', minPoints: 1000, color: '#fbbf24' },
  { name: 'Ekspert', minPoints: 3000, color: '#f97316' },
  { name: 'Mistrz', minPoints: 10000, color: '#a855f7' },
  { name: 'Legenda', minPoints: 30000, color: '#ec4899' },
]
```

### Odznaki (badges)
**Przyznawanie ręczne (przez Firestore lub Cloud Function):**
```typescript
await awardBadge(userId, 'special_contributor');
```

**Dostępne badge IDs:**
- `first_step` - pierwsza okazja
- `deal_hunter` - 10 okazji
- `social_butterfly` - 50 komentarzy
- `helpful_hand` - 25 helpful votes
- `early_bird` - wczesny użytkownik

### Leaderboard
- Generowany automatycznie: `weekly`, `monthly`, `all_time`
- Cloud Function: `generateLeaderboard()` w `src/lib/gamification.ts`
- Odświeżanie: co godzinę (scheduled function)

## 📧 Email & Notifications

### SendGrid Configuration
**Wymagane:**
- `SENDGRID_API_KEY` w Firebase App Hosting Secrets
- Sender email zweryfikowany w SendGrid

### Weekly Digest
- **Function**: `sendWeeklyDigest` (scheduled, niedziela 9:00)
- **Template**: HTML w `okazje-plus/src/index.ts`
- **Personalizacja**: Na podstawie kategorii ulubionych użytkownika

### Push Notifications
**Web Push (przez Firebase Cloud Messaging):**
- Konfiguracja: `firebase-messaging-sw.js` w public
- Token zapisywany: `user_settings/{uid}/fcmToken`
- Wysyłanie: przez Admin SDK w Cloud Functions

## 🔧 Narzędzia deweloperskie

### Firestore Console
- [console.firebase.google.com](https://console.firebase.google.com/project/okazje-plus/firestore)
- Bezpośredni dostęp do wszystkich kolekcji
- Edycja, usuwanie, eksport danych

### Cloud Functions Logs
- [console.firebase.google.com/functions](https://console.firebase.google.com/project/okazje-plus/functions)
- Monitoring wykonań funkcji
- Błędy i performance metrics

### Firebase Hosting
- Deploy: `firebase deploy --only hosting`
- Rollback: poprzez console
- Custom domain: okazje.plus

### Monitoring i alerty
- **Firebase Performance Monitoring**: Automatycznie aktywne
- **Crashlytics**: Dla błędów runtime
- **Alerts**: Email na critical errors

## 🚨 Procedury awaryjne

### System down
1. Sprawdź status: [Firebase Status Dashboard](https://status.firebase.google.com/)
2. Sprawdź Cloud Functions logs
3. Sprawdź Firestore quotas
4. Kontakt z zespołem tech: Slack #incidents

### Spam attack
1. Użyj bulk actions w `/admin/deals` lub `/admin/products`
2. Zaznacz wszystkie spam posty
3. Akcja "Mark as spam"
4. Zablokuj użytkownika w Firestore: `banned: true`

### Data corruption
1. Firestore automatic backups: codziennie o 2:00
2. Restore z backup: Firebase Console → Backups
3. Manual export przed restore (safety)

### Rate limit exceeded (API)
- AliExpress: 60 req/min
- Poczekaj lub zwiększ limit (plan upgrade)
- Monitoring: Cloud Functions metrics

## 📋 Checklist codziennej pracy admina

### Rano (9:00-10:00)
- [ ] Sprawdź dashboard - podstawowe metryki
- [ ] Przejrzyj pending deals (zatwierdź/odrzuć)
- [ ] Przejrzyj pending products
- [ ] Sprawdź zgłoszenia forum (reports)
- [ ] Odpowiedz na support emails

### Południe (13:00-14:00)
- [ ] Przejrzyj nowe komentarze (spam filter)
- [ ] Moderacja forum - nowe wątki
- [ ] Check GA4 analytics - ruch dzienny
- [ ] Odpowiedz na pytania na forum pomocy

### Wieczór (18:00-19:00)
- [ ] Final check pending queue
- [ ] Przegląd weekly digest preview (piątek)
- [ ] Backup check (czy automated działa)
- [ ] Plan na jutro

### Tygodniowo (piątek)
- [ ] Weekly report: statystyki tygodnia
- [ ] Review top contributors (consider badges)
- [ ] Cleanup spam/rejected (jeśli > 1000)
- [ ] Update dokumentacji (jeśli zmiany)

### Miesięcznie
- [ ] Full analytics review
- [ ] Leaderboard winners announcement
- [ ] Community feedback gathering
- [ ] System health check (quotas, performance)

## 🎓 Advanced Features

### Custom Scripts
Lokalizacja: `/src/scripts/`
- `seed-m3.ts` - seeding danych testowych
- `migrate-*.ts` - migracje danych

Uruchomienie:
```bash
npx tsx src/scripts/seed-m3.ts
```

### API Endpoints (Admin)
- `/api/admin/deals` - bulk operations
- `/api/admin/products` - bulk operations
- `/api/admin/forum/moderate` - forum moderation
- `/api/admin/aliexpress/search` - AliExpress search
- `/api/forum/best-answer` - mark best answer

### Firestore Security Rules
Edycja: `firestore.rules`
Deploy: `firebase deploy --only firestore:rules`

**Ważne reguły:**
- Users mogą edytować tylko swoje dokumenty
- Deals/Products `pending` invisible dla users
- Forum posts filtrowane po statusie
- Admin ma pełny dostęp (checked via role)

## 📚 Dodatkowe zasoby

- **Dokumentacja techniczna**: `/docs/`
- **README główny**: `/README.md`
- **Milestone summaries**: `/docs/M*_COMPLETION_SUMMARY.md`
- **Copilot instructions**: `/.github/copilot-instructions.md`

## 🔒 Bezpieczeństwo i prywatność

### RODO Compliance
- Users mogą eksportować swoje dane (self-service w profilu)
- Usunięcie konta: manual process (email request)
- Data retention: 2 lata nieaktywności

### Security Best Practices
- Nigdy nie udostępniaj Service Account Key publicznie
- Rotuj API keys co kwartał
- Używaj Environment Variables dla secrets
- 2FA dla admins (Firebase Console)

---

## 🎉 Powodzenia w administracji platformy!

Pytania? Sprawdź [przewodnik użytkownika](./PRZEWODNIK_UZYTKOWNIKA.md) lub kontakt tech lead.
