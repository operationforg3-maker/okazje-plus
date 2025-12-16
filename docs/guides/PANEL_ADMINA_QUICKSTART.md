# 🎯 Panel Admina - Przewodnik Szybkiego Startu

## 📋 Struktura panelu

### 🏠 Dashboard (`/admin`)
Główny widok z kluczowymi metrykami:
- **Quick Stats**: Okazje, Produkty, Użytkownicy, Forum
- **Pending Review**: Elementy czekające na moderację
- **Aktywność**: Ostatnie 24h i 7 dni
- **Top kategorie**: Najpopularniejsze sekcje

**Quick Actions:**
- Setup & Seeding → `/admin/setup`
- Analityka → `/admin/analytics`

---

### ⚙️ Setup & Seeding (`/admin/setup`)
**Pierwotna konfiguracja platformy**

#### 🌱 Seeding Danych
1. **Wypełnij Katalog** 
   - Tworzy strukturę kategorii (jak Pepper.pl)
   - Pobiera ~300 produktów z AliExpress API
   - AI-enhanced metadata
   
2. **Pobierz Deale**
   - Agreguje promocje >50% zniżki
   - ~100 gorących okazji
   - Real-time z AliExpress

3. **Wyczyść Bazę** ⚠️
   - Usuwa WSZYSTKIE produkty i deale
   - Nieodwracalne!
   - Używaj przed re-seedowaniem

#### 🔧 Konfiguracja
- Firebase Project ID: `okazje-plus`
- Region: `europe-west1`
- Storage Bucket, Auth Domain
- API Integrations: AliExpress, GA4, Typesense, SendGrid

#### 🛠️ Konserwacja
- Odśwież indeksy Firestore
- Backup bazy danych
- Weryfikacja linków
- Status Cloud Functions

---

### 📦 Zarządzanie Treścią

#### **Produkty** (`/admin/products`)
- Lista wszystkich produktów
- Filtry: approved/pending/draft/rejected
- Bulk actions: approve, reject, delete
- Edycja inline
- Import z AliExpress

#### **Okazje** (`/admin/deals`)
- Lista wszystkich okazji
- Filtry statusów
- Moderacja pojedyncza i hurtowa
- Quick approve/reject
- Podgląd temperatury

#### **Kategorie** (`/admin/categories`)
- Hierarchia kategorii
- Dodawanie/edycja
- Mapowanie do AliExpress
- Ikony i kolory

#### **Moderacja** (`/admin/moderation`)
- Centralna kolejka moderacji
- Pending deals + products
- Quick review workflow
- Bulk operations

---

### 📥 Import Danych

#### **AliExpress** (`/admin/imports/aliexpress`)
- Wyszukiwanie produktów
- Filtry: cena, rating, zamówienia
- Bulk import (max 50 na raz)
- AI processing (kategorie, normalizacja)

#### **Import Produktów** (`/admin/products-import`)
- JSON import produktów z wzbogaconymi danymi
- Obsługa **LocalizedText** (title/description/longDescription w wielu językach)
- Import **specyfikacji technicznych** (`metadata.specifications` lub `specifications`)
- Import **ocen zewnętrznych** (AliExpress `evaluateRate`, `evaluateCount`, `merchantRating`) → mapowane na `ratingSources.external`
- Deduplikacja (AI): wykrywanie duplikatów przed zapisem
- Upsert: aktualizacja istniejących produktów po `metadata.originalId` lub `affiliateUrl`

**Moderacja – stan danych (Dry-Run):**
- 🈯 `translated`: wykryte tłumaczenia (title/description w wielu językach)
- ✨ `enriched`: obecne wzbogacenie (specyfikacje/SEO/AI)
- 📐 `specs`: liczba itemów ze specyfikacjami
- ⭐ `externalRatings`: liczba itemów z oceną zewnętrzną

**Preferowane narzędzia (aktualne):**
- Import produktów: `/admin/import-export` (zakładka Import JSON → Produkty)
- Import okazji: `/admin/import-export` (Import JSON → Okazje)

**Przestarzałe/legacy:**
- Skrypty seedingowe – tylko do dev/demo; nie tworzą pełnych obiektów (używaj Import & Export)

#### **Import Okazji** (`/admin/deals-import`)
- CSV import okazji
- Bulk AI Import
- Walidacja danych

#### **Bulk AI Import** (`/admin/bulk-import`)
- Masowy import z AI
- Automatyczna kategoryzacja
- Quality check

#### **Import CSV** (`/admin/import`)
- Universal CSV importer
- Mapowanie kolumn
- Preview przed importem

---

### 🤖 AI Tools (`/admin/ai-tools`)
- Genkit flows
- AI-powered categorization
- Title normalization
- Feature extraction
- SEO tags generation

---

### 💬 Forum

#### **Moderacja Forum** (`/admin/forum/moderation`)
**Filtry:**
- Oczekujące (pending/draft)
- Zgłoszone (reports > 0)
- Wszystkie

**Akcje dla wątków:**
- ✅ Zatwierdź (status: approved)
- ❌ Odrzuć (status: rejected)
- 🚨 Spam (status: spam)
- 📌 Przypnij (isPinned: true)
- 🔒 Zablokuj (isLocked: true)
- 🗑️ Usuń (soft delete)

**Akcje dla postów:**
- Approve, Reject, Spam, Delete
- Pole powodu (reason) - opcjonalne
- Moderation log - audyt wszystkich akcji

---

### 📊 Analityka

