# 🎨 Panel Admina - Struktura UI/UX

## 📊 Hierarchia Menu (Sidebar)

```
🏠 Dashboard
⚙️ Setup & Seeding                    [NOWE!]

─────────────────────────────
📦 Treści                             [Collapsible]
  ├─ 🛒 Produkty
  ├─ 🔥 Okazje
  ├─ 📁 Kategorie
  └─ ✅ Moderacja

📂 Category Tree                      [Dynamic]

─────────────────────────────
📥 Import Danych                      [Collapsible]
  ├─ 🛍️ AliExpress
  ├─ 🔥 Import Okazji
  ├─ ✨ Bulk AI Import
  └─ 📄 Import CSV

✨ AI Tools

─────────────────────────────
💬 Forum                              [Collapsible]
  └─ ✅ Moderacja

─────────────────────────────
📊 Analityka                          [Collapsible]
  ├─ 📈 Analytics
  └─ 📊 Statystyki

─────────────────────────────
⚙️ Zaawansowane                       [Collapsible]
  ├─ 🧭 Nawigacja
  ├─ 📄 Import CSV
  ├─ 🔮 Predykcja AI
  ├─ 🛠️ M3 Tools
  ├─ 🔍 Duplikaty (M2)
  ├─ 🔑 OAuth Tokens (M2)
  ├─ 🏪 Marketplaces (M4)
  ├─ 💰 Porównanie cen (M4)
  └─ 🗂️ Mapowanie kategorii (M4)

─────────────────────────────
👥 Użytkownicy
⚡ Tajne strony
📝 Pre-rejestracje
⚙️ Ustawienia
```

---

## 🎯 Nowa strona: Setup & Seeding

### Struktura zakładek

```
┌──────────────────────────────────────────────────┐
│  [Seeding Danych]  [Konfiguracja]  [Konserwacja] │
└──────────────────────────────────────────────────┘

📦 SEEDING DANYCH
┌─────────────────┬─────────────────┬─────────────────┐
│  🚀 Wypełnij    │  🔥 Pobierz     │  🗑️ Wyczyść     │
│     Katalog     │     Deale       │     Bazę        │
│                 │                 │                 │
│  ~300 prod.     │  ~100 deali     │  ⚠️ Ostrożnie   │
│  [Uruchom]      │  [Uruchom]      │  [Wyczyść]      │
└─────────────────┴─────────────────┴─────────────────┘

✨ Wynik operacji:
┌──────────────────────────────────────────────────┐
│ 🚀 Rozpoczynam wypełnianie katalogu...           │
│ Pobieram produkty z AliExpress...                │
│ AI processing: normalizacja + kategorie...       │
│ ✅ Zakończono! Dodano 287 produktów              │
└──────────────────────────────────────────────────┘

ℹ️ Jak to działa:
• Wypełnij Katalog: Tworzy strukturę kategorii + produkty
• Pobierz Deale: Agreguje promocje >50% zniżki
• Wyczyść Bazę: Reset (przydatne przed re-seedowaniem)
⚠️ To agregator - dane z AliExpress, nie generowane AI
```

```
⚙️ KONFIGURACJA
┌────────────────────────────────────────┐
│ Firebase Configuration                 │
├────────────────────────────────────────┤
│ Project ID:     okazje-plus            │
│ Region:         europe-west1           │
│ Storage Bucket: okazje-plus...app     │
│ Auth Domain:    okazje-plus...com     │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ API Integrations                       │
├────────────────────────────────────────┤
│ AliExpress API      [✅ Aktywne]       │
│ Google Analytics 4  [✅ Aktywne]       │
│ Typesense Search    [📦 Opcjonalne]    │
│ SendGrid Email      [✅ Aktywne]       │
└────────────────────────────────────────┘
```

```
🛠️ KONSERWACJA
┌──────────────────────┬──────────────────────┐
│ [Odśwież indeksy]   │ [Backup bazy]        │
│ [Usuń stare wersje] │ [Weryfikuj linki]    │
└──────────────────────┴──────────────────────┘

Cloud Functions Status:
┌────────────────────────────────────────┐
│ trackShareStats       [⏳ Pending]     │
│ checkSavedSearches    [⏳ Pending]     │
│ sendWeeklyDigest      [⏳ Pending]     │
└────────────────────────────────────────┘
ℹ️ Deploy: firebase deploy --only functions
```

---

## 🏠 Dashboard - Ulepszone Quick Actions

