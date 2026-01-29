# 🎯 Plan Rozbudowy Forum - Deal/Product Embedding

## Status: Forum JUŻ MA funkcjonalność embedowania! ✅

Aktualnie dostępne:
- ✅ Attachment Picker (SearchableAttachmentPicker)
- ✅ Inline mentions (@deal:id, @product:id)
- ✅ Rich rendering (AttachmentCard z ceną, obrazem, temperaturą)
- ✅ Wyszukiwanie deals/produktów w time

## 🎨 Proponowane UX Improvements (Phase 1)

### 1. **Rich Editor z Button-based Embedding** (HIGH PRIORITY)
**Problem:** Użytkownik musi znać składnię `@deal:id` - to skomplikowane
**Rozwiązanie:** Dodać button "Embed Deal/Product" na pasku edytora

```tsx
// NewThreadEditor Component (NOWY)
// Features:
// - Toolbar z przyciskami: Bold, Italic, Link, **Embed Deal**, **Embed Product**
// - Click on "Embed Deal" → SearchableAttachmentPicker w modal
// - Automatyczne wstawienie @deal:id do tekstu
// - Visual preview inline (compact AttachmentCard)
```

**Zmiana w:** `src/app/[locale]/forum/new/page.tsx`
**Nowy komponent:** `src/components/forum/rich-editor.tsx`

---

### 2. **Inline Preview w Time Edycji** (MEDIUM)
**Feature:** Podczas pisania, kiedy wpiszesz `@deal:xyz`, pokazuj live preview

```tsx
// src/components/forum/mention-preview.tsx (NOWY)
// - Pokazuj AttachmentCard (compact) zaraz pod tekstem
// - Real-time bez czekania na submit
// - Możliwość remove'u (X button)
```

---

### 3. **Embed Multi-Deal** (MEDIUM)
**Problem:** Teraz da się do threadów tylko JEDEN attachment
**Rozwiązanie:** Zezwolić na wiele embeds

```tsx
// Zmiana w ForumThread model:
// attachments: PostAttachment[] → obsługuje już tablicę!
// Aktualizuj UI aby pokazywać wiele kart
```

**Zmiana w:** `src/app/[locale]/forum/new/page.tsx`
**Zmiana w:** `src/app/[locale]/forum/[id]/page.tsx` (PostContent)

---

### 4. **Deal Comparison w Forum** (MEDIUM)
**Feature:** Jeśli user embeduje 2+ deals → automatycznie pokaż "Porównaj" button

```tsx
// src/components/forum/deal-comparison-button.tsx (NOWY)
// - Pokazuj jeśli ≥2 deals
// - Click → porównanie cen, specyfikacji w modal/drawer
// - Integracja z istniejącą tabelą porównawczą
```

---

### 5. **Search History / Recents** (LOW)
**Feature:** Zapamiętaj ostatnie 10 deals/produktów które embedował user

```tsx
// src/components/forum/searchable-attachment-picker.tsx (ENHANCE)
// - Dodaj "Recent" tab obok search
// - localStorage: forum_embed_recents
// - Quick access bez re-search'owania
```

---

### 6. **Markdown Support w Forum Posts** (LOW)
**Feature:** Pozwolić na markdown (#, -, **bold**, itd)

```tsx
// src/components/forum/markdown-renderer.tsx (NOWY)
// Użyj: react-markdown + remark
// Obsługuj: headings, lists, bold, italic, links
```

---

### 7. **@ Mention Users** (LOW)
**Feature:** Pozwolić na @mention innych userów (nie tylko deals)

```tsx
// src/components/forum/mention-parser.tsx (ENHANCE)
// - Obsługuj: @username (aby notifić user'a)
// - Wymagaj 'reply-to' struktury w DB
// - Integracja z notification system
```

---

## 📊 Implementation Priority

### PHASE 1 (Quick Wins - 2-3 dni)
1. **Rich Editor z toolbar** (HIGH) - `rich-editor.tsx`
2. **Multi-deal support** (MEDIUM) - update `new/page.tsx` + `[id]/page.tsx`
3. **Inline preview** (MEDIUM) - `mention-preview.tsx`

### PHASE 2 (Polish - 3-4 dni)
4. Deal Comparison button
5. Search History/Recents
6. Markdown support

### PHASE 3 (Nice-to-have)
7. User @mentions
8. Forum badges (expert answers)
9. Deal alerts from forum

---

## 💡 Quick Wins - Implementuj teraz?

**Najłatwiej:** Wybrać opcję z buttona zamiast pisać ręczny syntax
**Wartość:** +500% lepszy UX
**Czas:** 1h

Chcesz żebym zaimplementował Rich Editor + Multi-deal support?