#### **Analytics** (`/admin/analytics`)
- Google Analytics 4 (G-FT6DRFR25D)
- Overview: views, clicks, users, sessions, shares
- Wykres dzienny (7/14/30 dni)
- Top deals i products
- **4 zakładki:**
  - Urządzenia: Desktop/Mobile/Tablet
  - Źródła: Direct/Google/Social/Referral/Email
  - Strony: Top 10 najpopularniejszych
  - Konwersje: Click tracking, shares, GA4 events

#### **Statystyki** (`/admin/stats`)
- Przegląd platformy
- Produkty/Okazje breakdown
- Aktywność czasowa (dzisiaj/tydzień/miesiąc)
- Źródła produktów (AliExpress/Ręczne/AI)
- Eksport danych (CSV/JSON)

---

### 👥 Użytkownicy (`/admin/users`)
- Lista użytkowników
- Role: admin/moderator/user
- Zmiana roli (Firestore console)
- Blokowanie (banned: true)
- Statystyki użytkownika

---

### ⚡ Zaawansowane

- **Nawigacja** - mega menu, footer
- **Import CSV** - uniwersalny importer
- **Predykcja AI** - trending prediction
- **M3 Tools** - milestone 3 features
- **Duplikaty (M2)** - detekcja duplikatów
- **OAuth Tokens (M2)** - tokeny zewnętrzne
- **Marketplaces (M4)** - multi-marketplace
- **Porównanie cen (M4)** - price comparison
- **Mapowanie kategorii (M4)** - category mapping

---

## 🔥 Workflow pierwszego uruchomienia

### 1. Pierwsze uruchomienie platformy
```bash
1. Przejdź do /admin/setup
2. Kliknij "Wypełnij Katalog" → poczekaj ~5 min
3. Kliknij "Pobierz Deale" → poczekaj ~3 min
4. Gotowe! Platforma ma treść
```

### 2. Codzienna moderacja
```bash
1. /admin → sprawdź "Oczekuje moderacji"
2. /admin/moderation → przejrzyj pending queue
3. /admin/forum/moderation → moderuj forum (jeśli aktywne)
4. /admin/analytics → sprawdź ruch dzienny
```

### 3. Import dodatkowych produktów
```bash
1. /admin/imports/aliexpress → wyszukaj keyword
2. Zaznacz produkty (max 50)
3. "Import zaznaczonych" → AI processing
4. /admin/products → zatwierdź zaimportowane
```

### 4. Zarządzanie użytkownikami
```bash
1. /admin/users → lista użytkowników
2. Firestore console → users/{uid} → edytuj role
3. Blokowanie: banned: true
4. Sprawdź user_points, user_badges
```

---

## 🚨 Najczęstsze operacje

### Zatwierdzanie okazji
1. `/admin/deals`
2. Filtr: `pending`
3. Kliknij na okazję → sprawdź link, cenę, kategorię
4. Approve ✅ lub Reject ❌

### Czyszczenie bazy przed re-seedowaniem
1. `/admin/setup` → zakładka "Seeding"
2. Kliknij "Wyczyść Bazę" 🗑️
3. Potwierdź 2x (nieodwracalne!)
4. Następnie "Wypełnij Katalog" ponownie

### Moderacja forum
1. `/admin/forum/moderation`
2. Filtr: "Oczekujące"
3. Zatwierdź wątki/posty
4. Przypnij ważne (pin icon)
5. Zablokuj spam (lock/spam)

### Eksport danych
1. `/admin/stats`
2. CSV export z filtrami
3. JSON bulk export
4. Google Sheets integration (opcja)

---

## 📚 Linki pomocne

- **Dokumentacja użytkownika**: `/docs/PRZEWODNIK_UZYTKOWNIKA.md`
- **Dokumentacja admina**: `/docs/PRZEWODNIK_ADMINA.md`
- **Firebase Console**: [console.firebase.google.com](https://console.firebase.google.com/project/okazje-plus)
- **GA4 Analytics**: [analytics.google.com](https://analytics.google.com/analytics/web/#/p491578768)
- **Firestore Console**: [Firestore Database](https://console.firebase.google.com/project/okazje-plus/firestore)
- **Cloud Functions**: [Functions](https://console.firebase.google.com/project/okazje-plus/functions)

---

## 🎓 Tips & Tricks

1. **Sidebar jest collapsible** - kliknij grupy aby rozwinąć/zwinąć
2. **Quick actions na dashboard** - szybki dostęp do najważniejszych sekcji
3. **Setup & Seeding** - używaj tylko przy pierwszym uruchomieniu lub reset
4. **Bulk actions** - zaznaczaj wiele elementów (checkboxy) dla hurtowej moderacji
5. **Filtry statusów** - przełączaj się między approved/pending/rejected
6. **AI Tools** - wykorzystaj automatyczną kategoryzację przy imporcie
7. **Forum moderation log** - wszystkie akcje są logowane (audyt)
8. **Analytics real-time** - GA4 dashboard aktualizuje się co godzinę

---

## ⚠️ Ważne zasady

- **Nie usuwaj ręcznie z Firestore** - używaj UI admina (audyt, soft delete)
- **Setup & Seeding tylko raz** - chyba że chcesz reset
- **Backup przed wipe** - Firestore automatic backups codziennie o 2:00
- **2FA dla adminów** - włącz w Firebase Console
- **Rate limits AliExpress** - 60 req/min, nie przekraczaj
- **Cloud Functions pending deploy** - uruchom `firebase deploy --only functions`

---

**Powodzenia w administracji! 🚀**