```
┌────────────────────────────────────────────────┐
│  Dashboard                    [Setup][Analytics]│
└────────────────────────────────────────────────┘

Quick Actions (clickable cards):
┌──────────┬──────────┬──────────┬──────────┐
│ 🔥 Okazje│ 🛒 Produkty│ 👥 Users│ 💬 Forum│
│   1,234  │   5,678   │   890   │ Aktywne │
│ 5 pending│ 3 pending │  Active │Moderacja│
└──────────┴──────────┴──────────┴──────────┘

Sidebar Navigation:
- Collapsible sections (click to expand/collapse)
- Color-coded borders (orange=deals, blue=products, etc.)
- Icon-first hierarchy
- Active state highlighting
```

---

## 🎨 Design Patterns

### Karty akcji (Action Cards)
```css
• Gradient backgrounds (from-blue-500 to-purple-600)
• Hover effects: shadow-xl + scale-105
• Status badges (top-right corner)
• Icon + Title + Description + Button layout
• 3-column responsive grid (1 col mobile, 3 desktop)
```

### Collapsible Sections
```css
• ChevronDown icon (rotates 180° when open)
• Smooth transitions (transition-transform)
• Nested sub-menu with indentation
• Active state: bg-primary + text-primary-foreground
```

### Status Indicators
```css
• Badges: default/secondary/destructive
• Colors: blue (info), green (success), amber (warning), red (error)
• Icons: CheckCircle, AlertCircle, Loader2 (spinning)
```

### Responsive Layouts
```css
• Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
• Sidebar: collapsible on mobile (<md)
• Content: p-4 md:p-6 lg:p-8
• Cards: hover:shadow-lg transition-shadow
```

---

## 📱 Responsive Breakpoints

```
Mobile (< 768px):
├─ Sidebar: Hidden, toggle with PanelLeft icon
├─ Grid: 1 column
└─ Text: Smaller headings

Tablet (768px - 1024px):
├─ Sidebar: Visible, icon-only mode
├─ Grid: 2 columns
└─ Text: Medium headings

Desktop (> 1024px):
├─ Sidebar: Full expanded
├─ Grid: 3-4 columns
└─ Text: Full headings
```

---

## 🔍 Navigation Flow

### Pierwszy raz (onboarding):
```
1. Login → /admin (Dashboard)
2. Zobacz "Quick Actions" + "Setup & Seeding" button
3. Kliknij [Setup & Seeding]
4. Zakładka "Seeding Danych"
5. Kliknij [Wypełnij Katalog] → poczekaj
6. Kliknij [Pobierz Deale] → poczekaj
7. Gotowe! Przejdź do /admin/deals → zatwierdź
```

### Codzienna praca:
```
1. /admin → sprawdź dashboard (pending counts)
2. Sidebar → "Treści" → "Moderacja"
3. Przejrzyj pending queue → approve/reject
4. Sidebar → "Forum" → "Moderacja" (jeśli aktywne)
5. Sidebar → "Analityka" → sprawdź ruch
```

### Import produktów:
```
1. Sidebar → "Import Danych" → "AliExpress"
2. Wyszukaj keyword → zaznacz produkty
3. "Import zaznaczonych" → AI processing
4. Sidebar → "Treści" → "Produkty" → zatwierdź
```

---

## 🎓 Best Practices

### UI/UX:
- ✅ Collapsible sections dla czytelności
- ✅ Icon-first navigation (visual hierarchy)
- ✅ Color-coded borders (szybka identyfikacja)
- ✅ Hover states (feedback)
- ✅ Status badges (visibility)
- ✅ Quick actions na dashboard (efficiency)

### Performance:
- ✅ Lazy loading (CollapsibleContent)
- ✅ Optimistic UI updates
- ✅ Skeleton loaders
- ✅ Pagination (100 items/page)

### Accessibility:
- ✅ Keyboard navigation (Tab, Enter)
- ✅ ARIA labels (tooltip props)
- ✅ Focus states (ring-2)
- ✅ Color contrast (WCAG AA)

---

## 📚 Related Docs

- [PRZEWODNIK_ADMINA.md](./PRZEWODNIK_ADMINA.md) - Pełny przewodnik admina (420+ linii)
- [PRZEWODNIK_UZYTKOWNIKA.md](./PRZEWODNIK_UZYTKOWNIKA.md) - Przewodnik użytkownika (300+ linii)
- [PANEL_ADMINA_QUICKSTART.md](./PANEL_ADMINA_QUICKSTART.md) - Quick reference

---

**Struktura UI/UX zaktualizowana: 27 listopada 2025** 🎉
